import { Genome, Specimen } from '../types';

export type DriftBand = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export interface DriftDimensions {
  genomeComponentDelta: number;
  genomeModeChanged: boolean;
  customSeedChanged: boolean;
  activeLifetimeTraits: number;
  retiredLifetimeTraits: number;
  lifetimeInfections: number;
  experiencedScars: number;
  checkpointRestores: number;
  generation: number;
}

export interface DriftReport {
  score: number;
  band: DriftBand;
  dimensions: DriftDimensions;
  explanation: string;
}

const enabledComponentIds = (genome: Genome): Set<string> =>
  new Set(
    genome.components
      .filter(component => component.enabled)
      .map(component => component.id),
  );

const symmetricDifferenceSize = (left: Set<string>, right: Set<string>): number => {
  let count = 0;
  for (const id of left) {
    if (!right.has(id)) count += 1;
  }
  for (const id of right) {
    if (!left.has(id)) count += 1;
  }
  return count;
};

const normalizedSeed = (value: string | undefined): string =>
  value?.trim() ?? '';

const plural = (count: number, singular: string, pluralForm = `${singular}s`): string =>
  `${count} ${count === 1 ? singular : pluralForm}`;

export const bandForScore = (score: number): DriftBand => {
  if (score >= 15) return 'EXTREME';
  if (score >= 8) return 'HIGH';
  if (score >= 3) return 'MODERATE';
  return 'LOW';
};

const calculateDimensions = (specimen: Specimen): DriftDimensions => {
  const baseline = specimen.birthBaseline;
  const baselineTraitIds = new Set(baseline.activeTraitIds);
  const baselineComponents = enabledComponentIds(baseline.genome);
  const currentComponents = enabledComponentIds(specimen.currentGenome);

  const activeLifetimeTraits = specimen.acquiredTraits.filter(trait =>
    trait.status === 'active' &&
    !baselineTraitIds.has(trait.id) &&
    trait.createdAt >= baseline.capturedAt
  ).length;

  const retiredLifetimeTraits = specimen.acquiredTraits.filter(trait =>
    trait.status === 'retired' &&
    (trait.retiredAt ?? trait.createdAt) >= baseline.capturedAt &&
    (
      baselineTraitIds.has(trait.id) ||
      trait.createdAt >= baseline.capturedAt
    )
  ).length;

  const infectionIds = new Set(
    specimen.lifeHistory
      .filter(event =>
        event.type === 'infection-started' &&
        event.createdAt >= baseline.capturedAt)
      .map(event => event.mutationId || event.id),
  );

  const experiencedScars = specimen.scars.filter(scar =>
    scar.origin === 'experienced' &&
    scar.createdAt >= baseline.capturedAt
  ).length;

  const checkpointRestores = specimen.lifeHistory.filter(event =>
    event.type === 'checkpoint-restored' &&
    event.createdAt >= baseline.capturedAt
  ).length;

  return {
    genomeComponentDelta: symmetricDifferenceSize(baselineComponents, currentComponents),
    genomeModeChanged: baseline.genome.mode !== specimen.currentGenome.mode,
    customSeedChanged:
      normalizedSeed(baseline.genome.customSeed) !== normalizedSeed(specimen.currentGenome.customSeed),
    activeLifetimeTraits,
    retiredLifetimeTraits,
    lifetimeInfections: infectionIds.size,
    experiencedScars,
    checkpointRestores,
    generation: specimen.lineage.generation,
  };
};

const scoreDimensions = (dimensions: DriftDimensions): number =>
  dimensions.genomeComponentDelta * 4 +
  (dimensions.genomeModeChanged ? 3 : 0) +
  (dimensions.customSeedChanged ? 2 : 0) +
  dimensions.activeLifetimeTraits * 3 +
  dimensions.retiredLifetimeTraits * 2 +
  Math.min(dimensions.lifetimeInfections, 4) +
  Math.min(dimensions.experiencedScars, 4) +
  Math.min(dimensions.checkpointRestores, 3);

const explain = (
  specimen: Specimen,
  dimensions: DriftDimensions,
): string => {
  const parts: string[] = [];

  if (dimensions.genomeComponentDelta === 0) {
    parts.push('Genome components unchanged');
  } else {
    parts.push(plural(dimensions.genomeComponentDelta, 'genome component change'));
  }

  if (dimensions.genomeModeChanged) parts.push('assembly mode changed');
  if (dimensions.customSeedChanged) parts.push('custom seed changed');
  if (dimensions.activeLifetimeTraits > 0) {
    parts.push(plural(dimensions.activeLifetimeTraits, 'active lifetime trait'));
  }
  if (dimensions.retiredLifetimeTraits > 0) {
    parts.push(plural(dimensions.retiredLifetimeTraits, 'retired lifetime trait'));
  }
  if (dimensions.lifetimeInfections > 0) {
    parts.push(plural(dimensions.lifetimeInfections, 'lifetime infection'));
  }
  if (dimensions.experiencedScars > 0) {
    parts.push(plural(dimensions.experiencedScars, 'experienced scar'));
  }
  if (dimensions.checkpointRestores > 0) {
    parts.push(plural(dimensions.checkpointRestores, 'checkpoint restore'));
  }

  parts.push(`generation ${dimensions.generation}`);

  let result = parts.join(' · ');

  if (specimen.birthBaseline.source === 'migrated-v2') {
    result += '. Historical baseline is conservative from the Round 2A migration.';
  }

  return result;
};

export const calculateDrift = (specimen: Specimen): DriftReport => {
  const dimensions = calculateDimensions(specimen);
  const score = scoreDimensions(dimensions);

  return {
    score,
    band: bandForScore(score),
    dimensions,
    explanation: explain(specimen, dimensions),
  };
};
