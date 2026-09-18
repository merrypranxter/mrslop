import { SLOP_LIBRARY } from '../data/slopLibrary';
import type {
  AcquiredTrait,
  GeneticsMutationReceipt,
  GenomeComponent,
  Specimen,
} from '../types';
import { componentFunctionalFingerprint, traitFunctionalFingerprint } from './breedingState';
import { canonicalParentIds, deterministicUniform } from './geneticsRandom';

export interface BirthMutationOptions {
  library?: GenomeComponent[];
}

export interface BirthMutationResult {
  components: GenomeComponent[];
  traits: AcquiredTrait[];
  receipt: GeneticsMutationReceipt;
}

interface TraitMutator {
  id: string;
  version: string;
  canMutate: (trait: AcquiredTrait) => boolean;
  apply: (trait: AcquiredTrait) => AcquiredTrait;
}

const cloneComponent = (component: GenomeComponent): GenomeComponent => ({
  ...component,
  tags: [...component.tags],
  roleHints: [...component.roleHints],
});

const cloneTrait = (trait: AcquiredTrait): AcquiredTrait => ({
  ...trait,
  provenance: {
    ...trait.provenance,
    sourceMessageIds: [...trait.provenance.sourceMessageIds],
    sourceArtifactIds: [...trait.provenance.sourceArtifactIds],
  },
  ...(trait.inheritanceSources
    ? { inheritanceSources: trait.inheritanceSources.map(source => ({ ...source })) }
    : {}),
  ...(trait.inheritedSourceOriginTypes
    ? { inheritedSourceOriginTypes: [...trait.inheritedSourceOriginTypes] }
    : {}),
  ...(trait.supportingScarIdsAtBirth
    ? { supportingScarIdsAtBirth: [...trait.supportingScarIdsAtBirth] }
    : {}),
  ...(trait.birthVariation
    ? {
        birthVariation: {
          ...trait.birthVariation,
          before: { ...trait.birthVariation.before },
          after: { ...trait.birthVariation.after },
        },
      }
    : {}),
});

const persistenceBoostMutator: TraitMutator = {
  id: 'persistence-boost',
  version: 'v1',
  canMutate: trait =>
    trait.status === 'active' &&
    trait.originType === 'inherited' &&
    !trait.birthVariation,
  apply: trait => {
    const sourceFingerprint = traitFunctionalFingerprint(trait);
    const prompt = [
      '[BIRTH VARIATION — persistence-boost v1]',
      'When this inherited trait becomes relevant within a response, continue applying it through the remainder of that response unless an explicit user constraint conflicts with it.',
      '',
      'INHERITED TRAIT:',
      trait.prompt,
    ].join('\n');

    return {
      ...cloneTrait(trait),
      prompt,
      birthVariation: {
        mutatorId: 'persistence-boost',
        mutatorVersion: 'v1',
        sourceTraitFingerprint: sourceFingerprint,
        before: { prompt: trait.prompt },
        after: { prompt },
      },
    };
  },
};

export const BIRTH_TRAIT_MUTATORS: readonly TraitMutator[] = [
  persistenceBoostMutator,
];

const canonicalParents = (left: Specimen, right: Specimen): [Specimen, Specimen] => {
  if (left.id === right.id) throw new Error('BREEDING_REQUIRES_DISTINCT_PARENTS');
  const ids = canonicalParentIds(left.id, right.id);
  return left.id === ids[0] ? [left, right] : [right, left];
};

const canonicalMutationCandidates = (
  parents: [Specimen, Specimen],
  childComponents: GenomeComponent[],
  library: GenomeComponent[],
): GenomeComponent[] => {
  const blockedIds = new Set<string>([
    ...parents[0].currentGenome.components.map(component => component.id),
    ...parents[1].currentGenome.components.map(component => component.id),
    ...childComponents.map(component => component.id),
  ]);

  const byId = new Map<string, GenomeComponent>();
  for (const component of library) {
    if (blockedIds.has(component.id)) continue;
    if (!byId.has(component.id)) byId.set(component.id, component);
  }

  return [...byId.values()]
    .map(cloneComponent)
    .sort((left, right) =>
      left.id.localeCompare(right.id) ||
      componentFunctionalFingerprint(left).localeCompare(componentFunctionalFingerprint(right)));
};

const selectCanonicalComponent = (
  candidates: GenomeComponent[],
  seed: string,
  pairKey: string,
): GenomeComponent | null => {
  if (candidates.length === 0) return null;

  return [...candidates].sort((left, right) =>
    deterministicUniform(seed, 'birth-component-candidate', `${pairKey}:${left.id}`) -
      deterministicUniform(seed, 'birth-component-candidate', `${pairKey}:${right.id}`) ||
    left.id.localeCompare(right.id))[0];
};

const traitMutationTargets = (
  traits: AcquiredTrait[],
): Array<{ trait: AcquiredTrait; mutator: TraitMutator; fingerprint: string }> => {
  const targets: Array<{ trait: AcquiredTrait; mutator: TraitMutator; fingerprint: string }> = [];

  for (const trait of traits) {
    for (const mutator of BIRTH_TRAIT_MUTATORS) {
      if (!mutator.canMutate(trait)) continue;
      targets.push({
        trait,
        mutator,
        fingerprint: traitFunctionalFingerprint(trait),
      });
    }
  }

  return targets.sort((left, right) =>
    left.fingerprint.localeCompare(right.fingerprint) ||
    left.trait.id.localeCompare(right.trait.id) ||
    left.mutator.id.localeCompare(right.mutator.id) ||
    left.mutator.version.localeCompare(right.mutator.version));
};

const selectTraitMutationTarget = (
  traits: AcquiredTrait[],
  seed: string,
  pairKey: string,
): ReturnType<typeof traitMutationTargets>[number] | null => {
  const targets = traitMutationTargets(traits);
  if (targets.length === 0) return null;

  return [...targets].sort((left, right) => {
    const leftKey = `${pairKey}:${left.fingerprint}:${left.trait.id}:${left.mutator.id}:${left.mutator.version}`;
    const rightKey = `${pairKey}:${right.fingerprint}:${right.trait.id}:${right.mutator.id}:${right.mutator.version}`;
    return deterministicUniform(seed, 'birth-trait-candidate', leftKey) -
      deterministicUniform(seed, 'birth-trait-candidate', rightKey) ||
      leftKey.localeCompare(rightKey);
  })[0];
};

const noMutationReceipt = (
  triggerRoll: number,
): GeneticsMutationReceipt => ({
  triggerRoll,
  threshold: 0.125,
  triggered: false,
  attemptedBranches: [],
  outcome: 'none',
});

export const applyBirthMutation = (
  parentA: Specimen,
  parentB: Specimen,
  childComponents: GenomeComponent[],
  inheritedTraits: AcquiredTrait[],
  seed: string,
  options: BirthMutationOptions = {},
): BirthMutationResult => {
  const parents = canonicalParents(parentA, parentB);
  const pairKey = parents.map(parent => parent.id).join('|');
  const components = childComponents.map(cloneComponent);
  const traits = inheritedTraits.map(cloneTrait);
  const library = options.library ?? SLOP_LIBRARY;

  const triggerRoll = deterministicUniform(seed, 'birth-mutation-trigger', pairKey);
  if (triggerRoll >= 0.125) {
    return {
      components,
      traits,
      receipt: noMutationReceipt(triggerRoll),
    };
  }

  const branchRoll = deterministicUniform(seed, 'birth-mutation-branch', pairKey);
  const preferredBranch = branchRoll < 0.5
    ? 'canonical-component' as const
    : 'trait-variation' as const;
  const fallbackBranch = preferredBranch === 'canonical-component'
    ? 'trait-variation' as const
    : 'canonical-component' as const;

  const canonicalCandidates = canonicalMutationCandidates(parents, components, library);
  const canonicalCandidateIds = canonicalCandidates.map(component => component.id);

  const attemptedBranches: GeneticsMutationReceipt['attemptedBranches'] = [];

  const tryCanonical = (): BirthMutationResult | null => {
    attemptedBranches.push('canonical-component');
    const selected = selectCanonicalComponent(canonicalCandidates, seed, pairKey);
    if (!selected) return null;

    const mutatedComponent: GenomeComponent = {
      ...cloneComponent(selected),
      enabled: true,
      order: components.length,
    };

    return {
      components: [...components, mutatedComponent],
      traits,
      receipt: {
        triggerRoll,
        threshold: 0.125,
        triggered: true,
        branchRoll,
        preferredBranch,
        attemptedBranches: [...attemptedBranches],
        outcome: 'canonical-component',
        canonicalCandidateIds,
        componentId: mutatedComponent.id,
        fallbackUsed: preferredBranch !== 'canonical-component',
      },
    };
  };

  const tryTrait = (): BirthMutationResult | null => {
    attemptedBranches.push('trait-variation');
    const target = selectTraitMutationTarget(traits, seed, pairKey);
    if (!target) return null;

    const mutated = target.mutator.apply(target.trait);
    const nextTraits = traits.map(trait =>
      trait.id === target.trait.id ? mutated : trait);

    return {
      components,
      traits: nextTraits,
      receipt: {
        triggerRoll,
        threshold: 0.125,
        triggered: true,
        branchRoll,
        preferredBranch,
        attemptedBranches: [...attemptedBranches],
        outcome: 'trait-variation',
        canonicalCandidateIds,
        sourceTraitFingerprint: target.fingerprint,
        mutatorId: target.mutator.id,
        mutatorVersion: target.mutator.version,
        fallbackUsed: preferredBranch !== 'trait-variation',
      },
    };
  };

  const attempts = preferredBranch === 'canonical-component'
    ? [tryCanonical, tryTrait]
    : [tryTrait, tryCanonical];

  for (const attempt of attempts) {
    const result = attempt();
    if (result) return result;
  }

  return {
    components,
    traits,
    receipt: {
      triggerRoll,
      threshold: 0.125,
      triggered: true,
      branchRoll,
      preferredBranch,
      attemptedBranches: [...attemptedBranches],
      outcome: 'no-valid-candidate',
      canonicalCandidateIds,
      fallbackUsed: true,
      noOpReason: 'no-valid-candidate',
    },
  };
};
