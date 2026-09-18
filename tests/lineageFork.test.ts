import { describe, expect, it } from 'vitest';
import { forkSpecimen, nextForkName } from '../lib/lineage';
import { checkpointSpecimen, makeSpecimen } from '../services/specimenStore';
import {
  AcquiredTrait,
  Genome,
  Infection,
  Role,
  Scar,
  Specimen,
} from '../types';

const genome: Genome = {
  id: 'g-parent',
  mode: 'stack',
  components: [{
    id: 'tm-15',
    name: 'Alien Distance',
    kind: 'mind',
    version: 'test',
    description: 'distance',
    prompt: 'Use an alien metric.',
    tags: [],
    roleHints: [],
    enabled: true,
    order: 0,
    charWeight: 20,
  }],
};

const provenance = (specimen: Specimen) => ({
  specimenId: specimen.id,
  genomeId: specimen.currentGenome.id,
  sourceType: 'conversation' as const,
  sourceMessageIds: ['m-old'],
  sourceArtifactIds: ['a-old'],
});

const activeTrait = (specimen: Specimen, id: string, createdAt: number): AcquiredTrait => ({
  id,
  name: `Trait ${id}`,
  description: `Active trait ${id}`,
  prompt: `Prompt ${id}`,
  status: 'active',
  originType: 'explicit',
  provenance: provenance(specimen),
  createdAt,
});

const retiredTrait = (specimen: Specimen): AcquiredTrait => ({
  ...activeTrait(specimen, 'trait-retired', 3),
  status: 'retired',
  retiredAt: 4,
});

const activeInfection = (specimen: Specimen): Infection => ({
  id: 'infection-active',
  name: 'Metric Vertigo',
  description: 'Temporary wrong ruler.',
  prompt: 'Use a wrong ruler.',
  status: 'active',
  durationMode: 'turns',
  durationTurns: 5,
  remainingTurns: 3,
  provenance: provenance(specimen),
  createdAt: 5,
});

const expiredInfection = (specimen: Specimen): Infection => ({
  ...activeInfection(specimen),
  id: 'infection-expired',
  name: 'Old infection',
  status: 'expired',
  remainingTurns: 0,
  endedAt: 6,
  endReason: 'duration completed',
});

const scar = (specimen: Specimen, id: string, kind: Scar['kind']): Scar => ({
  id,
  name: `Scar ${id}`,
  description: `Historical mark ${id}`,
  kind,
  origin: 'experienced',
  createdAt: 7,
  sourceSpecimenId: specimen.id,
  relatedEventIds: ['event-old'],
  relatedMutationIds: [],
  relatedCheckpointIds: [],
  messageIds: ['m-old'],
  artifactIds: ['a-old'],
});

const complexParent = (): Specimen => {
  const base = makeSpecimen(genome, 'PARENT SLOP');
  const checkpointed = checkpointSpecimen(base, 'parent checkpoint');
  return {
    ...checkpointed,
    messages: [
      { id: 'm-old', role: Role.USER, content: 'old parent chat', timestamp: 10 },
      { id: 'm-model', role: Role.MODEL, content: 'old response', timestamp: 11 },
    ],
    artifacts: [{
      id: 'a-old',
      specimenId: base.id,
      messageId: 'm-model',
      kind: 'other',
      title: 'Parent artifact',
      content: 'do not copy me',
      genomeId: base.currentGenome.id,
      componentIds: ['tm-15'],
      createdAt: 12,
    }],
    acquiredTraits: [
      activeTrait(base, 'trait-a', 1),
      activeTrait(base, 'trait-b', 2),
      retiredTrait(base),
    ],
    infections: [
      activeInfection(base),
      expiredInfection(base),
    ],
    scars: [
      scar(base, 'scar-1', 'infection-survived'),
      scar(base, 'scar-2', 'fossilized-accident'),
    ],
  };
};

describe('specimen fork engine', () => {
  it('forks only active state into child-local records without mutating the input parent', () => {
    const parent = complexParent();
    const before = structuredClone(parent);

    const { parent: updatedParent, child } = forkSpecimen(parent, 'PARENT SLOP / FORK 1', 1000);

    expect(parent).toEqual(before);
    expect(child.id).not.toBe(parent.id);
    expect(child.name).toBe('PARENT SLOP / FORK 1');
    expect(child.lineage).toMatchObject({
      kind: 'fork',
      rootSpecimenIds: parent.lineage.rootSpecimenIds,
      parentSpecimenIds: [parent.id],
      generation: parent.lineage.generation + 1,
      forkedAt: 1000,
      forkSourceGenomeId: parent.currentGenome.id,
      source: 'fork-v4',
    });

    expect(child.birthGenome).toEqual(parent.currentGenome);
    expect(child.currentGenome).toEqual(parent.currentGenome);
    expect(child.birthGenome).not.toBe(parent.currentGenome);
    expect(child.currentGenome).not.toBe(child.birthGenome);

    const parentActiveTraits = parent.acquiredTraits.filter(item => item.status === 'active');
    expect(child.acquiredTraits).toHaveLength(2);
    expect(child.acquiredTraits.every(item => item.status === 'active')).toBe(true);
    expect(child.acquiredTraits.map(item => item.id)).not.toEqual(parentActiveTraits.map(item => item.id));
    expect(child.acquiredTraits.map(item => item.inheritanceSources?.[0])).toEqual(
      parentActiveTraits.map(item => ({
        specimenId: parent.id,
        recordId: item.id,
        inheritedAt: 1000,
      })),
    );

    expect(child.infections).toHaveLength(1);
    expect(child.infections[0]).toMatchObject({
      name: 'Metric Vertigo',
      status: 'active',
      remainingTurns: 3,
      inheritanceSources: [{
        specimenId: parent.id,
        recordId: 'infection-active',
        inheritedAt: 1000,
      }],
    });
    expect(child.infections[0].id).not.toBe('infection-active');

    expect(child.artifacts).toEqual([]);
    expect(child.checkpoints).toEqual([]);
    expect(child.messages).toHaveLength(1);
    expect(child.messages[0].role).toBe(Role.SYSTEM);
    expect(child.messages[0].content).toContain('PARENT SLOP');
    expect(child.messages[0].content).toContain('2 active acquired traits');
    expect(child.messages[0].content).toContain('1 active infection');

    expect(updatedParent.currentGenome).toEqual(parent.currentGenome);
    expect(updatedParent.acquiredTraits).toEqual(parent.acquiredTraits);
    expect(updatedParent.infections).toEqual(parent.infections);
    expect(updatedParent.lifeHistory.at(-1)).toMatchObject({
      type: 'specimen-forked',
      relatedSpecimenId: child.id,
    });
    expect(child.lifeHistory.some(event => event.type === 'specimen-born-from-fork')).toBe(true);
  });

  it('creates child-local inherited scars plus a fork-birth ancestry scar in the baseline', () => {
    const parent = complexParent();
    const { child } = forkSpecimen(parent, 'CHILD', 1000);

    expect(child.scars).toHaveLength(3);
    expect(child.scars.every(item => item.origin === 'inherited')).toBe(true);

    const inherited = child.scars.filter(item => item.kind !== 'fork-birth');
    expect(inherited.map(item => item.id)).not.toEqual(parent.scars.map(item => item.id));
    expect(inherited.map(item => item.sourceScarId)).toEqual(parent.scars.map(item => item.id));
    expect(inherited.every(item => item.sourceSpecimenId === parent.id)).toBe(true);
    expect(inherited.every(item => item.inheritedAt === 1000)).toBe(true);

    const birthScar = child.scars.find(item => item.kind === 'fork-birth');
    expect(birthScar).toMatchObject({
      origin: 'inherited',
      sourceSpecimenId: parent.id,
      inheritedAt: 1000,
    });

    expect(child.birthBaseline.source).toBe('fork-v4');
    expect(child.birthBaseline.capturedAt).toBe(1000);
    expect(child.birthBaseline.activeTraitIds).toEqual(child.acquiredTraits.map(item => item.id));
    expect(child.birthBaseline.activeInfectionIds).toEqual(child.infections.map(item => item.id));
    expect([...child.birthBaseline.inheritedScarIds].sort())
      .toEqual(child.scars.map(item => item.id).sort());

    expect(child.lifeHistory.filter(event => event.type === 'scar-inherited'))
      .toHaveLength(child.scars.length);
  });

  it('copies a persisted FUSE kernel without recompilation or rewriting it', () => {
    const parent = complexParent();
    parent.currentGenome = {
      ...parent.currentGenome,
      mode: 'fuse',
      compiledKernel: 'PERSISTED_PARENT_FUSE_KERNEL',
      compiledAt: 123,
      compilerVersion: 'fuse-test',
    };

    const { child } = forkSpecimen(parent, 'FUSED CHILD', 1000);

    expect(child.currentGenome.compiledKernel).toBe('PERSISTED_PARENT_FUSE_KERNEL');
    expect(child.birthGenome.compiledKernel).toBe('PERSISTED_PARENT_FUSE_KERNEL');
    expect(child.currentGenome.compiledAt).toBe(123);
    expect(child.currentGenome.compilerVersion).toBe('fuse-test');
  });

  it('chooses fork names from actual direct-child lineage rather than unrelated names', () => {
    const parent = complexParent();
    const unrelated = makeSpecimen(genome, 'PARENT SLOP / FORK 99');
    const { child: firstChild } = forkSpecimen(parent, 'CUSTOM CHILD', 1000);

    expect(nextForkName(parent, [parent, unrelated])).toBe('PARENT SLOP / FORK 1');
    expect(nextForkName(parent, [parent, unrelated, firstChild]))
      .toBe('PARENT SLOP / FORK 2');
  });

  it('rejects forking a building specimen because it has no final active identity yet', () => {
    const building = makeSpecimen({ id: 'empty', mode: 'stack', components: [] }, 'BUILDING', 'building');
    expect(() => forkSpecimen(building, 'NOPE', 1000)).toThrow('CANNOT_FORK_BUILDING_SPECIMEN');
  });
});
