import { describe, expect, it } from 'vitest';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createBreedingPreview } from '../lib/breeding';
import { commitBreedingPreview } from '../lib/breedingPersistence';
import { calculateDrift } from '../lib/drift';
import { createGenome } from '../lib/genome';
import { renderGeneticsReceipt, verifyGeneticsReplay } from '../lib/geneticsReceipt';
import { acquireTrait } from '../lib/mutations';
import { makeSpecimen, migrateSpecimen } from '../services/specimenStore';
import type { AcquiredTrait, Infection, MutationProposal, Scar, Specimen } from '../types';

const parent = (
  id: string,
  name: string,
  componentIds: string[],
  generation = 0,
): Specimen => {
  const specimen = makeSpecimen(
    createGenome(componentIds, SLOP_LIBRARY, 'stack'),
    name,
    'spawned',
  );
  return {
    ...specimen,
    id,
    lineage: {
      kind: generation === 0 ? 'root' : 'fork',
      parentSpecimenIds: generation === 0 ? [] : [`ancestor-${id}`],
      rootSpecimenIds: [`root-${id}`],
      generation,
      source: generation === 0 ? 'native-v4' : 'fork-v4',
    },
  };
};

const trait = (
  specimen: Specimen,
  id: string,
  prompt: string,
  originType: AcquiredTrait['originType'],
): AcquiredTrait => ({
  id,
  name: id,
  description: `Trait ${id}`,
  prompt,
  status: 'active',
  originType,
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 10,
});

const infection = (specimen: Specimen, id: string): Infection => ({
  id,
  name: id,
  description: 'Temporary parent-only state.',
  prompt: `Temporary behavior ${id}`,
  status: 'active',
  durationMode: 'indefinite',
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 20,
});

const scar = (
  specimen: Specimen,
  id: string,
  traitId: string,
): Scar => ({
  id,
  name: id,
  description: 'Direct factual support.',
  kind: 'fossilized-accident',
  origin: 'experienced',
  createdAt: 30,
  sourceSpecimenId: specimen.id,
  relatedEventIds: [],
  relatedMutationIds: [traitId],
  relatedCheckpointIds: [],
  messageIds: [],
  artifactIds: [],
});

const idFactory = (prefix: string) => {
  let index = 0;
  return () => `${prefix}-${index++}`;
};

describe('Round 2C acceptance', () => {
  it('breeds lived parents, persists atomically, replays genetics, reloads, and preserves child independence', async () => {
    const a = parent('parent-a', 'PARENT A', ['tm-01', 'tm-15', 'separated-jurisdictions'], 2);
    const b = parent('parent-b', 'PARENT B', ['tm-01', 'tm-02', 'tm-03', 'material-anchoring', 'eccentric-kineticist'], 4);

    a.acquiredTraits = [
      trait(a, 'a-ordinary', 'Prefer minority interpretations when ambiguity survives.', 'explicit'),
      trait(a, 'a-fossil', 'Preserve productive accidents as constraints.', 'fossilized-accident'),
      trait(a, 'shared-a', 'Treat recurring residue as structural evidence.', 'explicit'),
    ];
    a.scars = [scar(a, 'scar-a-fossil', 'a-fossil')];
    a.infections = [infection(a, 'infection-a')];

    b.acquiredTraits = [
      trait(b, 'b-promoted', 'Keep one temporary deformation if it repeatedly proves useful.', 'promoted-infection'),
      trait(b, 'shared-b', 'Treat recurring residue as structural evidence.', 'explicit'),
    ];
    b.infections = [infection(b, 'infection-b')];

    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);

    const preview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000071',
      now: 1000,
      idFactory: idFactory('birth'),
      library: SLOP_LIBRARY,
      childName: 'ROUND 2C CHILD',
    });

    expect(preview.child.currentGenome.mode).toBe('stack');
    expect(preview.child.birthGenome.mode).toBe('stack');
    expect(preview.child.infections).toEqual([]);
    expect(preview.child.scars).toEqual([]);
    expect(preview.child.messages).toHaveLength(1);
    expect(preview.child.artifacts).toEqual([]);
    expect(preview.child.checkpoints).toEqual([]);
    expect(preview.child.lineage).toMatchObject({
      kind: 'bred',
      parentSpecimenIds: ['parent-a', 'parent-b'],
      rootSpecimenIds: ['root-parent-a', 'root-parent-b'],
      generation: 5,
    });
    expect(preview.child.acquiredTraits.length).toBeLessThanOrEqual(3);
    expect(calculateDrift(preview.child).score).toBe(0);

    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);

    let saved: Specimen[] = [];
    const committed = await commitBreedingPreview([a, b], preview, {
      now: 2000,
      idFactory: idFactory('commit'),
      save: async specimens => {
        saved = structuredClone(specimens);
      },
    });

    expect(committed.status).toBe('committed');
    expect(saved).toHaveLength(3);
    expect(committed.child.geneticsReceipt?.persistedAt).toBe(2000);

    const savedA = committed.specimens.find(item => item.id === a.id)!;
    const savedB = committed.specimens.find(item => item.id === b.id)!;
    const savedChild = committed.specimens.find(item => item.id === committed.child.id)!;

    expect(savedA.currentGenome).toEqual(beforeA.currentGenome);
    expect(savedA.acquiredTraits).toEqual(beforeA.acquiredTraits);
    expect(savedA.infections).toEqual(beforeA.infections);
    expect(savedA.scars).toEqual(beforeA.scars);
    expect(savedB.currentGenome).toEqual(beforeB.currentGenome);
    expect(savedA.lifeHistory.at(-1)?.type).toBe('specimen-offspring-bred');
    expect(savedB.lifeHistory.at(-1)?.type).toBe('specimen-offspring-bred');

    const replay = verifyGeneticsReplay(
      savedA,
      savedB,
      savedChild.geneticsReceipt!,
      { library: SLOP_LIBRARY },
    );
    expect(replay.valid).toBe(true);
    expect(replay.errors).toEqual([]);

    const receiptText = renderGeneticsReceipt(savedChild.geneticsReceipt!, {
      [savedA.id]: savedA.name,
      [savedB.id]: savedB.name,
    });
    expect(receiptText).toContain('GENETICS RECEIPT');
    expect(receiptText).toContain('PARENT A × PARENT B');
    expect(receiptText).toContain('expected lifetime drift 0');

    const reloaded = migrateSpecimen(structuredClone(savedChild));
    expect(reloaded).not.toBeNull();
    expect(reloaded?.geneticsReceipt).toEqual(savedChild.geneticsReceipt);
    expect(reloaded?.lineage).toEqual(savedChild.lineage);
    expect(calculateDrift(reloaded!).score).toBe(0);

    const proposal: MutationProposal = {
      id: 'post-birth-trait',
      kind: 'trait',
      name: 'POST BIRTH CHANGE',
      description: 'Only this child changes after birth.',
      prompt: 'Apply one new post-birth behavior.',
      reason: 'Acceptance test',
      sourceMessageIds: [],
      sourceArtifactIds: [],
      sourceType: 'user',
    };
    const mutatedChild = acquireTrait(savedChild, proposal, 'explicit');

    expect(mutatedChild.acquiredTraits.length).toBe(savedChild.acquiredTraits.length + 1);
    expect(calculateDrift(mutatedChild).score).toBeGreaterThan(0);
    expect(savedA).toEqual(committed.specimens.find(item => item.id === a.id));
    expect(savedB).toEqual(committed.specimens.find(item => item.id === b.id));
    expect(savedChild.acquiredTraits.some(item => item.id === 'post-birth-trait')).toBe(false);
  });

  it('allows repeat siblings with a new seed while FUSE parents still produce STACK children without inherited kernels', async () => {
    let a = parent('fuse-a', 'FUSE A', ['tm-01', 'tm-15'], 1);
    let b = parent('fuse-b', 'FUSE B', ['tm-02', 'tm-03'], 1);

    a = {
      ...a,
      currentGenome: {
        ...a.currentGenome,
        mode: 'fuse',
        compiledKernel: 'PARENT A COMPILED KERNEL',
        compiledAt: 100,
        compilerVersion: 'test',
        customSeed: 'PARENT A CUSTOM SEED',
      },
    };
    b = {
      ...b,
      currentGenome: {
        ...b.currentGenome,
        mode: 'fuse',
        compiledKernel: 'PARENT B COMPILED KERNEL',
        compiledAt: 100,
        compilerVersion: 'test',
        customSeed: 'PARENT B CUSTOM SEED',
      },
    };

    const firstPreview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000081',
      now: 1000,
      idFactory: idFactory('first'),
      library: SLOP_LIBRARY,
    });

    expect(firstPreview.child.currentGenome.mode).toBe('stack');
    expect(firstPreview.child.currentGenome.compiledKernel).toBeUndefined();
    expect(firstPreview.child.currentGenome.customSeed).toBeUndefined();

    const first = await commitBreedingPreview([a, b], firstPreview, {
      now: 2000,
      idFactory: idFactory('first-commit'),
      save: async () => undefined,
    });

    const currentA = first.specimens.find(item => item.id === a.id)!;
    const currentB = first.specimens.find(item => item.id === b.id)!;
    const secondPreview = createBreedingPreview(currentA, currentB, {
      seed: '00000000000000000000000000000082',
      now: 3000,
      idFactory: idFactory('second'),
      library: SLOP_LIBRARY,
    });

    expect(secondPreview.receipt.idempotencyKey).not.toBe(firstPreview.receipt.idempotencyKey);

    const second = await commitBreedingPreview(first.specimens, secondPreview, {
      now: 4000,
      idFactory: idFactory('second-commit'),
      save: async () => undefined,
    });

    const children = second.specimens.filter(item => item.lineage.kind === 'bred');
    expect(children).toHaveLength(2);
    expect(new Set(children.map(item => item.id)).size).toBe(2);
    expect(children.every(child => child.currentGenome.mode === 'stack')).toBe(true);
    expect(children.every(child => child.currentGenome.compiledKernel === undefined)).toBe(true);
  });
});
