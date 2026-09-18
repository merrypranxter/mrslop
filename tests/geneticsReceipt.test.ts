import { describe, expect, it } from 'vitest';
import {
  renderGeneticsReceipt,
  verifyGeneticsReplay,
} from '../lib/geneticsReceipt';
import { createBreedingPreview } from '../lib/breeding';
import { makeSpecimen } from '../services/specimenStore';
import type { AcquiredTrait, GenomeComponent, Specimen } from '../types';

const component = (id: string, order: number): GenomeComponent => ({
  id,
  name: id.toUpperCase(),
  kind: order % 2 === 0 ? 'mind' : 'operator',
  version: 'test-v1',
  description: id,
  prompt: `Prompt ${id}`,
  tags: [],
  roleHints: [],
  enabled: true,
  order,
  charWeight: 10,
});

const parent = (id: string, ids: string[]): Specimen => {
  const specimen = makeSpecimen({
    id: `g-${id}`,
    mode: 'stack',
    components: ids.map((part, index) => component(part, index)),
  }, id.toUpperCase(), 'spawned');

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

const trait = (specimen: Specimen, id: string, prompt: string): AcquiredTrait => ({
  id,
  name: id,
  description: id,
  prompt,
  status: 'active',
  originType: 'fossilized-accident',
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 1,
});

const fixtures = () => {
  const a = parent('a', ['shared', 'a-only']);
  const b = parent('b', ['shared', 'b-only', 'b-extra']);
  a.currentGenome.components[0].prompt = 'same shared';
  b.currentGenome.components[0].prompt = 'same shared';
  a.acquiredTraits = [trait(a, 'trait-a', 'Trait A behavior')];
  b.acquiredTraits = [trait(b, 'trait-b', 'Trait B behavior')];
  return { a, b };
};

const library = [
  component('shared', 0),
  component('a-only', 1),
  component('b-only', 2),
  component('b-extra', 3),
  component('novel', 4),
];

const ids = () => {
  let i = 0;
  return () => `id-${i++}`;
};

describe('GENETICS RECEIPT rendering and replay', () => {
  it('renders only stored deterministic facts and requires no model prose', () => {
    const { a, b } = fixtures();
    const preview = createBreedingPreview(a, b, {
      seed: '000000000000000000000000000000ff',
      now: 1000,
      idFactory: ids(),
      library,
    });

    const text = renderGeneticsReceipt(preview.receipt, {
      a: 'ALPHA',
      b: 'BETA',
    });

    expect(text).toContain('GENETICS RECEIPT');
    expect(text).toContain('mrslop-breeding-v1');
    expect(text).toContain('ordinary target');
    expect(text).toContain('Birth mutation');
    expect(text).toContain('ALPHA');
    expect(text).toContain('BETA');
  });

  it('replays the receipt against unchanged parents and reproduces the genetic result', () => {
    const { a, b } = fixtures();
    const preview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000123',
      now: 1000,
      idFactory: ids(),
      library,
    });

    const replay = verifyGeneticsReplay(a, b, preview.receipt, { library });

    expect(replay.valid).toBe(true);
    expect(replay.errors).toEqual([]);
    expect(replay.finalBirthState).toEqual(preview.receipt.finalBirthState);
  });

  it('rejects replay when breeding-relevant parent state no longer matches the receipt', () => {
    const { a, b } = fixtures();
    const preview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000177',
      now: 1000,
      idFactory: ids(),
      library,
    });

    const changedA: Specimen = {
      ...a,
      currentGenome: {
        ...a.currentGenome,
        components: a.currentGenome.components.map((part, index) =>
          index === 0 ? { ...part, prompt: part.prompt + ' changed' } : part),
      },
    };

    const replay = verifyGeneticsReplay(changedA, b, preview.receipt, { library });

    expect(replay.valid).toBe(false);
    expect(replay.errors).toContain('PARENT_STATE_HASH_MISMATCH');
  });

  it('keeps a birth receipt immutable when the child later changes', () => {
    const { a, b } = fixtures();
    const preview = createBreedingPreview(a, b, {
      seed: '00000000000000000000000000000199',
      now: 1000,
      idFactory: ids(),
      library,
    });

    const receiptBefore = structuredClone(preview.receipt);
    preview.child.currentGenome.components.push(component('later-change', 99));
    preview.child.acquiredTraits.push(trait(preview.child, 'later-trait', 'post-birth'));

    expect(preview.receipt).toEqual(receiptBefore);
    expect(preview.child.geneticsReceipt).toEqual(receiptBefore);
  });
});
