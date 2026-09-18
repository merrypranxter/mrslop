import { describe, expect, it } from 'vitest';
import { applyBirthMutation } from '../lib/birthMutation';
import { makeSpecimen } from '../services/specimenStore';
import type { AcquiredTrait, GenomeComponent, Specimen } from '../types';

const component = (
  id: string,
  order = 0,
  enabled = true,
): GenomeComponent => ({
  id,
  name: id.toUpperCase(),
  kind: 'mind',
  version: 'test-v1',
  description: `Description ${id}`,
  prompt: `Prompt ${id}`,
  tags: [],
  roleHints: [],
  enabled,
  order,
  charWeight: 10,
});

const parent = (
  id: string,
  components: GenomeComponent[],
): Specimen => {
  const specimen = makeSpecimen({
    id: `g-${id}`,
    mode: 'stack',
    components,
  }, id, 'spawned');

  return {
    ...specimen,
    id,
    lineage: {
      kind: 'root',
      parentSpecimenIds: [],
      rootSpecimenIds: [id],
      generation: 0,
      source: 'native-v4',
    },
  };
};

const inheritedTrait = (
  specimen: Specimen,
  id: string,
  prompt = `Inherited prompt ${id}`,
): AcquiredTrait => ({
  id,
  name: id,
  description: `Description ${id}`,
  prompt,
  status: 'active',
  originType: 'inherited',
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  inheritanceSources: [{
    specimenId: 'source-parent',
    recordId: `source-${id}`,
    inheritedAt: 1,
  }],
  inheritedSourceOriginTypes: ['explicit'],
  createdAt: 2,
});

const ordinaryTrait = (
  specimen: Specimen,
  id: string,
): AcquiredTrait => ({
  ...inheritedTrait(specimen, id),
  originType: 'explicit',
  inheritanceSources: undefined,
});

const seed = (n: number): string => n.toString(16).padStart(32, '0').slice(-32);

const baseParents = () => [
  parent('a', [component('parent-a', 0), component('parent-disabled', 1, false)]),
  parent('b', [component('parent-b', 0)]),
] as const;

const library = [
  component('parent-a', 0),
  component('parent-disabled', 1),
  component('parent-b', 2),
  component('child-already-has', 3),
  component('novel-one', 4),
  component('novel-two', 5),
];

const findSeed = (
  predicate: (result: ReturnType<typeof applyBirthMutation>) => boolean,
  options: {
    childComponents?: GenomeComponent[];
    traits?: AcquiredTrait[];
    candidateLibrary?: GenomeComponent[];
  } = {},
): string => {
  const [a, b] = baseParents();
  const childComponents = options.childComponents ?? [component('child-already-has', 0)];
  const traits = options.traits ?? [inheritedTrait(a, 'inherited-one')];
  const candidateLibrary = options.candidateLibrary ?? library;

  for (let i = 1; i <= 10000; i += 1) {
    const result = applyBirthMutation(
      a,
      b,
      childComponents,
      traits,
      seed(i),
      { library: candidateLibrary },
    );
    if (predicate(result)) return seed(i);
  }

  throw new Error('SEED_NOT_FOUND');
};

describe('controlled birth mutation', () => {
  it('uses exact 12.5% trigger semantics and records the threshold', () => {
    const [a, b] = baseParents();
    const triggeredSeed = findSeed(result => result.receipt.triggered);
    const quietSeed = findSeed(result => !result.receipt.triggered);

    const triggered = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [inheritedTrait(a, 'inherited-one')],
      triggeredSeed,
      { library },
    );
    const quiet = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [inheritedTrait(a, 'inherited-one')],
      quietSeed,
      { library },
    );

    expect(triggered.receipt.threshold).toBe(0.125);
    expect(triggered.receipt.triggerRoll).toBeLessThan(0.125);
    expect(triggered.receipt.triggered).toBe(true);

    expect(quiet.receipt.threshold).toBe(0.125);
    expect(quiet.receipt.triggerRoll).toBeGreaterThanOrEqual(0.125);
    expect(quiet.receipt.triggered).toBe(false);
    expect(quiet.receipt.outcome).toBe('none');
    expect(quiet.components).toHaveLength(1);
  });

  it('splits the preferred mutation branch 50/50 before fallback', () => {
    const canonicalSeed = findSeed(result =>
      result.receipt.triggered &&
      result.receipt.preferredBranch === 'canonical-component');
    const traitSeed = findSeed(result =>
      result.receipt.triggered &&
      result.receipt.preferredBranch === 'trait-variation');

    const [a, b] = baseParents();

    const canonical = applyBirthMutation(
      a, b,
      [component('child-already-has', 0)],
      [inheritedTrait(a, 'inherited-one')],
      canonicalSeed,
      { library },
    );
    const trait = applyBirthMutation(
      a, b,
      [component('child-already-has', 0)],
      [inheritedTrait(a, 'inherited-one')],
      traitSeed,
      { library },
    );

    expect(canonical.receipt.branchRoll).toBeLessThan(0.5);
    expect(canonical.receipt.preferredBranch).toBe('canonical-component');
    expect(trait.receipt.branchRoll).toBeGreaterThanOrEqual(0.5);
    expect(trait.receipt.preferredBranch).toBe('trait-variation');
  });

  it('canonical component mutation excludes both parents complete current genomes and the child genome', () => {
    const [a, b] = baseParents();
    const mutationSeed = findSeed(result =>
      result.receipt.outcome === 'canonical-component');

    const result = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [inheritedTrait(a, 'inherited-one')],
      mutationSeed,
      { library },
    );

    expect(result.receipt.canonicalCandidateIds).toEqual(['novel-one', 'novel-two']);
    expect(['novel-one', 'novel-two']).toContain(result.receipt.componentId);
    expect(result.components).toHaveLength(2);
    expect(result.components[0].id).toBe('child-already-has');
    expect(result.components[1]).toMatchObject({
      id: result.receipt.componentId,
      enabled: true,
      order: 1,
    });
  });

  it('adds at most one canonical component and never replaces ordinary crossover material', () => {
    const [a, b] = baseParents();
    const child = [component('child-a', 0), component('child-b', 1)];
    const mutationSeed = findSeed(
      result => result.receipt.outcome === 'canonical-component',
      { childComponents: child },
    );

    const result = applyBirthMutation(
      a,
      b,
      child,
      [inheritedTrait(a, 'inherited-one')],
      mutationSeed,
      { library },
    );

    expect(result.components).toHaveLength(child.length + 1);
    expect(result.components.slice(0, child.length).map(item => item.id))
      .toEqual(child.map(item => item.id));
    expect(result.traits).toHaveLength(1);
  });

  it('trait variation only mutates an actually inherited trait via a registered deterministic mutator', () => {
    const [a, b] = baseParents();
    const inherited = inheritedTrait(a, 'inherited-one', 'Preserve this exact ancestry behavior.');
    const ordinary = ordinaryTrait(a, 'ordinary-one');
    const mutationSeed = findSeed(
      result => result.receipt.outcome === 'trait-variation',
      { traits: [inherited, ordinary] },
    );

    const result = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [inherited, ordinary],
      mutationSeed,
      { library },
    );

    expect(result.traits).toHaveLength(2);
    const changed = result.traits.find(item => item.id === 'inherited-one');
    const unchanged = result.traits.find(item => item.id === 'ordinary-one');

    expect(changed?.prompt).not.toBe(inherited.prompt);
    expect(changed?.birthVariation).toMatchObject({
      mutatorId: 'persistence-boost',
      mutatorVersion: 'v1',
      before: { prompt: inherited.prompt },
      after: { prompt: changed?.prompt },
    });
    expect(unchanged).toEqual(ordinary);
    expect(result.receipt.sourceTraitFingerprint).toBeDefined();
    expect(result.receipt.mutatorId).toBe('persistence-boost');
    expect(result.receipt.mutatorVersion).toBe('v1');
  });

  it('falls back to canonical mutation when trait variation is preferred but no inherited trait is mutable', () => {
    const [a, b] = baseParents();
    const fallbackSeed = findSeed(
      result =>
        result.receipt.triggered &&
        result.receipt.preferredBranch === 'trait-variation' &&
        result.receipt.outcome === 'canonical-component',
      { traits: [ordinaryTrait(a, 'ordinary-only')] },
    );

    const result = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [ordinaryTrait(a, 'ordinary-only')],
      fallbackSeed,
      { library },
    );

    expect(result.receipt.fallbackUsed).toBe(true);
    expect(result.receipt.attemptedBranches).toEqual([
      'trait-variation',
      'canonical-component',
    ]);
    expect(result.receipt.outcome).toBe('canonical-component');
  });

  it('falls back to trait variation when canonical mutation is preferred but the canonical pool is empty', () => {
    const [a, b] = baseParents();
    const inherited = inheritedTrait(a, 'inherited-one');
    const emptyLibrary = [
      component('parent-a'),
      component('parent-disabled'),
      component('parent-b'),
      component('child-already-has'),
    ];

    const fallbackSeed = findSeed(
      result =>
        result.receipt.triggered &&
        result.receipt.preferredBranch === 'canonical-component' &&
        result.receipt.outcome === 'trait-variation',
      {
        traits: [inherited],
        candidateLibrary: emptyLibrary,
      },
    );

    const result = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [inherited],
      fallbackSeed,
      { library: emptyLibrary },
    );

    expect(result.receipt.fallbackUsed).toBe(true);
    expect(result.receipt.attemptedBranches).toEqual([
      'canonical-component',
      'trait-variation',
    ]);
    expect(result.receipt.outcome).toBe('trait-variation');
  });

  it('records a deterministic no-op when neither mutation branch has a valid target', () => {
    const [a, b] = baseParents();
    const emptyLibrary = [
      component('parent-a'),
      component('parent-disabled'),
      component('parent-b'),
      component('child-already-has'),
    ];

    const noopSeed = findSeed(
      result => result.receipt.triggered && result.receipt.outcome === 'no-valid-candidate',
      {
        traits: [],
        candidateLibrary: emptyLibrary,
      },
    );

    const result = applyBirthMutation(
      a,
      b,
      [component('child-already-has', 0)],
      [],
      noopSeed,
      { library: emptyLibrary },
    );

    expect(result.receipt.triggered).toBe(true);
    expect(result.receipt.outcome).toBe('no-valid-candidate');
    expect(result.receipt.noOpReason).toBe('no-valid-candidate');
    expect(result.components).toEqual([component('child-already-has', 0)]);
    expect(result.traits).toEqual([]);
  });

  it('is deterministic, parent-order neutral, and leaves all inputs untouched', () => {
    const [a, b] = baseParents();
    const child = [component('child-already-has', 0)];
    const traits = [inheritedTrait(a, 'inherited-one')];
    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);
    const beforeChild = structuredClone(child);
    const beforeTraits = structuredClone(traits);

    const mutationSeed = findSeed(result => result.receipt.triggered);
    const forward = applyBirthMutation(a, b, child, traits, mutationSeed, { library });
    const reverse = applyBirthMutation(b, a, child, traits, mutationSeed, { library });

    expect(reverse).toEqual(forward);
    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);
    expect(child).toEqual(beforeChild);
    expect(traits).toEqual(beforeTraits);
  });
});
