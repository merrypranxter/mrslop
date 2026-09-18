import { describe, expect, it, vi } from 'vitest';
import { createBreedingPreview } from '../lib/breeding';
import { commitBreedingPreview } from '../lib/breedingPersistence';
import { makeSpecimen } from '../services/specimenStore';
import { Role } from '../types';
import type { GenomeComponent, Specimen } from '../types';

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

const parent = (id: string, parts: string[]): Specimen => {
  const specimen = makeSpecimen({
    id: `g-${id}`,
    mode: 'stack',
    components: parts.map((part, index) => component(part, index)),
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

const fixtures = () => {
  const a = parent('a', ['shared', 'a-only']);
  const b = parent('b', ['shared', 'b-only']);
  a.currentGenome.components[0].prompt = 'same';
  b.currentGenome.components[0].prompt = 'same';

  const library = [
    component('shared', 0),
    component('a-only', 1),
    component('b-only', 2),
    component('novel', 3),
  ];

  let id = 0;
  const preview = createBreedingPreview(a, b, {
    seed: '00000000000000000000000000000011',
    now: 1000,
    idFactory: () => `preview-${id++}`,
    library,
    childName: 'BABY',
  });

  return { a, b, library, preview };
};

describe('atomic breeding persistence', () => {
  it('commits both parent offspring records plus the child with one collection save', async () => {
    const { a, b, preview } = fixtures();
    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);
    const save = vi.fn(async (_specimens: Specimen[]) => undefined);

    const result = await commitBreedingPreview(
      [a, b],
      preview,
      { now: 2000, save },
    );

    expect(result.status).toBe('committed');
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.specimens).toHaveLength(3);

    const savedA = result.specimens.find(item => item.id === a.id);
    const savedB = result.specimens.find(item => item.id === b.id);
    const child = result.specimens.find(item => item.id === preview.child.id);

    expect(savedA).toBeDefined();
    expect(savedB).toBeDefined();
    expect(child).toBeDefined();

    expect(savedA?.currentGenome).toEqual(beforeA.currentGenome);
    expect(savedA?.birthGenome).toEqual(beforeA.birthGenome);
    expect(savedA?.acquiredTraits).toEqual(beforeA.acquiredTraits);
    expect(savedA?.infections).toEqual(beforeA.infections);
    expect(savedA?.scars).toEqual(beforeA.scars);
    expect(savedA?.messages).toEqual(beforeA.messages);
    expect(savedA?.checkpoints).toEqual(beforeA.checkpoints);
    expect(savedA?.birthBaseline).toEqual(beforeA.birthBaseline);

    expect(savedB?.currentGenome).toEqual(beforeB.currentGenome);
    expect(savedB?.acquiredTraits).toEqual(beforeB.acquiredTraits);
    expect(savedB?.infections).toEqual(beforeB.infections);
    expect(savedB?.scars).toEqual(beforeB.scars);

    expect(savedA?.lifeHistory.at(-1)).toMatchObject({
      type: 'specimen-offspring-bred',
      relatedSpecimenId: preview.child.id,
      geneticsReceiptId: preview.receipt.id,
      breedingSeed: preview.receipt.breedingSeed,
      createdAt: 2000,
    });
    expect(savedA?.lifeHistory.at(-1)?.relatedSpecimenIds).toEqual([
      preview.child.id,
      b.id,
    ]);

    expect(savedB?.lifeHistory.at(-1)?.relatedSpecimenIds).toEqual([
      preview.child.id,
      a.id,
    ]);

    expect(child?.geneticsReceipt?.persistedAt).toBe(2000);
    expect(child?.lastModified).toBe(2000);
    expect(result.child.id).toBe(preview.child.id);

    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);
    expect(preview.receipt.persistedAt).toBeUndefined();
  });

  it('rejects a stale preview when breeding-relevant parent state changes', async () => {
    const { a, b, preview } = fixtures();
    const changedA: Specimen = {
      ...a,
      currentGenome: {
        ...a.currentGenome,
        components: a.currentGenome.components.map((part, index) =>
          index === 0 ? { ...part, prompt: part.prompt + ' changed' } : part),
      },
    };
    const save = vi.fn(async (_specimens: Specimen[]) => undefined);

    await expect(
      commitBreedingPreview([changedA, b], preview, { now: 2000, save }),
    ).rejects.toThrow('BREEDING_PREVIEW_STALE');

    expect(save).not.toHaveBeenCalled();
  });

  it('keeps a preview valid when only excluded chat or artifact state changes', async () => {
    const { a, b, preview } = fixtures();
    const changedA: Specimen = {
      ...a,
      messages: [{
        id: 'later-message',
        role: Role.USER,
        content: 'unrelated conversation after preview',
        timestamp: 1500,
      }],
      artifacts: [{
        id: 'later-artifact',
        specimenId: a.id,
        kind: 'other',
        title: 'unrelated',
        content: 'not breeding state',
        genomeId: a.currentGenome.id,
        componentIds: [],
        createdAt: 1501,
      }],
      lastModified: 1501,
    };
    const save = vi.fn(async (_specimens: Specimen[]) => undefined);

    const result = await commitBreedingPreview(
      [changedA, b],
      preview,
      { now: 2000, save },
    );

    expect(result.status).toBe('committed');
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.specimens.find(item => item.id === a.id)?.messages)
      .toEqual(changedA.messages);
  });

  it('does not expose any parent or child commit if the single persistence write fails', async () => {
    const { a, b, preview } = fixtures();
    const originals = structuredClone([a, b]);
    const save = vi.fn(async (_specimens: Specimen[]) => {
      throw new Error('DISK_SAID_NO');
    });

    await expect(
      commitBreedingPreview([a, b], preview, { now: 2000, save }),
    ).rejects.toThrow('DISK_SAID_NO');

    expect(save).toHaveBeenCalledTimes(1);
    expect([a, b]).toEqual(originals);
    expect(a.lifeHistory.some(event => event.type === 'specimen-offspring-bred')).toBe(false);
    expect(b.lifeHistory.some(event => event.type === 'specimen-offspring-bred')).toBe(false);
  });

  it('is idempotent when the same approved preview is submitted twice', async () => {
    const { a, b, preview } = fixtures();
    const saveFirst = vi.fn(async (_specimens: Specimen[]) => undefined);

    const first = await commitBreedingPreview(
      [a, b],
      preview,
      { now: 2000, save: saveFirst },
    );

    const saveSecond = vi.fn(async (_specimens: Specimen[]) => undefined);
    const second = await commitBreedingPreview(
      first.specimens,
      preview,
      { now: 3000, save: saveSecond },
    );

    expect(second.status).toBe('existing');
    expect(second.child.id).toBe(first.child.id);
    expect(second.specimens).toEqual(first.specimens);
    expect(saveSecond).not.toHaveBeenCalled();

    const parentA = second.specimens.find(item => item.id === a.id);
    const matchingEvents = parentA?.lifeHistory.filter(event =>
      event.type === 'specimen-offspring-bred' &&
      event.relatedSpecimenId === first.child.id);
    expect(matchingEvents).toHaveLength(1);
  });

  it('allows the same pair to intentionally breed again with a new seed', async () => {
    const { a, b, library, preview } = fixtures();
    const first = await commitBreedingPreview(
      [a, b],
      preview,
      { now: 2000, save: async () => undefined },
    );

    const currentA = first.specimens.find(item => item.id === a.id)!;
    const currentB = first.specimens.find(item => item.id === b.id)!;
    let id = 0;
    const siblingPreview = createBreedingPreview(currentA, currentB, {
      seed: '00000000000000000000000000000012',
      now: 2500,
      idFactory: () => `sibling-${id++}`,
      library,
      childName: 'SIBLING',
    });

    expect(siblingPreview.receipt.idempotencyKey)
      .not.toBe(preview.receipt.idempotencyKey);

    const second = await commitBreedingPreview(
      first.specimens,
      siblingPreview,
      { now: 3000, save: async () => undefined },
    );

    expect(second.status).toBe('committed');
    expect(second.specimens).toHaveLength(4);
    const children = second.specimens.filter(item => item.lineage.kind === 'bred');
    expect(children).toHaveLength(2);
    expect(new Set(children.map(item => item.id)).size).toBe(2);
  });
});
