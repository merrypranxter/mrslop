import { describe, expect, it } from 'vitest';
import { createGenome } from '../lib/genome';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen, migrateSpecimen } from '../services/specimenStore';

const makeV3Root = () => {
  const specimen = makeSpecimen(
    createGenome(['tm-01'], SLOP_LIBRARY, 'stack'),
    'V3 ROOT',
    'spawned',
  );

  return {
    ...specimen,
    schemaVersion: 3 as const,
    birthBaseline: {
      ...specimen.birthBaseline,
      source: 'native-v3' as const,
    },
    lineage: {
      rootSpecimenId: specimen.id,
      parentSpecimenId: null,
      generation: 0,
      source: 'native-v3' as const,
    },
  };
};

const makeV3Fork = () => {
  const root = makeV3Root();
  const childId = 'legacy-v3-fork';

  return {
    ...root,
    schemaVersion: 3 as const,
    id: childId,
    name: 'V3 FORK',
    birthBaseline: {
      ...root.birthBaseline,
      source: 'fork-v3' as const,
    },
    lineage: {
      rootSpecimenId: root.id,
      parentSpecimenId: root.id,
      generation: 1,
      forkedAt: 5000,
      forkSourceEventId: 'fork-event',
      forkSourceGenomeId: root.currentGenome.id,
      source: 'fork-v3' as const,
    },
    acquiredTraits: [{
      id: 'legacy-fork-trait',
      name: 'Inherited old trait',
      description: 'A trait inherited before schema v4.',
      prompt: 'Keep the inherited old behavior.',
      status: 'active' as const,
      originType: 'explicit' as const,
      provenance: {
        specimenId: root.id,
        genomeId: root.currentGenome.id,
        sourceType: 'conversation' as const,
        sourceMessageIds: [],
        sourceArtifactIds: [],
      },
      inheritedFrom: {
        specimenId: root.id,
        recordId: 'source-trait',
        inheritedAt: 5000,
      },
      createdAt: 5000,
    }],
  };
};

describe('Round 2C schema v4 migration', () => {
  it('migrates a v3 root into a v4 root without inventing parents', () => {
    const old = makeV3Root();
    const migrated = migrateSpecimen(old);

    expect(migrated).not.toBeNull();
    if (!migrated) return;

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.id).toBe(old.id);
    expect(migrated.lineage).toEqual({
      kind: 'root',
      parentSpecimenIds: [],
      rootSpecimenIds: [old.id],
      generation: 0,
      source: 'migrated-v3',
    });
    expect(migrated.messages).toEqual(old.messages);
    expect(migrated.artifacts).toEqual(old.artifacts);
    expect(migrated.checkpoints).toEqual(old.checkpoints);
    expect(migrated.birthGenome).toEqual(old.birthGenome);
    expect(migrated.currentGenome).toEqual(old.currentGenome);
    expect(migrated.birthBaseline).toEqual(old.birthBaseline);
    expect(migrated.scars).toEqual(old.scars);
    expect(migrated.geneticsReceipt).toBeUndefined();
  });

  it('migrates a v3 fork into one-parent v4 lineage without inventing a second root', () => {
    const old = makeV3Fork();
    const migrated = migrateSpecimen(old);

    expect(migrated).not.toBeNull();
    if (!migrated) return;

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.lineage).toMatchObject({
      kind: 'fork',
      parentSpecimenIds: [old.lineage.parentSpecimenId],
      rootSpecimenIds: [old.lineage.rootSpecimenId],
      generation: 1,
      forkedAt: 5000,
      forkSourceEventId: old.lineage.forkSourceEventId,
      forkSourceGenomeId: old.lineage.forkSourceGenomeId,
      source: 'migrated-v3',
    });
    expect(migrated.lineage.parentSpecimenIds).toHaveLength(1);
    expect(migrated.lineage.rootSpecimenIds).toHaveLength(1);
  });

  it('converts singular fork inheritance into a source list and preserves factual origin', () => {
    const old = makeV3Fork();
    const migrated = migrateSpecimen(old);

    expect(migrated).not.toBeNull();
    if (!migrated) return;

    expect(migrated.acquiredTraits).toHaveLength(1);
    expect(migrated.acquiredTraits[0].inheritanceSources).toEqual([{
      specimenId: old.lineage.parentSpecimenId,
      recordId: 'source-trait',
      inheritedAt: 5000,
    }]);
    expect((migrated.acquiredTraits[0] as any).inheritedFrom).toBeUndefined();
    expect(migrated.acquiredTraits[0].originType).toBe('explicit');
  });

  it('creates new native specimens directly as schema v4 roots', () => {
    const specimen = makeSpecimen(
      createGenome(['tm-01'], SLOP_LIBRARY, 'stack'),
      'V4 ROOT',
      'spawned',
    );

    expect(specimen.schemaVersion).toBe(4);
    expect(specimen.lineage).toEqual({
      kind: 'root',
      parentSpecimenIds: [],
      rootSpecimenIds: [specimen.id],
      generation: 0,
      source: 'native-v4',
    });
  });

  it('keeps the existing storage key contract stable', async () => {
    const store = await import('../services/specimenStore');
    expect(store.MR_SLOP_STORAGE_KEY).toBe('mrslop_specimens_v1');
  });
});
