import { describe, expect, it } from 'vitest';
import { inheritTraits } from '../lib/traitBreeding';
import { makeSpecimen } from '../services/specimenStore';
import type { AcquiredTrait, Infection, Scar, Specimen, TraitOriginType } from '../types';

const parent = (id: string): Specimen => {
  const specimen = makeSpecimen({ id: `g-${id}`, mode: 'stack', components: [] }, id, 'spawned');
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

const trait = (
  specimen: Specimen,
  id: string,
  prompt: string,
  originType: TraitOriginType = 'explicit',
  status: AcquiredTrait['status'] = 'active',
): AcquiredTrait => ({
  id,
  name: `Trait ${id}`,
  description: `Description ${id}`,
  prompt,
  status,
  originType,
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 10,
  ...(status === 'retired' ? { retiredAt: 20 } : {}),
});

const scar = (
  specimen: Specimen,
  id: string,
  kind: Scar['kind'],
  relatedMutationIds: string[],
): Scar => ({
  id,
  name: id,
  description: `Scar ${id}`,
  kind,
  origin: 'experienced',
  createdAt: 30,
  sourceSpecimenId: specimen.id,
  relatedEventIds: [],
  relatedMutationIds,
  relatedCheckpointIds: [],
  messageIds: [],
  artifactIds: [],
});

const infection = (specimen: Specimen): Infection => ({
  id: 'active-infection',
  name: 'TEMP',
  description: 'Temporary and non-heritable.',
  prompt: 'temporary behavior',
  status: 'active',
  durationMode: 'indefinite',
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 40,
});

const seed = (n: number): string => n.toString(16).padStart(32, '0').slice(-32);

const run = (a: Specimen, b: Specimen, n = 1) => {
  let nextId = 0;
  return inheritTraits(a, b, seed(n), {
    now: 1000,
    idFactory: () => `child-trait-${nextId++}`,
  });
};

describe('two-parent trait inheritance', () => {
  it('uses the approved 35/45/55 base probabilities for ordinary promoted and fossilized traits', () => {
    const a = parent('a');
    const b = parent('b');
    a.acquiredTraits = [
      trait(a, 'ordinary', 'ordinary behavior', 'explicit'),
      trait(a, 'promoted', 'promoted behavior', 'promoted-infection'),
      trait(a, 'fossil', 'fossil behavior', 'fossilized-accident'),
      trait(a, 'inherited', 'already inherited behavior', 'inherited'),
    ];

    const result = run(a, b, 3);
    const byId = new Map(result.receipt.candidates.map(candidate => [
      candidate.sourceTraitIds[0],
      candidate,
    ]));

    expect(byId.get('ordinary')?.baseProbability).toBe(0.35);
    expect(byId.get('promoted')?.baseProbability).toBe(0.45);
    expect(byId.get('fossil')?.baseProbability).toBe(0.55);
    expect(byId.get('inherited')?.baseProbability).toBe(0.35);
  });

  it('collapses functionally identical traits in both parents into one shared 70% candidate', () => {
    const a = parent('a');
    const b = parent('b');
    a.acquiredTraits = [trait(a, 'a-shared', 'same operational behavior', 'explicit')];
    b.acquiredTraits = [trait(b, 'b-shared', 'same operational behavior', 'fossilized-accident')];

    const result = run(a, b, 5);

    expect(result.receipt.candidates).toHaveLength(1);
    expect(result.receipt.candidates[0]).toMatchObject({
      shared: true,
      baseProbability: 0.70,
      sourceParentIds: ['a', 'b'],
      sourceTraitIds: ['a-shared', 'b-shared'],
    });
  });

  it('adds direct scar support once for +15 percentage points and never stacks it', () => {
    const a = parent('a');
    const b = parent('b');
    a.acquiredTraits = [trait(a, 'fossil', 'scarred behavior', 'fossilized-accident')];
    a.scars = [
      scar(a, 'support-1', 'fossilized-accident', ['fossil']),
      scar(a, 'support-2', 'fossilized-accident', ['fossil']),
      scar(a, 'unrelated', 'infection-survived', ['other-id']),
    ];

    const result = run(a, b, 7);
    const candidate = result.receipt.candidates[0];

    expect(candidate.baseProbability).toBe(0.55);
    expect(candidate.supportingScarIds).toEqual(['support-1', 'support-2']);
    expect(candidate.scarBonus).toBe(0.15);
    expect(candidate.finalProbability).toBe(0.70);
  });

  it('lets explicit inherited-source links support a trait without guessing from names or prose', () => {
    const a = parent('a');
    const b = parent('b');
    const inherited = trait(a, 'child-local-trait', 'ancestral behavior', 'inherited');
    inherited.inheritanceSources = [{
      specimenId: 'ancestor',
      recordId: 'ancestor-trait-id',
      inheritedAt: 50,
    }];
    a.acquiredTraits = [inherited];
    a.scars = [
      scar(a, 'ancestral-support', 'fossilized-accident', ['ancestor-trait-id']),
      {
        ...scar(a, 'name-only', 'fossilized-accident', ['not-linked']),
        description: 'ancestral behavior',
      },
    ];

    const candidate = run(a, b, 9).receipt.candidates[0];
    expect(candidate.supportingScarIds).toEqual(['ancestral-support']);
    expect(candidate.finalProbability).toBe(0.50);
  });

  it('excludes retired traits and all infection records from the candidate pool', () => {
    const a = parent('a');
    const b = parent('b');
    a.acquiredTraits = [
      trait(a, 'active', 'active behavior'),
      trait(a, 'retired', 'retired behavior', 'explicit', 'retired'),
    ];
    a.infections = [infection(a)];

    const result = run(a, b, 11);

    expect(result.receipt.candidates).toHaveLength(1);
    expect(result.receipt.candidates[0].sourceTraitIds).toEqual(['active']);
    expect(result.receipt.candidates.some(candidate =>
      candidate.sourceTraitIds.includes('active-infection'))).toBe(false);
  });

  it('enforces the hard cap of three using normalized roll/probability strength', () => {
    const a = parent('a');
    const b = parent('b');
    a.acquiredTraits = Array.from({ length: 8 }, (_, index) =>
      trait(a, `trait-${index}`, `distinct behavior ${index}`, 'fossilized-accident'));

    let found: ReturnType<typeof run> | undefined;
    for (let i = 1; i <= 2048; i += 1) {
      const candidate = run(a, b, i);
      const passed = candidate.receipt.candidates.filter(item => item.passed);
      if (passed.length > 3) {
        found = candidate;
        break;
      }
    }

    expect(found).toBeDefined();
    if (!found) return;

    const passed = found.receipt.candidates.filter(item => item.passed);
    const inherited = found.receipt.candidates.filter(item => item.result === 'inherited');
    const displaced = found.receipt.candidates.filter(item => item.result === 'displaced-by-cap');

    expect(found.traits).toHaveLength(3);
    expect(inherited).toHaveLength(3);
    expect(displaced).toHaveLength(passed.length - 3);

    const expected = [...passed]
      .sort((left, right) =>
        (left.inheritanceStrength ?? Infinity) - (right.inheritanceStrength ?? Infinity) ||
        left.fingerprint.localeCompare(right.fingerprint))
      .slice(0, 3)
      .map(item => item.fingerprint)
      .sort();

    expect(inherited.map(item => item.fingerprint).sort()).toEqual(expected);
  });

  it('resets inherited lifecycle state while preserving factual source ancestry', () => {
    const a = parent('a');
    const b = parent('b');
    a.acquiredTraits = [trait(a, 'source-fossil', 'highly heritable behavior', 'fossilized-accident')];
    a.scars = [scar(a, 'source-scar', 'fossilized-accident', ['source-fossil'])];

    let inherited: ReturnType<typeof run> | undefined;
    for (let i = 1; i <= 128; i += 1) {
      const candidate = run(a, b, i);
      if (candidate.traits.length === 1) {
        inherited = candidate;
        break;
      }
    }

    expect(inherited).toBeDefined();
    if (!inherited) return;

    expect(inherited.traits[0]).toMatchObject({
      status: 'active',
      originType: 'inherited',
      inheritanceSources: [{
        specimenId: 'a',
        recordId: 'source-fossil',
        inheritedAt: 1000,
      }],
      inheritedSourceOriginTypes: ['fossilized-accident'],
      supportingScarIdsAtBirth: ['source-scar'],
    });
    expect(inherited.traits[0].id).toBe('child-trait-0');
    expect(inherited.traits[0].retiredAt).toBeUndefined();
  });

  it('is parent-order neutral and does not mutate either source parent', () => {
    const a = parent('z-parent');
    const b = parent('a-parent');
    a.acquiredTraits = [trait(a, 'z-trait', 'z behavior', 'promoted-infection')];
    b.acquiredTraits = [trait(b, 'a-trait', 'a behavior', 'fossilized-accident')];

    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);

    const forward = run(a, b, 101);
    const reverse = run(b, a, 101);

    expect(forward.receipt).toEqual(reverse.receipt);
    expect(forward.traits.map(item => item.prompt)).toEqual(reverse.traits.map(item => item.prompt));
    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);
  });
});
