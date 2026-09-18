import { describe, expect, it } from 'vitest';
import { createBreedingPreview } from '../lib/breeding';
import { calculateDrift } from '../lib/drift';
import { makeSpecimen } from '../services/specimenStore';
import { Role } from '../types';
import type { AcquiredTrait, GenomeComponent, Scar, Specimen } from '../types';

const component = (
  id: string,
  kind: GenomeComponent['kind'],
  order: number,
  prompt = `Prompt ${id}`,
): GenomeComponent => ({
  id,
  name: id.toUpperCase(),
  kind,
  version: 'test-v1',
  description: `Description ${id}`,
  prompt,
  tags: [],
  roleHints: [],
  enabled: true,
  order,
  charWeight: prompt.length,
});

const makeParent = (
  id: string,
  generation: number,
  roots: string[],
  parts: GenomeComponent[],
): Specimen => {
  const specimen = makeSpecimen({
    id: `genome-${id}`,
    mode: 'fuse',
    components: parts,
    customSeed: `custom seed ${id}`,
    compiledKernel: `compiled kernel ${id}`,
    compiledAt: 99,
    compilerVersion: 'test',
  }, id.toUpperCase(), 'spawned');

  return {
    ...specimen,
    id,
    messages: [{
      id: `message-${id}`,
      role: Role.USER,
      content: `parent history ${id}`,
      timestamp: 1,
    }],
    artifacts: [{
      id: `artifact-${id}`,
      specimenId: id,
      kind: 'other',
      title: 'parent artifact',
      content: 'do not cross',
      genomeId: specimen.currentGenome.id,
      componentIds: [],
      createdAt: 2,
    }],
    lineage: {
      kind: generation === 0 ? 'root' : 'fork',
      parentSpecimenIds: generation === 0 ? [] : [`ancestor-${id}`],
      rootSpecimenIds: roots,
      generation,
      source: generation === 0 ? 'native-v4' : 'fork-v4',
    },
  };
};

const trait = (
  specimen: Specimen,
  id: string,
  prompt: string,
  originType: AcquiredTrait['originType'],
): AcquiredTrait => ({
  id,
  name: id,
  description: id,
  prompt,
  status: 'active',
  originType,
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 5,
});

const scar = (specimen: Specimen, traitId: string): Scar => ({
  id: `scar-${traitId}`,
  name: 'support',
  description: 'direct support',
  kind: 'fossilized-accident',
  origin: 'experienced',
  createdAt: 6,
  sourceSpecimenId: specimen.id,
  relatedEventIds: [],
  relatedMutationIds: [traitId],
  relatedCheckpointIds: [],
  messageIds: [],
  artifactIds: [],
});

const fixtures = () => {
  const a = makeParent('z-parent', 2, ['root-z'], [
    component('shared', 'mind', 0, 'same'),
    component('a-op', 'operator', 1),
    component('a-reg', 'regulator', 2),
  ]);
  const b = makeParent('a-parent', 4, ['root-a', 'root-z'], [
    component('shared', 'mind', 0, 'same'),
    component('b-op', 'operator', 1),
    component('b-seed', 'seed', 2),
    component('b-reg', 'regulator', 3),
    component('b-media', 'media', 4),
  ]);

  a.acquiredTraits = [
    trait(a, 'a-ordinary', 'ordinary A behavior', 'explicit'),
    trait(a, 'a-fossil', 'fossil A behavior', 'fossilized-accident'),
  ];
  a.scars = [scar(a, 'a-fossil')];
  b.acquiredTraits = [
    trait(b, 'b-promoted', 'promoted B behavior', 'promoted-infection'),
    trait(b, 'b-shared', 'shared behavior', 'explicit'),
  ];
  a.acquiredTraits.push(trait(a, 'a-shared', 'shared behavior', 'explicit'));

  return { a, b };
};

const library = [
  component('shared', 'mind', 0, 'same'),
  component('a-op', 'operator', 1),
  component('a-reg', 'regulator', 2),
  component('b-op', 'operator', 3),
  component('b-seed', 'seed', 4),
  component('b-reg', 'regulator', 5),
  component('b-media', 'media', 6),
  component('novel', 'mind', 7),
];

const idFactory = () => {
  let i = 0;
  return () => `preview-id-${i++}`;
};

describe('pure Round 2C breeding preview', () => {
  it('requires two distinct spawned parents', () => {
    const { a, b } = fixtures();
    expect(() => createBreedingPreview(a, a, { seed: '1'.padStart(32, '0') }))
      .toThrow('BREEDING_REQUIRES_DISTINCT_PARENTS');

    const building = { ...b, phase: 'building' as const };
    expect(() => createBreedingPreview(a, building, { seed: '1'.padStart(32, '0') }))
      .toThrow('BREEDING_REQUIRES_SPAWNED_PARENTS');
  });

  it('builds a fresh STACK child from lived parent state with true two-parent lineage', () => {
    const { a, b } = fixtures();
    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);

    const preview = createBreedingPreview(a, b, {
      seed: '0000000000000000000000000000002a',
      now: 1000,
      idFactory: idFactory(),
      library,
      childName: 'TEST BABY',
    });

    expect(preview.child.name).toBe('TEST BABY');
    expect(preview.child.phase).toBe('spawned');
    expect(preview.child.currentGenome.mode).toBe('stack');
    expect(preview.child.birthGenome.mode).toBe('stack');
    expect(preview.child.currentGenome.compiledKernel).toBeUndefined();
    expect(preview.child.currentGenome.customSeed).toBeUndefined();
    expect(preview.child.birthGenome.compiledKernel).toBeUndefined();
    expect(preview.child.birthGenome.customSeed).toBeUndefined();

    expect(preview.child.lineage).toMatchObject({
      kind: 'bred',
      parentSpecimenIds: ['a-parent', 'z-parent'],
      rootSpecimenIds: ['root-a', 'root-z'],
      generation: 5,
      bredAt: 1000,
      source: 'bred-v4',
      geneticsReceiptId: preview.receipt.id,
    });

    expect(preview.child.messages).toHaveLength(1);
    expect(preview.child.messages[0].role).toBe(Role.SYSTEM);
    expect(preview.child.messages[0].content).toContain('A-PARENT');
    expect(preview.child.messages[0].content).toContain('Z-PARENT');
    expect(preview.child.messages[0].content).toContain('Born STACK');
    expect(preview.child.messages.some(message => message.content.includes('parent history'))).toBe(false);

    expect(preview.child.artifacts).toEqual([]);
    expect(preview.child.checkpoints).toEqual([]);
    expect(preview.child.infections).toEqual([]);
    expect(preview.child.scars).toEqual([]);
    expect(preview.child.lifeHistory).toHaveLength(1);
    expect(preview.child.lifeHistory[0]).toMatchObject({
      type: 'specimen-born-from-breeding',
      relatedSpecimenIds: ['a-parent', 'z-parent'],
      geneticsReceiptId: preview.receipt.id,
      breedingSeed: preview.receipt.breedingSeed,
    });

    expect(calculateDrift(preview.child).score).toBe(0);
    expect(preview.child.birthBaseline.source).toBe('bred-v4');
    expect(preview.child.birthBaseline.capturedAt).toBe(1000);
    expect(preview.child.birthBaseline.activeTraitIds)
      .toEqual(preview.child.acquiredTraits.map(item => item.id));

    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);
  });

  it('makes the genetic result and idempotency key neutral to selector order', () => {
    const { a, b } = fixtures();
    const seed = '0000000000000000000000000000004d';

    const forward = createBreedingPreview(a, b, {
      seed,
      now: 1000,
      idFactory: idFactory(),
      library,
    });
    const reverse = createBreedingPreview(b, a, {
      seed,
      now: 1000,
      idFactory: idFactory(),
      library,
    });

    expect(reverse.receipt.finalBirthState).toEqual(forward.receipt.finalBirthState);
    expect(reverse.receipt.genome).toEqual(forward.receipt.genome);
    expect(reverse.receipt.traits).toEqual(forward.receipt.traits);
    expect(reverse.receipt.mutation).toEqual(forward.receipt.mutation);
    expect(reverse.receipt.idempotencyKey).toBe(forward.receipt.idempotencyKey);
    expect(reverse.child.currentGenome.components.map(item => item.id))
      .toEqual(forward.child.currentGenome.components.map(item => item.id));
    expect(reverse.child.acquiredTraits.map(item => item.prompt))
      .toEqual(forward.child.acquiredTraits.map(item => item.prompt));

    expect(forward.receipt.parentAId).toBe('z-parent');
    expect(forward.receipt.parentBId).toBe('a-parent');
    expect(reverse.receipt.parentAId).toBe('a-parent');
    expect(reverse.receipt.parentBId).toBe('z-parent');
    expect(forward.receipt.canonicalParentIds).toEqual(['a-parent', 'z-parent']);
    expect(reverse.receipt.canonicalParentIds).toEqual(['a-parent', 'z-parent']);
  });

  it('stores canonical parent-state hashes and a complete final birth-state receipt', () => {
    const { a, b } = fixtures();
    const preview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000063',
      now: 1000,
      idFactory: idFactory(),
      library,
    });

    expect(preview.receipt.algorithmVersion).toBe('mrslop-breeding-v1');
    expect(preview.receipt.canonicalParentIds).toEqual(['a-parent', 'z-parent']);
    expect(preview.receipt.parentStateHashes).toHaveLength(2);
    expect(preview.receipt.parentStateHashes.every(hash => /^[0-9a-f]{32}$/.test(hash))).toBe(true);
    expect(preview.receipt.genome.candidates.length).toBeGreaterThan(0);
    expect(preview.receipt.traits.candidates.length).toBeGreaterThan(0);
    expect(preview.receipt.mutation.threshold).toBe(0.125);

    expect(preview.receipt.finalBirthState.mode).toBe('stack');
    expect(preview.receipt.finalBirthState.expectedLifetimeDrift).toBe(0);
    expect(preview.receipt.finalBirthState.componentIds)
      .toEqual(preview.child.currentGenome.components.map(item => item.id));
    expect(preview.receipt.finalBirthState.traitFingerprints)
      .toHaveLength(preview.child.acquiredTraits.length);
    expect(preview.child.geneticsReceipt).toEqual(preview.receipt);
  });

  it('generates a fresh 128-bit seed when one is not supplied', () => {
    const { a, b } = fixtures();
    const preview = createBreedingPreview(a, b, {
      now: 1000,
      idFactory: idFactory(),
      library,
    });
    expect(preview.receipt.breedingSeed).toMatch(/^[0-9a-f]{32}$/);
  });

  it('does not let child-local inherited trait IDs alter the genetic birth result', () => {
    const { a, b } = fixtures();
    const seed = '00000000000000000000000000000abcde';

    const firstIds = (() => {
      let i = 0;
      return () => `FIRST-${i++}`;
    })();
    const secondIds = (() => {
      let i = 0;
      return () => `SECOND-${i++}`;
    })();

    const first = createBreedingPreview(a, b, { seed, now: 1000, idFactory: firstIds, library });
    const second = createBreedingPreview(a, b, { seed, now: 1000, idFactory: secondIds, library });

    expect(second.receipt.finalBirthState).toEqual(first.receipt.finalBirthState);
    expect(second.receipt.mutation).toEqual(first.receipt.mutation);
    expect(second.child.acquiredTraits.map(item => item.prompt))
      .toEqual(first.child.acquiredTraits.map(item => item.prompt));
  });
});
