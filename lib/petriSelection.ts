import type {
  PetriSelectionIdentityMode,
  PetriTrial,
} from '../types';

export interface ApplyPetriSelectionOptions {
  identityMode: PetriSelectionIdentityMode;
  note?: string;
  now?: number;
}

const requireEntrant = (trial: PetriTrial, entrantSnapshotId: string) => {
  const entrant = trial.entrants.find(item => item.id === entrantSnapshotId);
  if (!entrant) throw new Error('PETRI_SELECTION_UNKNOWN_ENTRANT');
  return entrant;
};

export const petriBlindLabel = (
  trial: PetriTrial,
  entrantSnapshotId: string,
): string => {
  const index = trial.entrantOrder.indexOf(entrantSnapshotId);
  if (index < 0) throw new Error('PETRI_SELECTION_UNKNOWN_ENTRANT');
  return String.fromCharCode('A'.charCodeAt(0) + index);
};

export const petriEntrantDisplayLabel = (
  trial: PetriTrial,
  entrantSnapshotId: string,
  blind: boolean,
): string => {
  if (blind) return petriBlindLabel(trial, entrantSnapshotId);
  return requireEntrant(trial, entrantSnapshotId).specimenName;
};

export const applyPetriSelection = (
  input: PetriTrial,
  selectedEntrantSnapshotIds: string[],
  options: ApplyPetriSelectionOptions,
): PetriTrial => {
  const trial = structuredClone(input);
  const validIds = new Set(trial.entrantOrder);

  for (const id of selectedEntrantSnapshotIds) {
    if (!validIds.has(id)) throw new Error('PETRI_SELECTION_UNKNOWN_ENTRANT');
  }

  const requested = new Set(selectedEntrantSnapshotIds);
  const ordered = trial.entrantOrder.filter(id => requested.has(id));
  const now = options.now ?? Date.now();
  const existing = trial.selection;

  trial.selection = {
    selectedEntrantSnapshotIds: ordered,
    ...(options.note?.trim() ? { note: options.note.trim() } : {}),
    identityMode: options.identityMode,
    selectedAt: existing?.selectedAt ?? now,
    ...(existing ? { revisedAt: now } : {}),
  };
  trial.lastModified = now;

  return trial;
};
