import localforage from 'localforage';
import type {
  AcquiredTrait,
  Genome,
  Infection,
  PetriEntrantAttempt,
  PetriEntrantResult,
  PetriEntrantSnapshot,
  PetriSelection,
  PetriTrial,
} from '../types';

export const PETRI_STORAGE_KEY = 'mrslop_petri_trials_v1';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isGenome = (value: unknown): value is Genome => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    (value.mode === 'stack' || value.mode === 'fuse') &&
    Array.isArray(value.components);
};

const isTrait = (value: unknown): value is AcquiredTrait => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.prompt === 'string' &&
    (value.status === 'active' || value.status === 'retired') &&
    typeof value.originType === 'string' &&
    isRecord(value.provenance) &&
    isFiniteNumber(value.createdAt);
};

const isInfection = (value: unknown): value is Infection => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.prompt === 'string' &&
    ['active', 'expired', 'removed', 'promoted'].includes(String(value.status)) &&
    (value.durationMode === 'turns' || value.durationMode === 'indefinite') &&
    isRecord(value.provenance) &&
    isFiniteNumber(value.createdAt);
};

const isEntrantSnapshot = (value: unknown): value is PetriEntrantSnapshot => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.specimenId === 'string' &&
    typeof value.specimenName === 'string' &&
    value.specimenSchemaVersion === 4 &&
    typeof value.stateHash === 'string' &&
    Number.isInteger(value.generation) &&
    Number(value.generation) >= 0 &&
    ['root', 'fork', 'bred'].includes(String(value.lineageKind)) &&
    isFiniteNumber(value.driftScore) &&
    ['LOW', 'MODERATE', 'HIGH', 'EXTREME'].includes(String(value.driftBand)) &&
    isGenome(value.genome) &&
    Array.isArray(value.activeTraits) &&
    value.activeTraits.every(isTrait) &&
    Array.isArray(value.activeInfections) &&
    value.activeInfections.every(isInfection) &&
    isFiniteNumber(value.capturedAt);
};

const isResultStatus = (value: unknown): boolean =>
  ['pending', 'running', 'succeeded', 'failed', 'aborted'].includes(String(value));

const isAttempt = (value: unknown): value is PetriEntrantAttempt => {
  if (!isRecord(value)) return false;
  return Number.isInteger(value.attempt) &&
    Number(value.attempt) >= 1 &&
    isResultStatus(value.status) &&
    isFiniteNumber(value.startedAt) &&
    (value.endedAt === undefined || isFiniteNumber(value.endedAt)) &&
    (value.outputText === undefined || typeof value.outputText === 'string') &&
    (value.finishReason === undefined || typeof value.finishReason === 'string') &&
    (value.errorCode === undefined || typeof value.errorCode === 'string') &&
    (value.errorMessage === undefined || typeof value.errorMessage === 'string') &&
    typeof value.systemInstructionHash === 'string' &&
    typeof value.challengeHash === 'string' &&
    typeof value.entrantStateHash === 'string';
};

const isEntrantResult = (value: unknown): value is PetriEntrantResult => {
  if (!isRecord(value)) return false;
  return typeof value.entrantSnapshotId === 'string' &&
    typeof value.specimenId === 'string' &&
    isResultStatus(value.status) &&
    Array.isArray(value.attempts) &&
    value.attempts.every(isAttempt) &&
    (value.outputText === undefined || typeof value.outputText === 'string') &&
    (value.finishReason === undefined || typeof value.finishReason === 'string') &&
    (value.errorCode === undefined || typeof value.errorCode === 'string') &&
    (value.errorMessage === undefined || typeof value.errorMessage === 'string');
};

const isSelection = (value: unknown): value is PetriSelection => {
  if (!isRecord(value)) return false;
  return isStringArray(value.selectedEntrantSnapshotIds) &&
    (value.note === undefined || typeof value.note === 'string') &&
    (value.identityMode === 'blind' || value.identityMode === 'revealed') &&
    isFiniteNumber(value.selectedAt) &&
    (value.revisedAt === undefined || isFiniteNumber(value.revisedAt));
};

export const isPetriTrial = (value: unknown): value is PetriTrial => {
  if (!isRecord(value)) return false;
  return value.schemaVersion === 1 &&
    typeof value.id === 'string' &&
    typeof value.challenge === 'string' &&
    typeof value.challengeHash === 'string' &&
    ['draft', 'running', 'partial', 'complete', 'abandoned'].includes(String(value.status)) &&
    typeof value.model === 'string' &&
    isFiniteNumber(value.temperature) &&
    isFiniteNumber(value.maxOutputTokens) &&
    typeof value.experimentInstructionVersion === 'string' &&
    isStringArray(value.entrantOrder) &&
    Array.isArray(value.entrants) &&
    value.entrants.every(isEntrantSnapshot) &&
    Array.isArray(value.results) &&
    value.results.every(isEntrantResult) &&
    (value.selection === null || isSelection(value.selection)) &&
    isFiniteNumber(value.createdAt) &&
    (value.startedAt === undefined || isFiniteNumber(value.startedAt)) &&
    (value.completedAt === undefined || isFiniteNumber(value.completedAt)) &&
    isFiniteNumber(value.lastModified);
};

const cloneTrial = (trial: PetriTrial): PetriTrial => structuredClone(trial);

export const loadPetriTrials = async (): Promise<PetriTrial[]> => {
  try {
    const stored = await localforage.getItem<unknown>(PETRI_STORAGE_KEY);
    if (!Array.isArray(stored)) return [];
    return stored
      .filter(isPetriTrial)
      .map(cloneTrial);
  } catch (error) {
    console.warn('[MR_SLOP_PETRI] Could not load Petri trials.', error);
    return [];
  }
};

export const savePetriTrials = async (trials: PetriTrial[]): Promise<void> => {
  const snapshot = trials
    .filter(isPetriTrial)
    .map(cloneTrial);
  await localforage.setItem(PETRI_STORAGE_KEY, snapshot);
};
