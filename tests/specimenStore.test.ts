import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Genome, GenomeComponent, Role } from '../types';

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
  checkpointSpecimen,
  loadSpecimens,
  makeSpecimen,
  restoreCheckpoint,
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
    storageMocks.storage.clear();
    storageMocks.getItem.mockClear();
    storageMocks.setItem.mockClear();
  });

  it('uses the existing Mr. Slop storage key so Round 1 specimens can migrate in place', () => {
    expect(MR_SLOP_STORAGE_KEY).toBe('mrslop_specimens_v1');
  });

  it('creates mutation-capable specimens with independent birth/current genome snapshots', () => {
    const specimen = makeSpecimen(genome, 'Metric Gremlin');
    expect(specimen.schemaVersion).toBe(3);
    expect(specimen.phase).toBe('spawned');
    expect(specimen.birthGenome).not.toBe(specimen.currentGenome);
    expect(specimen.birthGenome.components[0]).not.toBe(specimen.currentGenome.components[0]);
    expect(specimen.birthGenome.id).toBe('genome-1');
    expect(specimen.currentGenome.id).toBe('genome-1');
    expect(specimen.name).toBe('Metric Gremlin');
    expect(specimen.infections).toEqual([]);
    expect(specimen.acquiredTraits).toEqual([]);
    expect(specimen.lifeHistory).toHaveLength(1);
    expect(specimen.lifeHistory[0]).toMatchObject({ type: 'specimen-born' });
  });

  it('creates an empty genome specimen in building phase', () => {
    const specimen = makeSpecimen({ id: 'empty', mode: 'stack', components: [] });
    expect(specimen.phase).toBe('building');
  });

  it('checkpoints genome plus mutation state without mutating the original specimen', () => {
    const specimen = makeSpecimen(genome);
    specimen.acquiredTraits.push({
      id: 'trait-1',
      name: 'Keep the wobble',
      description: 'Persist a useful wobble.',
      prompt: 'Preserve the wobble.',
      status: 'active',
      originType: 'explicit',
      provenance: {
        specimenId: specimen.id,
        genomeId: specimen.currentGenome.id,
        sourceType: 'user',
        sourceMessageIds: [],
        sourceArtifactIds: [],
      },
      createdAt: 1,
    });
    specimen.infections.push({
      id: 'infection-1',
      name: 'Temporary wrong ruler',
      description: 'Measure conceptual distance incorrectly for a while.',
      prompt: 'Use a deliberately alien distance metric.',
      status: 'active',
      durationMode: 'turns',
      durationTurns: 3,
      remainingTurns: 3,
      provenance: {
        specimenId: specimen.id,
        genomeId: specimen.currentGenome.id,
        sourceType: 'mr-slop',
        sourceMessageIds: [],
        sourceArtifactIds: [],
      },
      createdAt: 2,
    });

    const checkpointed = checkpointSpecimen(specimen, 'before mutation');
    expect(specimen.checkpoints).toHaveLength(0);
    expect(checkpointed.checkpoints).toHaveLength(1);
    const checkpoint = checkpointed.checkpoints[0];
    expect(checkpoint.reason).toBe('before mutation');
    expect(checkpoint.genome).not.toBe(specimen.currentGenome);
    expect(checkpoint.genome.components[0]).not.toBe(specimen.currentGenome.components[0]);
    expect(checkpoint.acquiredTraits).toEqual(specimen.acquiredTraits);
    expect(checkpoint.acquiredTraits).not.toBe(specimen.acquiredTraits);
    expect(checkpoint.infections).toEqual(specimen.infections);
    expect(checkpoint.infections).not.toBe(specimen.infections);
  });

  it('restores full structural state while preserving conversation and appending history', () => {
    const original = makeSpecimen(genome, 'Restore Gremlin');
    const checkpointed = checkpointSpecimen(original, 'known good');
    const checkpointId = checkpointed.checkpoints[0].id;
    const changed = {
      ...checkpointed,
      currentGenome: { id: 'changed', mode: 'stack' as const, components: [] },
      acquiredTraits: [{
        id: 'new-trait',
        name: 'Bad mutation',
        description: 'temporary bad idea',
        prompt: 'Do the bad idea.',
        status: 'active' as const,
        originType: 'explicit' as const,
        provenance: {
          specimenId: original.id,
          genomeId: 'changed',
          sourceType: 'user' as const,
          sourceMessageIds: [],
          sourceArtifactIds: [],
        },
        createdAt: 3,
      }],
      infections: [],
      messages: [{ id: 'm-later', role: Role.USER, content: 'do not lose me', timestamp: 5 }],
      artifacts: [{
        id: 'a-later',
        specimenId: original.id,
        kind: 'other' as const,
        title: 'keep me',
        content: 'artifact',
        genomeId: 'changed',
        componentIds: [],
        createdAt: 6,
      }],
    };

    const restored = restoreCheckpoint(changed, checkpointId);

    expect(restored.currentGenome).toEqual(original.currentGenome);
    expect(restored.acquiredTraits).toEqual(original.acquiredTraits);
    expect(restored.infections).toEqual(original.infections);
    expect(restored.messages).toEqual(changed.messages);
    expect(restored.artifacts).toEqual(changed.artifacts);
    expect(restored.lifeHistory.at(-1)).toMatchObject({
      type: 'checkpoint-restored',
      checkpointId,
    });
  });

  it('saves and loads specimens only under the Mr. Slop key', async () => {
    const specimen = makeSpecimen(genome);
    await saveSpecimens([specimen]);
    expect(storageMocks.setItem).toHaveBeenCalledWith(MR_SLOP_STORAGE_KEY, [specimen]);

    const loaded = await loadSpecimens();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe(specimen.id);
    expect(storageMocks.getItem).toHaveBeenCalledWith(MR_SLOP_STORAGE_KEY);
    expect(storageMocks.getItem).not.toHaveBeenCalledWith('ghost_sessions');
  });

  it('returns an empty list for missing or corrupt stored data', async () => {
    expect(await loadSpecimens()).toEqual([]);

    storageMocks.storage.set(MR_SLOP_STORAGE_KEY, { not: 'an array' });
    expect(await loadSpecimens()).toEqual([]);

    storageMocks.storage.set(MR_SLOP_STORAGE_KEY, [{ schemaVersion: 999 }]);
    expect(await loadSpecimens()).toEqual([]);
  });
});
