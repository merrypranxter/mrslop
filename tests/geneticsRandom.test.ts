import { describe, expect, it } from 'vitest';
import {
  GENETICS_ALGORITHM_VERSION,
  canonicalParentIds,
  deterministicUniform,
  generateBreedingSeed,
  stableHash,
  stableSerialize,
} from '../lib/geneticsRandom';

describe('deterministic genetics primitives', () => {
  it('generates a 128-bit seed as 32 lowercase hex characters', () => {
    const seed = generateBreedingSeed();
    expect(seed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('serializes object keys canonically while preserving array order', () => {
    expect(stableSerialize({ b: 2, a: 1, nested: { z: true, y: false } }))
      .toBe(stableSerialize({ nested: { y: false, z: true }, a: 1, b: 2 }));

    expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
    expect(stableHash({ values: ['a', 'b'] })).not.toBe(stableHash({ values: ['b', 'a'] }));
  });

  it('returns the same uniform value for the same seed namespace and key', () => {
    const seed = '00112233445566778899aabbccddeeff';
    const first = deterministicUniform(seed, 'trait-roll', 'trait:abc');
    const second = deterministicUniform(seed, 'trait-roll', 'trait:abc');

    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(1);
  });

  it('keeps independent decision namespaces and keys independent', () => {
    const seed = '00112233445566778899aabbccddeeff';

    expect(deterministicUniform(seed, 'trait-roll', 'trait:abc'))
      .not.toBe(deterministicUniform(seed, 'component-roll', 'trait:abc'));
    expect(deterministicUniform(seed, 'trait-roll', 'trait:abc'))
      .not.toBe(deterministicUniform(seed, 'trait-roll', 'trait:def'));
  });

  it('canonicalizes parent IDs so selector order cannot create genetic dominance', () => {
    expect(canonicalParentIds('specimen-b', 'specimen-a'))
      .toEqual(['specimen-a', 'specimen-b']);
    expect(canonicalParentIds('specimen-a', 'specimen-b'))
      .toEqual(['specimen-a', 'specimen-b']);
  });

  it('produces the same pair-scoped decision when parent selector order is reversed', () => {
    const seed = 'fedcba98765432100123456789abcdef';
    const forward = canonicalParentIds('b-parent', 'a-parent').join('|');
    const reverse = canonicalParentIds('a-parent', 'b-parent').join('|');

    expect(deterministicUniform(seed, 'pair-probe', forward))
      .toBe(deterministicUniform(seed, 'pair-probe', reverse));
  });

  it('pins the first genetics algorithm version in the decision input', () => {
    expect(GENETICS_ALGORITHM_VERSION).toBe('mrslop-breeding-v1');

    const seed = '00112233445566778899aabbccddeeff';
    const value = deterministicUniform(seed, 'version-probe', 'x');
    expect(value).toBe(deterministicUniform(seed, 'version-probe', 'x'));
  });
});
