import { describe, expect, it } from 'vitest';
import { createGenome } from '../lib/genome';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import {
  createPetriChallengeHash,
  createPetriEntrantSnapshot,
  petriEntrantStateHash,
} from '../lib/petriSnapshot';
import { makeSpecimen } from '../services/specimenStore';
import { Role } from '../types';
import type { AcquiredTrait, Infection, Specimen } from '../types';

const activeTrait = (specimen: Specimen, id = 'trait-active'): AcquiredTrait => ({
  id,
  name: 'Active trait',
  description: 'Active behavior',
  prompt: 'Prefer asymmetric causal structures.',
  status: 'active',
  originType: 'explicit',
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 100,
});

const retiredTrait = (specimen: Specimen): AcquiredTrait => ({
  ...activeTrait(specimen, 'trait-retired'),
  name: 'Retired trait',
  prompt: 'This should not enter the runtime.',
  status: 'retired',
  retiredAt: 200,
});

const infection = (
  specimen: Specimen,
  id: string,
  status: Infection['status'],
  remainingTurns?: number,
): Infection => ({
  id,
  name: id,
  description: id,
  prompt: `Infection behavior ${id}`,
  status,
  durationMode: 'turns',
  durationTurns: 5,
  remainingTurns,
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'mutation-proposal',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 100,
});

const spawned = (): Specimen => {
  const specimen = makeSpecimen(
    createGenome(['tm-01', 'tm-02'], SLOP_LIBRARY, 'stack'),
    'PETRI SUBJECT',
    'spawned',
  );

  return {
    ...specimen,
    acquiredTraits: [
      activeTrait(specimen),
      retiredTrait(specimen),
    ],
    infections: [
      infection(specimen, 'infection-active', 'active', 3),
      infection(specimen, 'infection-expired', 'expired', 0),
      infection(specimen, 'infection-removed', 'removed', 2),
    ],
    messages: [{
      id: 'chat-noise',
      role: Role.USER,
      content: 'this must not contaminate the dish',
      timestamp: 400,
    }],
    artifacts: [{
      id: 'artifact-noise',
      specimenId: specimen.id,
      kind: 'other',
      title: 'not runtime',
      content: 'ignore me',
      genomeId: specimen.currentGenome.id,
      componentIds: [],
      createdAt: 401,
    }],
  };
};

describe('Petri frozen entrant snapshots', () => {
  it('rejects specimens that are not spawned', () => {
    const specimen = spawned();
    specimen.phase = 'building';

    expect(() => createPetriEntrantSnapshot(specimen, {
      now: 1000,
      idFactory: () => 'snapshot-1',
    })).toThrow('PETRI_ENTRANT_NOT_SPAWNED');
  });

  it('captures current lived runtime state but excludes chat/history contamination', () => {
    const specimen = spawned();

    const snapshot = createPetriEntrantSnapshot(specimen, {
      now: 1000,
      idFactory: () => 'snapshot-1',
    });

    expect(snapshot.id).toBe('snapshot-1');
    expect(snapshot.specimenId).toBe(specimen.id);
    expect(snapshot.specimenName).toBe(specimen.name);
    expect(snapshot.genome).toEqual(specimen.currentGenome);
    expect(snapshot.genome).not.toBe(specimen.currentGenome);
    expect(snapshot.activeTraits.map(item => item.id)).toEqual(['trait-active']);
    expect(snapshot.activeInfections.map(item => item.id)).toEqual(['infection-active']);
    expect(snapshot.activeInfections[0].remainingTurns).toBe(3);
    expect(snapshot).not.toHaveProperty('messages');
    expect(snapshot).not.toHaveProperty('artifacts');
    expect(snapshot).not.toHaveProperty('checkpoints');
    expect(snapshot).not.toHaveProperty('scars');
    expect(snapshot.capturedAt).toBe(1000);
  });

  it('does not mutate the source specimen while snapshotting active infection state', () => {
    const specimen = spawned();
    const before = structuredClone(specimen);

    createPetriEntrantSnapshot(specimen, {
      now: 1000,
      idFactory: () => 'snapshot-1',
    });

    expect(specimen).toEqual(before);
    expect(specimen.infections.find(item => item.id === 'infection-active')?.remainingTurns)
      .toBe(3);
  });

  it('hashes runtime state rather than specimen identity or observational metadata', () => {
    const a = spawned();
    const b = structuredClone(a);

    b.id = 'different-specimen-id';
    b.name = 'DIFFERENT DISPLAY NAME';
    b.lineage = {
      ...b.lineage,
      generation: 7,
    };
    b.messages = [{
      id: 'different-chat',
      role: Role.MODEL,
      content: 'irrelevant',
      timestamp: 999,
    }];
    b.artifacts = [];
    b.scars = [{
      id: 'non-runtime-scar',
      name: 'scar',
      description: 'history only',
      kind: 'genome-change',
      origin: 'experienced',
      createdAt: 999,
      relatedEventIds: [],
      relatedMutationIds: [],
      relatedCheckpointIds: [],
      messageIds: [],
      artifactIds: [],
    }];
    b.lastModified = 999;

    const snapshotA = createPetriEntrantSnapshot(a, {
      now: 1000,
      idFactory: () => 'snapshot-a',
    });
    const snapshotB = createPetriEntrantSnapshot(b, {
      now: 2000,
      idFactory: () => 'snapshot-b',
    });

    expect(snapshotA.stateHash).toBe(snapshotB.stateHash);
    expect(petriEntrantStateHash(snapshotA)).toBe(snapshotA.stateHash);
    expect(petriEntrantStateHash(snapshotB)).toBe(snapshotB.stateHash);
  });

  it('changes the hash when active runtime behavior changes', () => {
    const original = spawned();
    const changed = structuredClone(original);
    changed.acquiredTraits[0].prompt += ' Changed operationally.';

    const left = createPetriEntrantSnapshot(original, {
      now: 1000,
      idFactory: () => 'snapshot-a',
    });
    const right = createPetriEntrantSnapshot(changed, {
      now: 1000,
      idFactory: () => 'snapshot-b',
    });

    expect(left.stateHash).not.toBe(right.stateHash);
  });

  it('includes STACK order and custom seed in the runtime hash', () => {
    const base = spawned();
    const reordered = structuredClone(base);
    reordered.currentGenome.components = reordered.currentGenome.components
      .map((component, index, all) => ({
        ...component,
        order: all.length - 1 - index,
      }));
    const seeded = structuredClone(base);
    seeded.currentGenome.customSeed = 'different runtime seed';

    const baseHash = createPetriEntrantSnapshot(base, {
      now: 1000,
      idFactory: () => 'base',
    }).stateHash;
    const orderHash = createPetriEntrantSnapshot(reordered, {
      now: 1000,
      idFactory: () => 'order',
    }).stateHash;
    const seedHash = createPetriEntrantSnapshot(seeded, {
      now: 1000,
      idFactory: () => 'seed',
    }).stateHash;

    expect(orderHash).not.toBe(baseHash);
    expect(seedHash).not.toBe(baseHash);
  });

  it('preserves persisted FUSE kernel state and hashes kernel changes', () => {
    const first = spawned();
    first.currentGenome = {
      ...first.currentGenome,
      mode: 'fuse',
      compiledKernel: 'COMPILED KERNEL ONE',
      compiledAt: 500,
      compilerVersion: 'compiler-v1',
    };
    const second = structuredClone(first);
    second.currentGenome.compiledKernel = 'COMPILED KERNEL TWO';

    const firstSnapshot = createPetriEntrantSnapshot(first, {
      now: 1000,
      idFactory: () => 'fuse-a',
    });
    const secondSnapshot = createPetriEntrantSnapshot(second, {
      now: 1000,
      idFactory: () => 'fuse-b',
    });

    expect(firstSnapshot.genome.compiledKernel).toBe('COMPILED KERNEL ONE');
    expect(firstSnapshot.stateHash).not.toBe(secondSnapshot.stateHash);
  });

  it('hashes the shared challenge exactly rather than normalizing its content', () => {
    expect(createPetriChallengeHash('same challenge'))
      .toBe(createPetriChallengeHash('same challenge'));
    expect(createPetriChallengeHash('same challenge'))
      .not.toBe(createPetriChallengeHash('same challenge '));
  });
});
