import type { PetriTrial, Specimen } from '../types';

const selectedSnapshotIds = (trial: PetriTrial): string[] =>
  trial.selection?.selectedEntrantSnapshotIds ?? [];

const specimenIdForSnapshot = (
  trial: PetriTrial,
  entrantSnapshotId: string,
): string => {
  const entrant = trial.entrants.find(item => item.id === entrantSnapshotId);
  if (!entrant) throw new Error('PETRI_SELECTED_SNAPSHOT_NOT_FOUND');
  return entrant.specimenId;
};

export const resolvePetriSelectedLiveSpecimens = (
  trial: PetriTrial,
  liveSpecimens: Specimen[],
): Specimen[] => selectedSnapshotIds(trial).map(snapshotId => {
  const specimenId = specimenIdForSnapshot(trial, snapshotId);
  const live = liveSpecimens.find(item => item.id === specimenId);
  if (!live) throw new Error('PETRI_SELECTED_LIVE_SPECIMEN_NOT_FOUND');
  if (live.phase !== 'spawned') throw new Error('PETRI_SELECTED_LIVE_SPECIMEN_NOT_SPAWNED');
  return live;
});

export const resolvePetriLiveSpecimen = (
  trial: PetriTrial,
  entrantSnapshotId: string,
  liveSpecimens: Specimen[],
): Specimen => {
  const specimenId = specimenIdForSnapshot(trial, entrantSnapshotId);
  const live = liveSpecimens.find(item => item.id === specimenId);
  if (!live) throw new Error('PETRI_SELECTED_LIVE_SPECIMEN_NOT_FOUND');
  if (live.phase !== 'spawned') throw new Error('PETRI_SELECTED_LIVE_SPECIMEN_NOT_SPAWNED');
  return live;
};

export const resolvePetriBreedingPair = (
  trial: PetriTrial,
  liveSpecimens: Specimen[],
): [Specimen, Specimen] => {
  const selected = resolvePetriSelectedLiveSpecimens(trial, liveSpecimens);
  if (selected.length !== 2) throw new Error('PETRI_BREED_REQUIRES_TWO');
  return [selected[0], selected[1]];
};
