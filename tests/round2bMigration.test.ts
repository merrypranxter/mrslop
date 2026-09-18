import { describe, expect, it } from 'vitest';
import { captureBirthBaseline, makeSpecimen, migrateSpecimen } from '../services/specimenStore';
import { Genome } from '../types';

const genome: Genome = {
  id: 'g-v2',
  mode: 'stack',
  components: [],
};

const v2Fixture = () => ({
  schemaVersion: 2 as const,
  id: 'specimen-v2',
  name: 'ROUND 2A GREMLIN',
  phase: 'spawned' as const,
  birthGenome: genome,
  currentGenome: { ...genome, id: 'g-current' },
  messages: [{ id: 'm1', role: 'user', content: 'keep me', timestamp: 10 }],
  artifacts: [{
    id: 'a1',
    specimenId: 'specimen-v2',
    kind: 'other',
    title: 'artifact',
    content: 'body',
    genomeId: 'g-current',
    componentIds: [],
    createdAt: 11,
  }],
  checkpoints: [{
    id: 'c1',
    reason: 'known good',
    genome,
    acquiredTraits: [],
    infections: [],
    createdAt: 12,
  }],
  acquiredTraits: [{
    id: 't-active',
    name: 'Active old trait',
    description: 'Already active before schema v3 existed.',
    prompt: 'Keep the old trait.',
    status: 'active',
    originType: 'explicit',
    provenance: {
      specimenId: 'specimen-v2',
      genomeId: 'g-current',
      sourceType: 'conversation',
      sourceMessageIds: ['m1'],
      sourceArtifactIds: ['a1'],
    },
    createdAt: 13,
  }, {
    id: 't-retired',
    name: 'Retired old trait',
    description: 'Already retired.',
    prompt: 'Old retired thing.',
    status: 'retired',
    originType: 'explicit',
    provenance: {
      specimenId: 'specimen-v2',
      genomeId: 'g-current',
      sourceType: 'conversation',
      sourceMessageIds: [],
      sourceArtifactIds: [],
    },
    createdAt: 14,
    retiredAt: 15,
  }],
  infections: [{
    id: 'i-active',
    name: 'Old active infection',
    description: 'Still running at migration.',
    prompt: 'Temporary old rule.',
    status: 'active',
    durationMode: 'turns',
    durationTurns: 5,
    remainingTurns: 2,
    provenance: {
      specimenId: 'specimen-v2',
      genomeId: 'g-current',
      sourceType: 'mr-slop',
      sourceMessageIds: [],
      sourceArtifactIds: [],
    },
    createdAt: 16,
  }, {
    id: 'i-expired',
    name: 'Old expired infection',
    description: 'Already over.',
    prompt: 'Expired rule.',
    status: 'expired',
    durationMode: 'turns',
    durationTurns: 1,
    remainingTurns: 0,
    provenance: {
      specimenId: 'specimen-v2',
      genomeId: 'g-current',
      sourceType: 'mr-slop',
      sourceMessageIds: [],
      sourceArtifactIds: [],
    },
    createdAt: 17,
    endedAt: 18,
    endReason: 'duration completed',
  }],
  lifeHistory: [{
    id: 'h1',
    type: 'trait-acquired',
    summary: 'old history',
    mutationId: 't-active',
    messageIds: ['m1'],
    artifactIds: ['a1'],
    createdAt: 13,
  }],
  scars: [{ mystery: true }],
  trajectory: null,
  controllerState: null,
  metrics: null,
  lineage: null,
  createdAt: 1,
  lastModified: 20,
});

describe('Round 2B schema v3 migration', () => {
  it('migrates v2 without losing Round 2A state', () => {
    const old = v2Fixture();
    const migrated = migrateSpecimen(old);

    expect(migrated).not.toBeNull();
    if (!migrated) return;

    expect(migrated.schemaVersion).toBe(3);
    expect(migrated.id).toBe(old.id);
    expect(migrated.messages).toEqual(old.messages);
    expect(migrated.artifacts).toEqual(old.artifacts);
    expect(migrated.acquiredTraits).toEqual(old.acquiredTraits);
    expect(migrated.infections).toEqual(old.infections);
    expect(migrated.lifeHistory).toEqual(old.lifeHistory);
    expect(migrated.lineage).toEqual({
      rootSpecimenId: old.id,
      parentSpecimenId: null,
      generation: 0,
      source: 'migrated-v2',
    });
    expect(migrated.birthBaseline.source).toBe('migrated-v2');
    expect(migrated.birthBaseline.genome).toEqual(old.birthGenome);
    expect(migrated.birthBaseline.activeTraitIds).toEqual(['t-active']);
    expect(migrated.birthBaseline.activeInfectionIds).toEqual(['i-active']);
  });

  it('does not fabricate typed scars from opaque v2 placeholder data', () => {
    const migrated = migrateSpecimen(v2Fixture());
    expect(migrated?.scars).toEqual([]);
    expect(migrated?.birthBaseline.inheritedScarIds).toEqual([]);
  });

  it('creates native-v3 roots with a zero-drift birth baseline', () => {
    const specimen = makeSpecimen(genome, 'ROOT');

    expect(specimen.schemaVersion).toBe(3);
    expect(specimen.lineage).toEqual({
      rootSpecimenId: specimen.id,
      parentSpecimenId: null,
      generation: 0,
      source: 'native-v3',
    });
    expect(specimen.birthBaseline.source).toBe('native-v3');
    expect(specimen.birthBaseline.genome).toEqual(specimen.birthGenome);
    expect(specimen.birthBaseline.activeTraitIds).toEqual([]);
    expect(specimen.birthBaseline.activeInfectionIds).toEqual([]);
    expect(specimen.birthBaseline.inheritedScarIds).toEqual([]);
  });

  it('captures the final baseline for a building specimen when it spawns', () => {
    const empty: Genome = { id: 'empty', mode: 'stack', components: [] };
    const installed: Genome = { id: 'installed', mode: 'stack', components: [] };
    const building = makeSpecimen(empty, 'NEW SPECIMEN', 'building');

    const baseline = captureBirthBaseline(building, installed, 'native-v3', 1234);

    expect(baseline.capturedAt).toBe(1234);
    expect(baseline.source).toBe('native-v3');
    expect(baseline.genome).toEqual(installed);
    expect(baseline.genome).not.toBe(installed);
    expect(baseline.activeTraitIds).toEqual([]);
    expect(baseline.activeInfectionIds).toEqual([]);
    expect(baseline.inheritedScarIds).toEqual([]);
  });
});
