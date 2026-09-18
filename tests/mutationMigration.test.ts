import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Genome, GenomeComponent } from '../types';

const storageMocks = vi.hoisted(() => {
  const storage = new Map<string, unknown>();
  const getItem = vi.fn(async (key: string) => storage.get(key) ?? null);
  const setItem = vi.fn(async (key: string, value: unknown) => {
    storage.set(key, value);
    return value;
  });
  return { storage, getItem, setItem };
});

vi.mock('localforage', () => ({
  default: {
    getItem: storageMocks.getItem,
    setItem: storageMocks.setItem,
  },
}));

import {
  MR_SLOP_STORAGE_KEY,
  loadSpecimens,
  migrateSpecimen,
} from '../services/specimenStore';

const component: GenomeComponent = {
  id: 'tm-15',
  name: 'Alien Distance Metrics + Enforced Metric Turnover',
  kind: 'mind',
  version: 'test',
  description: 'changes conceptual distance',
  prompt: 'Define an explicit alien distance metric and select conceptual neighbors using it.',
  tags: ['test'],
  roleHints: ['selection'],
  enabled: true,
  order: 0,
  charWeight: 82,
};

const genome: Genome = {
  id: 'legacy-genome',
  mode: 'stack',
  components: [component],
};

const makeLegacyV1Fixture = () => ({
  schemaVersion: 1 as const,
  id: 'legacy-specimen',
  name: 'OLD LITTLE FREAK',
  phase: 'spawned' as const,
  birthGenome: genome,
  currentGenome: genome,
  messages: [{ id: 'm1', role: 'user', content: 'hello', timestamp: 10 }],
  artifacts: [{
    id: 'a1',
    specimenId: 'legacy-specimen',
    messageId: 'm1',
    kind: 'other',
    title: 'old artifact',
    content: 'artifact body',
    genomeId: 'legacy-genome',
    componentIds: ['tm-15'],
    createdAt: 11,
  }],
  checkpoints: [{
    id: 'c1',
    reason: 'old checkpoint',
    genome,
    createdAt: 12,
  }],
  acquiredTraits: [{
    id: 'legacy-trait',
    name: 'Old habit',
    description: 'A Round 1 trait-shaped record.',
    prompt: 'Keep the useful old habit.',
    createdAt: 13,
  }],
  scars: [],
  trajectory: null,
  controllerState: null,
  metrics: null,
  lineage: null,
  createdAt: 1,
  lastModified: 20,
});

describe('Round 1 specimen migration', () => {
  beforeEach(() => {
    storageMocks.storage.clear();
    storageMocks.getItem.mockClear();
    storageMocks.setItem.mockClear();
  });

  it('migrates a Round 1 specimen into current schema v4', async () => {
    const old = makeLegacyV1Fixture();
    storageMocks.storage.set(MR_SLOP_STORAGE_KEY, [old]);

    const [migrated] = await loadSpecimens();

    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.birthGenome).toEqual(old.birthGenome);
    expect(migrated.currentGenome).toEqual(old.currentGenome);
    expect(migrated.messages).toEqual(old.messages);
    expect(migrated.artifacts).toEqual(old.artifacts);
    expect(migrated.infections).toEqual([]);
    expect(migrated.lifeHistory).toEqual([]);
    expect(migrated.acquiredTraits).toHaveLength(1);
    expect(migrated.acquiredTraits[0]).toMatchObject({
      id: 'legacy-trait',
      name: 'Old habit',
      status: 'active',
      originType: 'explicit',
    });
    expect(migrated.checkpoints[0].acquiredTraits).toEqual([]);
    expect(migrated.checkpoints[0].infections).toEqual([]);
  });

  it('accepts current schema through the explicit migration function without aliasing nested state', () => {
    const old = makeLegacyV1Fixture();
    const migrated = migrateSpecimen(old);
    expect(migrated).not.toBeNull();
    if (!migrated) return;

    const remigrated = migrateSpecimen(migrated);
    expect(remigrated).not.toBeNull();
    if (!remigrated) return;

    expect(remigrated).not.toBe(migrated);
    expect(remigrated.birthGenome).not.toBe(migrated.birthGenome);
    expect(remigrated.acquiredTraits).not.toBe(migrated.acquiredTraits);
    expect(remigrated.infections).not.toBe(migrated.infections);
    expect(remigrated.lifeHistory).not.toBe(migrated.lifeHistory);
  });

  it('ignores malformed objects rather than partially migrating them', async () => {
    storageMocks.storage.set(MR_SLOP_STORAGE_KEY, [
      { schemaVersion: 1, id: 'missing-most-fields' },
      { schemaVersion: 2, id: 'also-bad' },
    ]);

    expect(await loadSpecimens()).toEqual([]);
    expect(migrateSpecimen({ schemaVersion: 999, id: 'nope' })).toBeNull();
  });
});
