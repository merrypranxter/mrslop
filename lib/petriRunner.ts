import type {
  PetriEntrantAttempt,
  PetriEntrantResult,
  PetriEntrantSnapshot,
  PetriGenerationConfig,
  PetriTrial,
} from '../types';
import { assembleSystemInstruction } from './kernel';
import { stableHash } from './geneticsRandom';
import { createPetriChallengeHash } from './petriSnapshot';
import {
  sendPetriGeneration,
  type PetriGenerationRequest,
  type PetriGenerationResponse,
} from '../services/petriGenerationService';

export const PETRI_EXPERIMENT_INSTRUCTION_VERSION = 'mrslop-petri-v1';
export const PETRI_MAX_CONCURRENCY = 3;

export const PETRI_EXPERIMENT_INSTRUCTION = `
PETRI DISH EXPERIMENT

This is an isolated phenotype trial. Respond directly to the shared challenge using the frozen specimen machinery above.

Rules:
- Do not discuss being in a competition unless the challenge itself asks.
- Do not emit application-control JSON, mutation requests, fork requests, breeding requests, or choice-card instructions.
- Do not claim this trial changed the specimen.
- You cannot see other entrants and must not rank them.
- Return only the response this frozen specimen would produce for the challenge.
`.trim();

export interface CreatePetriTrialArgs {
  challenge: string;
  entrants: PetriEntrantSnapshot[];
  config: PetriGenerationConfig;
  now?: number;
  idFactory?: () => string;
}

export type PetriGenerate = (
  request: PetriGenerationRequest,
) => Promise<PetriGenerationResponse>;

export interface RunPetriOptions {
  generate?: PetriGenerate;
  signal?: AbortSignal;
  now?: () => number;
}

const clock = (now?: () => number): (() => number) => now ?? (() => Date.now());

const cloneTrial = (trial: PetriTrial): PetriTrial => structuredClone(trial);

const validateEntrants = (entrants: PetriEntrantSnapshot[]): void => {
  if (entrants.length < 2 || entrants.length > 8) {
    throw new Error('PETRI_ENTRANT_COUNT');
  }

  const specimenIds = new Set(entrants.map(item => item.specimenId));
  const snapshotIds = new Set(entrants.map(item => item.id));
  if (specimenIds.size !== entrants.length || snapshotIds.size !== entrants.length) {
    throw new Error('PETRI_DUPLICATE_ENTRANT');
  }
};

export const createPetriTrial = ({
  challenge,
  entrants,
  config,
  now = Date.now(),
  idFactory = () => crypto.randomUUID(),
}: CreatePetriTrialArgs): PetriTrial => {
  validateEntrants(entrants);
  if (!challenge.length) throw new Error('PETRI_CHALLENGE_REQUIRED');

  const entrantCopies = structuredClone(entrants);
  const challengeHash = createPetriChallengeHash(challenge);

  return {
    schemaVersion: 1,
    id: idFactory(),
    challenge,
    challengeHash,
    status: 'draft',
    model: config.model,
    temperature: config.temperature,
    maxOutputTokens: config.maxOutputTokens,
    experimentInstructionVersion: config.experimentInstructionVersion,
    entrantOrder: entrantCopies.map(item => item.id),
    entrants: entrantCopies,
    results: entrantCopies.map(item => ({
      entrantSnapshotId: item.id,
      specimenId: item.specimenId,
      status: 'pending',
      attempts: [],
    })),
    selection: null,
    createdAt: now,
    lastModified: now,
  };
};

const frozenSpecimenSummary = (snapshot: PetriEntrantSnapshot): string => [
  'PETRI FROZEN SUBJECT',
  `Specimen: ${snapshot.specimenName}`,
  `Generation: ${snapshot.generation}`,
  `Lineage: ${snapshot.lineageKind}`,
  `Snapshot drift: ${snapshot.driftBand} (${snapshot.driftScore})`,
  `Snapshot state hash: ${snapshot.stateHash}`,
].join('\n');

export const assemblePetriSystemInstruction = (
  snapshot: PetriEntrantSnapshot,
): string => {
  const base = assembleSystemInstruction({
    phase: 'spawned',
    catalogIndex: '',
    genome: snapshot.genome,
    acquiredTraits: snapshot.activeTraits,
    infections: snapshot.activeInfections,
    specimenState: frozenSpecimenSummary(snapshot),
  });

  return [
    base,
    `PETRI EXPERIMENT INSTRUCTION VERSION: ${PETRI_EXPERIMENT_INSTRUCTION_VERSION}`,
    PETRI_EXPERIMENT_INSTRUCTION,
  ].join('\n\n');
};

const parseError = (error: unknown): { code: string; message: string } => {
  if (error instanceof Error) {
    const raw = error.message || error.name;
    const separator = raw.indexOf(':');
    if (separator > 0) {
      const candidate = raw.slice(0, separator);
      if (/^[A-Z0-9_]+$/.test(candidate)) {
        return {
          code: candidate,
          message: raw.slice(separator + 1) || raw,
        };
      }
    }

    return {
      code: error.name === 'AbortError' ? 'ABORTED' : 'PETRI_GENERATION_FAILED',
      message: raw,
    };
  }

  return {
    code: 'PETRI_GENERATION_FAILED',
    message: String(error ?? 'Unknown Petri generation failure.'),
  };
};

const trialConfig = (trial: PetriTrial): PetriGenerationConfig => ({
  model: trial.model,
  temperature: trial.temperature,
  maxOutputTokens: trial.maxOutputTokens,
  experimentInstructionVersion: trial.experimentInstructionVersion,
});

const attemptNumberFor = (result: PetriEntrantResult): number =>
  result.attempts.length + 1;

const makeAbortedAttempt = (
  trial: PetriTrial,
  snapshot: PetriEntrantSnapshot,
  result: PetriEntrantResult,
  now: () => number,
): PetriEntrantAttempt => {
  const startedAt = now();
  const systemInstruction = assemblePetriSystemInstruction(snapshot);
  return {
    attempt: attemptNumberFor(result),
    status: 'aborted',
    startedAt,
    endedAt: now(),
    errorCode: 'ABORTED',
    errorMessage: 'Petri trial was aborted before this entrant completed.',
    systemInstructionHash: stableHash(systemInstruction),
    systemInstruction,
    challengeHash: trial.challengeHash,
    entrantStateHash: snapshot.stateHash,
  };
};

const executeAttempt = async (
  trial: PetriTrial,
  snapshot: PetriEntrantSnapshot,
  result: PetriEntrantResult,
  options: Required<Pick<RunPetriOptions, 'generate'>> & Pick<RunPetriOptions, 'signal'> & { now: () => number },
): Promise<PetriEntrantResult> => {
  if (options.signal?.aborted) {
    const attempt = makeAbortedAttempt(trial, snapshot, result, options.now);
    return {
      ...result,
      status: 'aborted',
      attempts: [...result.attempts, attempt],
      errorCode: attempt.errorCode,
      errorMessage: attempt.errorMessage,
      outputText: undefined,
      finishReason: undefined,
    };
  }

  const systemInstruction = assemblePetriSystemInstruction(snapshot);
  const startedAt = options.now();
  const attemptNumber = attemptNumberFor(result);
  const config = trialConfig(trial);

  try {
    const response = await options.generate({
      challenge: trial.challenge,
      systemInstruction,
      model: config.model,
      temperature: config.temperature,
      maxOutputTokens: config.maxOutputTokens,
      signal: options.signal,
    });

    const attempt: PetriEntrantAttempt = {
      attempt: attemptNumber,
      status: 'succeeded',
      startedAt,
      endedAt: options.now(),
      outputText: response.text,
      ...(response.finishReason ? { finishReason: response.finishReason } : {}),
      systemInstructionHash: stableHash(systemInstruction),
      systemInstruction,
      challengeHash: trial.challengeHash,
      entrantStateHash: snapshot.stateHash,
    };

    return {
      ...result,
      status: 'succeeded',
      attempts: [...result.attempts, attempt],
      outputText: response.text,
      ...(response.finishReason ? { finishReason: response.finishReason } : { finishReason: undefined }),
      errorCode: undefined,
      errorMessage: undefined,
    };
  } catch (error) {
    const parsed = parseError(error);
    const aborted = parsed.code === 'ABORTED' || options.signal?.aborted;
    const status = aborted ? 'aborted' as const : 'failed' as const;
    const attempt: PetriEntrantAttempt = {
      attempt: attemptNumber,
      status,
      startedAt,
      endedAt: options.now(),
      errorCode: aborted ? 'ABORTED' : parsed.code,
      errorMessage: parsed.message,
      systemInstructionHash: stableHash(systemInstruction),
      systemInstruction,
      challengeHash: trial.challengeHash,
      entrantStateHash: snapshot.stateHash,
    };

    return {
      ...result,
      status,
      attempts: [...result.attempts, attempt],
      outputText: undefined,
      finishReason: undefined,
      errorCode: attempt.errorCode,
      errorMessage: attempt.errorMessage,
    };
  }
};

const deriveTrialStatus = (results: PetriEntrantResult[]): PetriTrial['status'] =>
  results.every(item => item.status === 'succeeded') ? 'complete' : 'partial';

export const runPetriTrial = async (
  input: PetriTrial,
  options: RunPetriOptions = {},
): Promise<PetriTrial> => {
  validateEntrants(input.entrants);

  const trial = cloneTrial(input);
  const now = clock(options.now);
  const generate = options.generate ?? sendPetriGeneration;
  trial.status = 'running';
  trial.startedAt = trial.startedAt ?? now();
  trial.lastModified = trial.startedAt;

  const snapshotById = new Map(trial.entrants.map(item => [item.id, item]));
  let cursor = 0;

  const worker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= trial.results.length) return;

      const current = trial.results[index];
      const snapshot = snapshotById.get(current.entrantSnapshotId);
      if (!snapshot) throw new Error('PETRI_SNAPSHOT_NOT_FOUND');

      trial.results[index] = await executeAttempt(trial, snapshot, current, {
        generate,
        signal: options.signal,
        now,
      });
    }
  };

  const workerCount = Math.min(PETRI_MAX_CONCURRENCY, trial.results.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  trial.status = deriveTrialStatus(trial.results);
  trial.completedAt = now();
  trial.lastModified = trial.completedAt;
  return trial;
};

export const retryPetriEntrant = async (
  input: PetriTrial,
  entrantSnapshotId: string,
  options: RunPetriOptions = {},
): Promise<PetriTrial> => {
  const trial = cloneTrial(input);
  const resultIndex = trial.results.findIndex(
    item => item.entrantSnapshotId === entrantSnapshotId,
  );
  if (resultIndex < 0) throw new Error('PETRI_RESULT_NOT_FOUND');

  const current = trial.results[resultIndex];
  if (current.status !== 'failed' && current.status !== 'aborted') {
    throw new Error('PETRI_RETRY_NOT_ALLOWED');
  }

  const snapshot = trial.entrants.find(item => item.id === entrantSnapshotId);
  if (!snapshot) throw new Error('PETRI_SNAPSHOT_NOT_FOUND');

  const now = clock(options.now);
  const generate = options.generate ?? sendPetriGeneration;
  trial.status = 'running';
  trial.results[resultIndex] = await executeAttempt(trial, snapshot, current, {
    generate,
    signal: options.signal,
    now,
  });

  trial.status = deriveTrialStatus(trial.results);
  if (trial.status === 'complete') {
    trial.completedAt = now();
  }
  trial.lastModified = now();
  return trial;
};
