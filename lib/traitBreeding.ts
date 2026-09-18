import type {
  AcquiredTrait,
  GeneticsTraitDecision,
  GeneticsTraitReceipt,
  Scar,
  Specimen,
  TraitOriginType,
} from '../types';
import { traitFunctionalFingerprint } from './breedingState';
import { canonicalParentIds, deterministicUniform } from './geneticsRandom';

interface TraitSource {
  parent: Specimen;
  parentIndex: number;
  trait: AcquiredTrait;
}

interface InternalTraitCandidate {
  fingerprint: string;
  sources: TraitSource[];
  sourceParentIds: string[];
  sourceTraitIds: string[];
  sourceOriginTypes: TraitOriginType[];
  shared: boolean;
  baseProbability: number;
  supportingScarIds: string[];
  scarBonus: number;
  finalProbability: number;
  roll: number;
  passed: boolean;
  inheritanceStrength?: number;
  result: GeneticsTraitDecision['result'];
}

export interface TraitInheritanceOptions {
  now?: number;
  idFactory?: () => string;
}

export interface TraitInheritanceResult {
  traits: AcquiredTrait[];
  receipt: GeneticsTraitReceipt;
}

const canonicalParents = (left: Specimen, right: Specimen): [Specimen, Specimen] => {
  if (left.id === right.id) throw new Error('BREEDING_REQUIRES_DISTINCT_PARENTS');
  const ids = canonicalParentIds(left.id, right.id);
  return left.id === ids[0] ? [left, right] : [right, left];
};

const baseForOrigin = (origin: TraitOriginType): number => {
  switch (origin) {
    case 'promoted-infection':
      return 0.45;
    case 'fossilized-accident':
      return 0.55;
    case 'explicit':
    case 'mr-slop-proposal':
    case 'inherited':
    default:
      return 0.35;
  }
};

const cloneProvenance = (trait: AcquiredTrait): AcquiredTrait['provenance'] => ({
  ...trait.provenance,
  sourceMessageIds: [...trait.provenance.sourceMessageIds],
  sourceArtifactIds: [...trait.provenance.sourceArtifactIds],
});

const linkedTraitIds = (trait: AcquiredTrait): Set<string> =>
  new Set([
    trait.id,
    ...(trait.inheritanceSources ?? []).map(source => source.recordId),
  ]);

const scarsSupportingTrait = (parent: Specimen, trait: AcquiredTrait): Scar[] => {
  const linkedIds = linkedTraitIds(trait);
  return parent.scars.filter(scar =>
    scar.relatedMutationIds.some(id => linkedIds.has(id)));
};

const buildCandidates = (
  parents: [Specimen, Specimen],
  seed: string,
): InternalTraitCandidate[] => {
  const byFingerprint = new Map<string, TraitSource[]>();

  parents.forEach((parent, parentIndex) => {
    for (const trait of parent.acquiredTraits) {
      if (trait.status !== 'active') continue;
      const fingerprint = traitFunctionalFingerprint(trait);
      const sources = byFingerprint.get(fingerprint) ?? [];
      sources.push({ parent, parentIndex, trait });
      byFingerprint.set(fingerprint, sources);
    }
  });

  const pairKey = parents.map(parent => parent.id).join('|');

  return [...byFingerprint.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fingerprint, unsortedSources]) => {
      const sources = [...unsortedSources].sort((left, right) =>
        left.parent.id.localeCompare(right.parent.id) ||
        left.trait.id.localeCompare(right.trait.id));
      const parentIds = [...new Set(sources.map(source => source.parent.id))].sort();
      const shared = parentIds.length === 2;
      const baseProbability = shared
        ? 0.70
        : Math.max(...sources.map(source => baseForOrigin(source.trait.originType)));

      const supportingScarIds = [...new Set(
        sources.flatMap(source =>
          scarsSupportingTrait(source.parent, source.trait).map(scar => scar.id)),
      )].sort();
      const scarBonus = supportingScarIds.length > 0 ? 0.15 : 0;
      const finalProbability = Math.min(1, baseProbability + scarBonus);
      const roll = deterministicUniform(
        seed,
        'trait-inheritance',
        `${pairKey}:${fingerprint}`,
      );
      const passed = roll < finalProbability;

      return {
        fingerprint,
        sources,
        sourceParentIds: sources.map(source => source.parent.id),
        sourceTraitIds: sources.map(source => source.trait.id),
        sourceOriginTypes: sources.map(source => source.trait.originType),
        shared,
        baseProbability,
        supportingScarIds,
        scarBonus,
        finalProbability,
        roll,
        passed,
        ...(passed ? { inheritanceStrength: roll / finalProbability } : {}),
        result: passed ? 'inherited' as const : 'failed-roll' as const,
      };
    });
};

const applyCap = (candidates: InternalTraitCandidate[]): void => {
  const passing = candidates
    .filter(candidate => candidate.passed)
    .sort((left, right) =>
      (left.inheritanceStrength ?? Infinity) - (right.inheritanceStrength ?? Infinity) ||
      left.fingerprint.localeCompare(right.fingerprint));

  if (passing.length <= 3) return;

  const winners = new Set(passing.slice(0, 3).map(candidate => candidate.fingerprint));
  for (const candidate of passing) {
    candidate.result = winners.has(candidate.fingerprint)
      ? 'inherited'
      : 'displaced-by-cap';
  }
};

const cloneInheritedTrait = (
  candidate: InternalTraitCandidate,
  now: number,
  idFactory: () => string,
): AcquiredTrait => {
  const representative = candidate.sources[0].trait;
  const inheritanceSources = candidate.sources.map(source => ({
    specimenId: source.parent.id,
    recordId: source.trait.id,
    inheritedAt: now,
  }));

  return {
    ...representative,
    id: idFactory(),
    status: 'active',
    originType: 'inherited',
    provenance: cloneProvenance(representative),
    inheritanceSources,
    inheritedSourceOriginTypes: [...candidate.sourceOriginTypes],
    supportingScarIdsAtBirth: [...candidate.supportingScarIds],
    ...(representative.birthVariation
      ? {
          birthVariation: {
            ...representative.birthVariation,
            before: { ...representative.birthVariation.before },
            after: { ...representative.birthVariation.after },
          },
        }
      : {}),
    createdAt: now,
    retiredAt: undefined,
  };
};

const toReceiptCandidate = (candidate: InternalTraitCandidate): GeneticsTraitDecision => ({
  fingerprint: candidate.fingerprint,
  sourceParentIds: [...candidate.sourceParentIds],
  sourceTraitIds: [...candidate.sourceTraitIds],
  sourceOriginTypes: [...candidate.sourceOriginTypes],
  shared: candidate.shared,
  baseProbability: candidate.baseProbability,
  supportingScarIds: [...candidate.supportingScarIds],
  scarBonus: candidate.scarBonus,
  finalProbability: candidate.finalProbability,
  roll: candidate.roll,
  passed: candidate.passed,
  ...(candidate.inheritanceStrength !== undefined
    ? { inheritanceStrength: candidate.inheritanceStrength }
    : {}),
  result: candidate.result,
});

export const inheritTraits = (
  parentA: Specimen,
  parentB: Specimen,
  seed: string,
  options: TraitInheritanceOptions = {},
): TraitInheritanceResult => {
  const parents = canonicalParents(parentA, parentB);
  const now = options.now ?? Date.now();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const candidates = buildCandidates(parents, seed);

  applyCap(candidates);

  const inheritedCandidates = candidates
    .filter(candidate => candidate.result === 'inherited')
    .sort((left, right) => left.fingerprint.localeCompare(right.fingerprint));

  const traits = inheritedCandidates.map(candidate =>
    cloneInheritedTrait(candidate, now, idFactory));

  return {
    traits,
    receipt: {
      candidates: candidates.map(toReceiptCandidate),
      inheritedFingerprints: inheritedCandidates.map(candidate => candidate.fingerprint),
    },
  };
};
