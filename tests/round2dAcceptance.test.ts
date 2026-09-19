import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, unknown>());

vi.mock('localforage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: unknown) => {
      storage.set(key, structuredClone(value));
      return value;
    }),
  },
}));

import { createBreedingPreview } from '../lib/breeding';
import { verifyGeneticsReplay } from '../lib/geneticsReceipt';
import { createGenome } from '../lib/genome';
import { forkSpecimen } from '../lib/lineage';
import { acquireTrait, startInfection } from '../lib/mutations';
import {
  resolvePetriBreedingPair,
} from '../lib/petriActions';
import {
  applyPetriSelection,
} from '../lib/petriSelection';
import {
  createPetriChallengeHash,
  createPetriEntrantSnapshot,
} from '../lib/petriSnapshot';
import {
  createPetriTrial,
  PETRI_EXPERIMENT_INSTRUCTION_VERSION,
  retryPetriEntrant,
  runPetriTrial,
} from '../lib/petriRunner';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import {
  loadPetriTrials,
  PETRI_STORAGE_KEY,
  savePetriTrials,
} from '../services/petriStore';
import { makeSpecimen } from '../services/specimenStore';
import type { MutationProposal, Specimen } from '../types';

const proposal = (
  id: string,
  kind: MutationProposal['kind'],
  name: string,
  prompt: string,
): MutationProposal => ({
  id,
  kind,
  name,
  description: `${name} description`,
  prompt,
  reason: 'acceptance fixture',
  sourceMessageIds: [],
  sourceArtifactIds: [],
  sourceType: 'mutation-proposal',
});

const stack = (name: string, ids: string[]): Specimen =>
  makeSpecimen(createGenome(ids, SLOP_LIBRARY, 'stack'), name, 'spawned');

describe('Round 2D Petri Dish acceptance', () => {
  beforeEach(() => {
    storage.clear();
  });

  it('runs, retries, selects, persists, reloads, and hands live winners to breeding without changing specimens', async () => {
    let alpha = stack('ALPHA TRAIT', ['tm-01', 'tm-02']);
    alpha = acquireTrait(
      alpha,
      proposal(
        'trait-proposal',
        'trait',
        'Asymmetric selection',
        'Prefer asymmetric causal structures.',
      ),
      'explicit',
    );

    let beta = stack('BETA INFECTED', ['tm-03', 'tm-04']);
    beta = startInfection(
      beta,
      proposal(
        'infection-proposal',
        'infection',
        'Temporary inversion',
        'Invert the obvious first interpretation before answering.',
      ),
      { mode: 'turns', turns: 3 },
    );

    const fuseGenome = createGenome(['tm-05', 'tm-06'], SLOP_LIBRARY, 'fuse');
    const fused: Specimen = makeSpecimen({
      ...fuseGenome,
      compiledKernel: 'PERSISTED FUSE KERNEL FOR PETRI',
      compiledAt: 100,
      compilerVersion: 'test-fuse-v1',
    }, 'GAMMA FUSE', 'spawned');

    const forked = forkSpecimen(alpha, 'DELTA DESCENDANT', 200);
    alpha = forked.parent;
    const delta = forked.child;

    const live: Specimen[] = [alpha, beta, fused, delta];
    const beforeTrial = structuredClone(live);

    const snapshots = live.map((specimen, index) =>
      createPetriEntrantSnapshot(specimen, {
        now: 300,
        idFactory: () => `snap-${index}`,
      }));

    expect(snapshots[1].activeInfections[0].remainingTurns).toBe(3);
    expect(snapshots[2].genome.mode).toBe('fuse');
    expect(snapshots[2].genome.compiledKernel).toBe('PERSISTED FUSE KERNEL FOR PETRI');

    const challenge = 'Build one useful mechanism from the same pressure.';
    const trial = createPetriTrial({
      challenge,
      entrants: snapshots,
      config: {
        model: 'gemini-test',
        temperature: 0.9,
        maxOutputTokens: 2048,
        experimentInstructionVersion: PETRI_EXPERIMENT_INSTRUCTION_VERSION,
      },
      now: 400,
      idFactory: () => 'petri-acceptance',
    });

    const generate = vi.fn(async ({ systemInstruction, challenge: sentChallenge }: any) => {
      expect(sentChallenge).toBe(challenge);
      if (systemInstruction.includes('Specimen: BETA INFECTED')) {
        throw new Error('TEST_PROVIDER_FAILURE:temporary failure');
      }
      if (systemInstruction.includes('Specimen: ALPHA TRAIT')) return { text: 'alpha phenotype' };
      if (systemInstruction.includes('Specimen: GAMMA FUSE')) return { text: 'gamma phenotype' };
      return { text: 'delta phenotype' };
    });

    const firstRun = await runPetriTrial(trial, {
      generate,
      now: (() => {
        let n = 500;
        return () => n++;
      })(),
    });

    expect(generate).toHaveBeenCalledTimes(4);
    expect(firstRun.status).toBe('partial');
    expect(firstRun.results.filter(item => item.status === 'succeeded')).toHaveLength(3);
    expect(firstRun.results.filter(item => item.status === 'failed')).toHaveLength(1);

    expect(live).toEqual(beforeTrial);
    expect(beta.infections.find(item => item.status === 'active')?.remainingTurns).toBe(3);

    const retried = await retryPetriEntrant(firstRun, 'snap-1', {
      generate: vi.fn(async () => ({ text: 'beta phenotype after explicit retry', finishReason: 'STOP' })),
      now: (() => {
        let n = 600;
        return () => n++;
      })(),
    });

    expect(retried.status).toBe('complete');
    expect(retried.results[1].attempts).toHaveLength(2);
    expect(retried.results[1].outputText).toBe('beta phenotype after explicit retry');
    expect(live).toEqual(beforeTrial);

    const blindSelected = applyPetriSelection(retried, ['snap-0', 'snap-3'], {
      identityMode: 'blind',
      note: 'two useful weirdos',
      now: 700,
    });
    expect(blindSelected.selection?.identityMode).toBe('blind');

    await savePetriTrials([blindSelected]);
    expect(storage.has(PETRI_STORAGE_KEY)).toBe(true);

    const [reloaded] = await loadPetriTrials();
    expect(reloaded.challengeHash).toBe(createPetriChallengeHash(challenge));
    expect(reloaded.results.map(item => item.outputText)).toEqual([
      'alpha phenotype',
      'beta phenotype after explicit retry',
      'gamma phenotype',
      'delta phenotype',
    ]);

    const revealed = applyPetriSelection(reloaded, ['snap-0', 'snap-3'], {
      identityMode: 'revealed',
      note: 'same choice after reveal',
      now: 800,
    });
    expect(revealed.selection).toMatchObject({
      selectedEntrantSnapshotIds: ['snap-0', 'snap-3'],
      identityMode: 'revealed',
      selectedAt: 700,
      revisedAt: 800,
    });

    const currentAlpha = structuredClone(alpha);
    currentAlpha.currentGenome = createGenome(
      ['tm-01', 'tm-02', 'tm-07'],
      SLOP_LIBRARY,
      'stack',
    );
    currentAlpha.lastModified = 900;

    const liveAfterDeliberateChange = [currentAlpha, beta, fused, delta];
    const [parentA, parentB] = resolvePetriBreedingPair(
      revealed,
      liveAfterDeliberateChange,
    );

    expect(parentA.currentGenome.components).toHaveLength(3);
    expect(parentA.currentGenome).not.toEqual(
      revealed.entrants.find(item => item.id === 'snap-0')?.genome,
    );

    const beforePreviewParents = structuredClone([parentA, parentB]);
    const preview = createBreedingPreview(parentA, parentB, {
      seed: '0000000000000000000000000000009d',
      now: 1000,
      library: SLOP_LIBRARY,
    });

    expect(verifyGeneticsReplay(parentA, parentB, preview.receipt, {
      library: SLOP_LIBRARY,
    }).valid).toBe(true);
    expect([parentA, parentB]).toEqual(beforePreviewParents);
    expect(revealed.results.map(item => item.outputText)).toEqual([
      'alpha phenotype',
      'beta phenotype after explicit retry',
      'gamma phenotype',
      'delta phenotype',
    ]);
  });
});
