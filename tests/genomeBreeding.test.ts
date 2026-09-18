import { describe, expect, it } from 'vitest';
import { crossoverGenome } from '../lib/genomeBreeding';
import { makeSpecimen } from '../services/specimenStore';
import type { ComponentKind, Genome, GenomeComponent, Specimen } from '../types';

const component = (
  id: string,
  kind: ComponentKind = 'mind',
  order = 0,
  prompt = `Prompt for ${id}`,
  enabled = true,
): GenomeComponent => ({
  id,
  name: id.toUpperCase(),
  kind,
  version: 'test-v1',
  description: `Description ${id}`,
  prompt,
  tags: [],
  roleHints: [],
  enabled,
  order,
  charWeight: prompt.length,
});

const parent = (
  id: string,
  components: GenomeComponent[],
  mode: Genome['mode'] = 'stack',
  customSeed?: string,
): Specimen => {
  const specimen = makeSpecimen({
    id: `genome-${id}`,
    mode,
    components,
    customSeed,
    ...(mode === 'fuse'
      ? { compiledKernel: 'PARENT FUSE KERNEL', compiledAt: 1, compilerVersion: 'test' }
      : {}),
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

const seed = (n: number): string => n.toString(16).padStart(32, '0').slice(-32);

describe('role-preserving genome crossover', () => {
  it('targets the exact parental mean when it is an integer', () => {
    const a = parent('a', [
      component('a1', 'mind', 0),
      component('a2', 'mind', 1),
      component('a3', 'operator', 2),
      component('a4', 'regulator', 3),
    ]);
    const b = parent('b', [
      component('b1', 'mind', 0),
      component('b2', 'mind', 1),
      component('b3', 'operator', 2),
      component('b4', 'operator', 3),
      component('b5', 'regulator', 4),
      component('b6', 'seed', 5),
    ]);

    const result = crossoverGenome(a, b, seed(1));

    expect(result.receipt.parentEnabledCounts).toEqual([4, 6]);
    expect(result.receipt.rawMean).toBe(5);
    expect(result.receipt.targetSize).toBe(5);
    expect(result.components).toHaveLength(5);
  });

  it('uses deterministic unbiased rounding for a half-integer mean', () => {
    const a = parent('a', Array.from({ length: 5 }, (_, i) => component(`a${i}`, 'mind', i)));
    const b = parent('b', Array.from({ length: 6 }, (_, i) => component(`b${i}`, 'mind', i)));

    const sizes = new Set<number>();
    for (let i = 1; i <= 64; i += 1) {
      const first = crossoverGenome(a, b, seed(i));
      const second = crossoverGenome(a, b, seed(i));
      expect(second.receipt.targetSize).toBe(first.receipt.targetSize);
      sizes.add(first.receipt.targetSize);
    }

    expect([...sizes].sort()).toEqual([5, 6]);
  });

  it('derives quotas by component kind and redistributes an unfillable quota', () => {
    const a = parent('a', [
      component('shared-mind', 'mind', 0),
      component('a-op-1', 'operator', 1),
      component('a-op-2', 'operator', 2),
      component('a-reg', 'regulator', 3),
    ]);
    const b = parent('b', [
      component('shared-mind', 'mind', 0),
      component('b-op', 'operator', 1),
      component('b-seed', 'seed', 2),
      component('b-media', 'media', 3),
    ]);

    const result = crossoverGenome(a, b, seed(7));

    expect(Object.values(result.receipt.roleQuotas).reduce((sum, value) => sum + value, 0))
      .toBe(result.receipt.targetSize);
    expect(result.components).toHaveLength(result.receipt.targetSize);
    expect(result.components.filter(item => item.kind === 'mind')).toHaveLength(1);
  });

  it('assigns shared functional candidates weight 2 and unique candidates weight 1', () => {
    const sharedA = component('shared', 'mind', 0, 'same behavior');
    const sharedB = component('shared', 'mind', 0, 'same behavior');
    const a = parent('a', [sharedA, component('a-only', 'mind', 1)]);
    const b = parent('b', [sharedB, component('b-only', 'mind', 1)]);

    const result = crossoverGenome(a, b, seed(11));
    const shared = result.receipt.candidates.find(item => item.componentId === 'shared');
    const aOnly = result.receipt.candidates.find(item => item.componentId === 'a-only');
    const bOnly = result.receipt.candidates.find(item => item.componentId === 'b-only');

    expect(shared).toMatchObject({ status: 'shared', weight: 2, sourceParentIds: ['a', 'b'] });
    expect(aOnly).toMatchObject({ status: 'unique', weight: 1, sourceParentIds: ['a'] });
    expect(bOnly).toMatchObject({ status: 'unique', weight: 1, sourceParentIds: ['b'] });
  });

  it('treats same-ID different snapshots as mutually exclusive divergent alleles', () => {
    const a = parent('a', [
      component('same-id', 'mind', 0, 'A allele'),
      component('a2', 'mind', 1),
    ]);
    const b = parent('b', [
      component('same-id', 'mind', 0, 'B allele'),
      component('b2', 'mind', 1),
    ]);

    const result = crossoverGenome(a, b, seed(19));
    const divergent = result.receipt.candidates.filter(item => item.componentId === 'same-id');

    expect(divergent).toHaveLength(2);
    expect(divergent.every(item => item.status === 'divergent-allele')).toBe(true);
    expect(result.components.filter(item => item.id === 'same-id').length).toBeLessThanOrEqual(1);
  });

  it('repairs unique parental contribution to within one whenever a legal same-role swap exists', () => {
    const a = parent('a', Array.from({ length: 4 }, (_, i) => component(`a${i}`, 'mind', i)));
    const b = parent('b', Array.from({ length: 4 }, (_, i) => component(`b${i}`, 'mind', i)));

    let repaired: ReturnType<typeof crossoverGenome> | undefined;
    for (let i = 1; i <= 256; i += 1) {
      const candidate = crossoverGenome(a, b, seed(i));
      if (candidate.receipt.candidates.some(item => item.balanceRepair)) {
        repaired = candidate;
        break;
      }
    }

    expect(repaired).toBeDefined();
    if (!repaired) return;

    const [fromA, fromB] = repaired.receipt.finalUniqueContribution;
    expect(Math.abs(fromA - fromB)).toBeLessThanOrEqual(1);
    expect(repaired.components).toHaveLength(repaired.receipt.targetSize);
  });

  it('does not let candidate array iteration order alter the selected identities', () => {
    const componentsA = [
      component('a1', 'mind', 0),
      component('a2', 'mind', 1),
      component('a3', 'operator', 2),
    ];
    const componentsB = [
      component('b1', 'mind', 0),
      component('b2', 'mind', 1),
      component('b3', 'operator', 2),
    ];

    const normal = crossoverGenome(parent('a', componentsA), parent('b', componentsB), seed(31));
    const shuffled = crossoverGenome(
      parent('a', [componentsA[2], componentsA[0], componentsA[1]]),
      parent('b', [componentsB[1], componentsB[2], componentsB[0]]),
      seed(31),
    );

    expect(shuffled.components.map(item => item.id))
      .toEqual(normal.components.map(item => item.id));
  });

  it('excludes disabled components from ordinary crossover', () => {
    const a = parent('a', [
      component('a-active', 'mind', 0),
      component('a-disabled', 'mind', 1, 'disabled', false),
    ]);
    const b = parent('b', [component('b-active', 'mind', 0)]);

    const result = crossoverGenome(a, b, seed(41));

    expect(result.receipt.parentEnabledCounts).toEqual([1, 1]);
    expect(result.receipt.candidates.some(item => item.componentId === 'a-disabled')).toBe(false);
    expect(result.components.some(item => item.id === 'a-disabled')).toBe(false);
  });

  it('ignores parent FUSE kernels and custom seed text', () => {
    const partsA = [component('a1', 'mind', 0), component('a2', 'operator', 1)];
    const partsB = [component('b1', 'mind', 0), component('b2', 'operator', 1)];

    const stack = crossoverGenome(parent('a', partsA), parent('b', partsB), seed(55));
    const fused = crossoverGenome(
      parent('a', partsA, 'fuse', 'do not inherit me'),
      parent('b', partsB, 'fuse', 'also excluded'),
      seed(55),
    );

    expect(fused.components.map(item => item.id)).toEqual(stack.components.map(item => item.id));
    expect(fused.receipt).toEqual(stack.receipt);
  });

  it('produces deterministic child STACK ordering with consecutive child-local order values', () => {
    const a = parent('a', [
      component('a-first', 'mind', 0),
      component('a-last', 'operator', 10),
      component('a-mid', 'regulator', 5),
    ]);
    const b = parent('b', [
      component('b-last', 'operator', 10),
      component('b-first', 'mind', 0),
      component('b-mid', 'regulator', 5),
    ]);

    const first = crossoverGenome(a, b, seed(77));
    const second = crossoverGenome(b, a, seed(77));

    expect(second.components.map(item => item.id)).toEqual(first.components.map(item => item.id));
    expect(first.components.map(item => item.order)).toEqual(
      first.components.map((_, index) => index),
    );
    expect(first.components.every(item => item.enabled)).toBe(true);
  });
});
