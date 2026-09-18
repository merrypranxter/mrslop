import { describe, expect, it } from 'vitest';
import { bandForScore, calculateDrift } from '../lib/drift';
import { forkSpecimen } from '../lib/lineage';
import { makeSpecimen } from '../services/specimenStore';
import {
  AcquiredTrait,
  Genome,
  GenomeComponent,
  Infection,
  LifeHistoryEvent,
  Scar,
  Specimen,
} from '../types';

const component = (id: string, order = 0): GenomeComponent => ({
  id,
  name: id,
  kind: 'mind',
  version: 'test',
  description: id,
  prompt: id,
  tags: [],
  roleHints: [],
  enabled: true,
  order,
  charWeight: id.length,
});

const genome = (ids: string[] = ['a'], mode: Genome['mode'] = 'stack'): Genome => ({
  id: `g-${ids.join('-') || 'empty'}-${mode}`,
  mode,
  components: ids.map((id, index) => component(id, index)),
});

const provenance = (specimen: Specimen) => ({
  specimenId: specimen.id,
  genomeId: specimen.currentGenome.id,
  sourceType: 'user' as const,
  sourceMessageIds: [],
  sourceArtifactIds: [],
});

const trait = (
  specimen: Specimen,
  id: string,
  status: AcquiredTrait['status'],
  createdAt: number,
  retiredAt?: number,
): AcquiredTrait => ({
  id,
  name: id,
  description: id,
  prompt: id,
  status,
  originType: 'explicit',
  provenance: provenance(specimen),
  createdAt,
  ...(retiredAt !== undefined ? { retiredAt } : {}),
});

const infection = (specimen: Specimen, id: string, createdAt: number): Infection => ({
  id,
  name: id,
  description: id,
  prompt: id,
  status: 'active',
  durationMode: 'indefinite',
  provenance: provenance(specimen),
  createdAt,
});

const history = (
  type: LifeHistoryEvent['type'],
  id: string,
  createdAt: number,
  mutationId?: string,
): LifeHistoryEvent => ({
  id,
  type,
  summary: id,
  ...(mutationId ? { mutationId } : {}),
  messageIds: [],
  artifactIds: [],
  createdAt,
});

const scar = (
  specimen: Specimen,
  id: string,
  origin: Scar['origin'],
  createdAt: number,
): Scar => ({
  id,
  name: id,
  description: id,
  kind: 'infection-survived',
  origin,
  createdAt,
  sourceSpecimenId: specimen.id,
  relatedEventIds: [],
  relatedMutationIds: [],
  relatedCheckpointIds: [],
  messageIds: [],
  artifactIds: [],
});

describe('deterministic lifetime drift', () => {
  it('returns zero LOW drift for a new root specimen', () => {
    const specimen = makeSpecimen(genome(['a']), 'ROOT');
    const report = calculateDrift(specimen);

    expect(report.score).toBe(0);
    expect(report.band).toBe('LOW');
    expect(report.dimensions).toMatchObject({
      genomeComponentDelta: 0,
      genomeModeChanged: false,
      customSeedChanged: false,
      activeLifetimeTraits: 0,
      retiredLifetimeTraits: 0,
      lifetimeInfections: 0,
      experiencedScars: 0,
      checkpointRestores: 0,
      generation: 0,
    });
  });

  it('returns zero lifetime drift immediately after a fork despite inherited active state and scars', () => {
    const parent = makeSpecimen(genome(['a', 'b']), 'PARENT');
    parent.acquiredTraits = [trait(parent, 'inherited-trait-source', 'active', 10)];
    parent.infections = [infection(parent, 'inherited-infection-source', 11)];
    parent.scars = [scar(parent, 'old-parent-scar', 'experienced', 12)];

    const { child } = forkSpecimen(parent, 'CHILD', 1000);
    const report = calculateDrift(child);

    expect(report.score).toBe(0);
    expect(report.band).toBe('LOW');
    expect(report.dimensions.generation).toBe(1);
    expect(report.dimensions.activeLifetimeTraits).toBe(0);
    expect(report.dimensions.lifetimeInfections).toBe(0);
    expect(report.dimensions.experiencedScars).toBe(0);
    expect(child.scars.every(item => item.origin === 'inherited')).toBe(true);
  });

  it('weights one genome component change more than one temporary infection', () => {
    const baseGenome = genome(['a']);

    const genomeChanged = makeSpecimen(baseGenome, 'GENOME');
    genomeChanged.currentGenome = genome(['a', 'b']);

    const infectionOnly = makeSpecimen(baseGenome, 'INFECTION');
    infectionOnly.lifeHistory.push(
      history('infection-started', 'infection-started-1', infectionOnly.birthBaseline.capturedAt + 1, 'i-1'),
    );

    expect(calculateDrift(genomeChanged).score).toBe(4);
    expect(calculateDrift(infectionOnly).score).toBe(1);
    expect(calculateDrift(genomeChanged).score)
      .toBeGreaterThan(calculateDrift(infectionOnly).score);
  });

  it('scores exact genome, trait, infection, scar, and restore dimensions', () => {
    const specimen = makeSpecimen(genome(['a']), 'COMPOSITE');
    const after = specimen.birthBaseline.capturedAt + 1;

    specimen.currentGenome = {
      ...genome(['a', 'b'], 'fuse'),
      customSeed: 'new seed',
      compiledKernel: 'fused',
    };
    specimen.acquiredTraits = [
      trait(specimen, 'active-lifetime', 'active', after),
      trait(specimen, 'retired-lifetime', 'retired', after, after + 1),
    ];
    specimen.lifeHistory.push(
      history('infection-started', 'start-1', after, 'i-1'),
      history('infection-started', 'start-2', after + 1, 'i-2'),
      history('checkpoint-restored', 'restore-1', after + 2),
    );
    specimen.scars = [
      scar(specimen, 'experienced-1', 'experienced', after),
      scar(specimen, 'inherited-no-score', 'inherited', after),
    ];

    const report = calculateDrift(specimen);

    expect(report.dimensions).toMatchObject({
      genomeComponentDelta: 1,
      genomeModeChanged: true,
      customSeedChanged: true,
      activeLifetimeTraits: 1,
      retiredLifetimeTraits: 1,
      lifetimeInfections: 2,
      experiencedScars: 1,
      checkpointRestores: 1,
    });
    expect(report.score).toBe(18);
    expect(report.band).toBe('EXTREME');
    expect(report.explanation).toContain('1 genome component change');
    expect(report.explanation).toContain('1 active lifetime trait');
    expect(report.explanation).toContain('1 experienced scar');
  });

  it('caps temporary-history dimensions without hiding raw dimensions', () => {
    const specimen = makeSpecimen(genome(['a']), 'CAPS');
    const after = specimen.birthBaseline.capturedAt + 1;

    specimen.lifeHistory.push(
      ...Array.from({ length: 7 }, (_, index) =>
        history('infection-started', `start-${index}`, after + index, `infection-${index}`)),
      ...Array.from({ length: 5 }, (_, index) =>
        history('checkpoint-restored', `restore-${index}`, after + 20 + index)),
    );
    specimen.scars = Array.from({ length: 6 }, (_, index) =>
      scar(specimen, `scar-${index}`, 'experienced', after + index));

    const report = calculateDrift(specimen);

    expect(report.dimensions.lifetimeInfections).toBe(7);
    expect(report.dimensions.experiencedScars).toBe(6);
    expect(report.dimensions.checkpointRestores).toBe(5);
    expect(report.score).toBe(11);
    expect(report.band).toBe('HIGH');
  });

  it('counts retirement of a baseline trait as lifetime trait drift but not the inherited trait itself', () => {
    const specimen = makeSpecimen(genome(['a']), 'BASELINE TRAIT');
    const baselineTrait = trait(specimen, 'baseline-trait', 'active', specimen.birthBaseline.capturedAt);
    specimen.acquiredTraits = [baselineTrait];
    specimen.birthBaseline.activeTraitIds = ['baseline-trait'];

    expect(calculateDrift(specimen).dimensions.activeLifetimeTraits).toBe(0);

    specimen.acquiredTraits = [{
      ...baselineTrait,
      status: 'retired',
      retiredAt: specimen.birthBaseline.capturedAt + 1,
    }];

    const report = calculateDrift(specimen);
    expect(report.dimensions.activeLifetimeTraits).toBe(0);
    expect(report.dimensions.retiredLifetimeTraits).toBe(1);
    expect(report.score).toBe(2);
  });

  it.each([
    [0, 'LOW'],
    [2, 'LOW'],
    [3, 'MODERATE'],
    [7, 'MODERATE'],
    [8, 'HIGH'],
    [14, 'HIGH'],
    [15, 'EXTREME'],
    [99, 'EXTREME'],
  ] as const)('maps score %i to %s', (score, band) => {
    expect(bandForScore(score)).toBe(band);
  });

  it('marks migrated-v2 reports as conservative without inventing prior chronology', () => {
    const specimen = makeSpecimen(genome(['a']), 'MIGRATED');
    specimen.birthBaseline = {
      ...specimen.birthBaseline,
      source: 'migrated-v2',
    };
    specimen.lineage = {
      ...specimen.lineage,
      source: 'migrated-v2',
    };

    const report = calculateDrift(specimen);

    expect(report.score).toBe(0);
    expect(report.explanation.toLowerCase()).toContain('conservative');
    expect(report.explanation).toContain('Round 2A');
  });
});
