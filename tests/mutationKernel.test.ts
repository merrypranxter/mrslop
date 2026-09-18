import { describe, expect, it } from 'vitest';
import { assembleSystemInstruction } from '../lib/kernel';
import { compileMutationRuntimeLayer } from '../lib/mutations';
import { AcquiredTrait, Genome, Infection, MutationProvenance } from '../types';

const provenance: MutationProvenance = {
  specimenId: 'specimen-1',
  genomeId: 'genome-1',
  sourceType: 'conversation',
  sourceMessageIds: ['m1'],
  sourceArtifactIds: [],
};

const trait = (overrides: Partial<AcquiredTrait> = {}): AcquiredTrait => ({
  id: 'trait-1',
  name: 'Navigation Harmony',
  description: 'Translate harmony into navigation.',
  prompt: 'When harmony stalls, remap it as navigation through a strange space.',
  status: 'active',
  originType: 'fossilized-accident',
  provenance,
  createdAt: 1,
  ...overrides,
});

const infection = (overrides: Partial<Infection> = {}): Infection => ({
  id: 'infection-1',
  name: 'Metric Vertigo',
  description: 'Use an alien distance metric temporarily.',
  prompt: 'Measure conceptual distance with a deliberately alien metric.',
  status: 'active',
  durationMode: 'turns',
  durationTurns: 3,
  remainingTurns: 3,
  provenance,
  createdAt: 2,
  ...overrides,
});

const stackGenome: Genome = {
  id: 'genome-1',
  mode: 'stack',
  components: [{
    id: 'mind-1',
    name: 'BASE MIND',
    kind: 'mind',
    version: 'test',
    description: 'base',
    prompt: 'BASE_COMPONENT_PROMPT',
    tags: [],
    roleHints: [],
    enabled: true,
    order: 0,
    charWeight: 21,
  }],
};

describe('mutation runtime prompt layers', () => {
  it('formats active traits and infections as separate deterministic runtime layers', () => {
    const result = compileMutationRuntimeLayer(
      [trait()],
      [infection()],
    );

    expect(result).toContain('ACTIVE ACQUIRED TRAITS');
    expect(result).toContain('--- TRAIT trait-1 :: Navigation Harmony ---');
    expect(result).toContain('When harmony stalls');
    expect(result).toContain('ACTIVE TEMPORARY INFECTIONS');
    expect(result).toContain('--- INFECTION infection-1 :: Metric Vertigo :: 3 TURNS REMAINING ---');
    expect(result.indexOf('ACTIVE ACQUIRED TRAITS'))
      .toBeLessThan(result.indexOf('ACTIVE TEMPORARY INFECTIONS'));
  });

  it('orders active runtime records by createdAt then id regardless of input order', () => {
    const result = compileMutationRuntimeLayer(
      [
        trait({ id: 'trait-c', name: 'Trait C', createdAt: 20 }),
        trait({ id: 'trait-b', name: 'Trait B', createdAt: 10 }),
        trait({ id: 'trait-a', name: 'Trait A', createdAt: 10 }),
      ],
      [
        infection({ id: 'infection-c', name: 'Infection C', createdAt: 20 }),
        infection({ id: 'infection-b', name: 'Infection B', createdAt: 10 }),
        infection({ id: 'infection-a', name: 'Infection A', createdAt: 10 }),
      ],
    );

    expect(result.indexOf('TRAIT trait-a')).toBeLessThan(result.indexOf('TRAIT trait-b'));
    expect(result.indexOf('TRAIT trait-b')).toBeLessThan(result.indexOf('TRAIT trait-c'));
    expect(result.indexOf('INFECTION infection-a')).toBeLessThan(result.indexOf('INFECTION infection-b'));
    expect(result.indexOf('INFECTION infection-b')).toBeLessThan(result.indexOf('INFECTION infection-c'));
  });

  it('omits retired traits and inactive infections', () => {
    const result = compileMutationRuntimeLayer(
      [trait({ status: 'retired', retiredAt: 5 })],
      [
        infection({ status: 'expired', remainingTurns: 0, endedAt: 5 }),
        infection({ id: 'infection-2', status: 'removed', endedAt: 5 }),
        infection({ id: 'infection-3', status: 'promoted', endedAt: 5 }),
      ],
    );

    expect(result).toBe('');
  });

  it('labels indefinite infections without inventing a turn count', () => {
    const result = compileMutationRuntimeLayer(
      [],
      [infection({
        id: 'infection-indefinite',
        durationMode: 'indefinite',
        durationTurns: undefined,
        remainingTurns: undefined,
      })],
    );

    expect(result).toContain('INDEFINITE');
    expect(result).not.toContain('TURNS REMAINING');
  });

  it('layers active traits and infections after a STACK genome and before specimen state', () => {
    const result = assembleSystemInstruction({
      phase: 'spawned',
      catalogIndex: '',
      genome: stackGenome,
      acquiredTraits: [trait()],
      infections: [infection()],
      specimenState: 'STATE_MARKER',
    });

    expect(result.indexOf('ACTIVE SPECIMEN KERNEL'))
      .toBeLessThan(result.indexOf('ACTIVE ACQUIRED TRAITS'));
    expect(result.indexOf('ACTIVE ACQUIRED TRAITS'))
      .toBeLessThan(result.indexOf('ACTIVE TEMPORARY INFECTIONS'));
    expect(result.indexOf('ACTIVE TEMPORARY INFECTIONS'))
      .toBeLessThan(result.indexOf('CURRENT SPECIMEN STATE'));
    expect(result).toContain('BASE_COMPONENT_PROMPT');
  });

  it('does not alter or recompile the persisted FUSE kernel', () => {
    const fused: Genome = {
      ...stackGenome,
      mode: 'fuse',
      compiledKernel: 'PERSISTED_FUSE_KERNEL',
      compiledAt: 123,
      compilerVersion: 'test-compiler',
    };
    const before = structuredClone(fused);

    const result = assembleSystemInstruction({
      phase: 'spawned',
      catalogIndex: '',
      genome: fused,
      acquiredTraits: [trait()],
      infections: [infection()],
    });

    expect(fused).toEqual(before);
    expect(fused.compiledKernel).toBe('PERSISTED_FUSE_KERNEL');
    expect(result).toContain('PERSISTED_FUSE_KERNEL');
    expect(result).toContain(trait().prompt);
    expect(result).toContain(infection().prompt);
    expect(result).not.toContain('BASE_COMPONENT_PROMPT');
  });

  it('keeps builder mode free of specimen mutation layers', () => {
    const result = assembleSystemInstruction({
      phase: 'building',
      catalogIndex: 'CATALOG_MARKER',
      genome: stackGenome,
      acquiredTraits: [trait()],
      infections: [infection()],
    });

    expect(result).toContain('CATALOG_MARKER');
    expect(result).not.toContain('ACTIVE ACQUIRED TRAITS');
    expect(result).not.toContain('ACTIVE TEMPORARY INFECTIONS');
    expect(result).not.toContain(trait().prompt);
    expect(result).not.toContain(infection().prompt);
  });
});
