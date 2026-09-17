import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Genome, GenomeComponent } from '../types';

const storage = new Map<string, unknown>();
const getItem = vi.fn(async (key: string) => storage.get(key) ?? null);
const setItem = vi.fn(async (key: string, value: unknown) => {
  storage.set(key, value);
  return value;
});

vi.mock('localforage', () => ({
  default: { getItem, setItem },
}));

import {
  MR_SLOP_STORAGE_KEY,
  checkpointSpecimen,
  loadSpecimens,
  makeSpecimen,
  saveSpecimens,
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
  id: 'genome-1',
  mode: 'stack',
  components: [component],
};

describe('specimenStore', () => {
  beforeEach(() => {
    storage.clear();
    getItem.mockClear();
    setItem.mockClear();
  });

  it('uses a Mr. Slop-specific storage key', () => {
    expect(MR_SLOP_STORAGE_KEY).toBe('mrslop_specimens_v1');
  });

  it('creates independent birth/current genome snapshots', () => {
    const specimen = makeSpecimen(genome, 'Metric Gremlin');
    expect(specimen.schemaVersion).toBe(1);
    expect(specimen.phase).toBe('spawned');
    expect(specimen.birthGenome).not.toBe(specimen.currentGenome);
    expect(specimen.birthGenome.components[0]).not.toBe(specimen.currentGenome.components[0]);
    expect(specimen.birthGenome.id).toBe('genome-1');
    expect(specimen.currentGenome.id).toBe('genome-1');
    expect(specimen.name).toBe('Metric Gremlin');
  });

  it('creates an empty genome specimen in building phase', () => {
    const specimen = makeSpecimen({ id: 'empty', mode: 'stack', components: [] });
    expect(specimen.phase).toBe('building');
  });

  it('checkpoints the current genome without mutating the original specimen', () => {
    const specimen = makeSpecimen(genome);
    const checkpointed = checkpointSpecimen(specimen, 'before mutation');
    expect(specimen.checkpoints).toHaveLength(0);
    expect(checkpointed.checkpoints).toHaveLength(1);
    expect(checkpointed.checkpoints[0].reason).toBe('before mutation');
    expect(checkpointed.checkpoints[0].genome).not.toBe(specimen.currentGenome);
    expect(checkpointed.checkpoints[0].genome.components[0]).not.toBe(specimen.currentGenome.components[0]);
  });

  it('saves and loads specimens only under the Mr. Slop key', async () => {
    const specimen = makeSpecimen(genome);
    await saveSpecimens([specimen]);
    expect(setItem).toHaveBeenCalledWith(MR_SLOP_STORAGE_KEY, [specimen]);

    const loaded = await loadSpecimens();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(specimen.id);
    expect(getItem).toHaveBeenCalledWith(MR_SLOP_STORAGE_KEY);
    expect(getItem).not.toHaveBeenCalledWith('ghost_sessions');
  });

  it('returns an empty list for missing or corrupt stored data', async () => {
    expect(await loadSpecimens()).toEqual([]);

    storage.set(MR_SLOP_STORAGE_KEY, { not: 'an array' });
    expect(await loadSpecimens()).toEqual([]);

    storage.set(MR_SLOP_STORAGE_KEY, [{ schemaVersion: 999 }]);
    expect(await loadSpecimens()).toEqual([]);
  });
});
