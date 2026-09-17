import localforage from 'localforage';
import { Genome, Specimen, SpecimenPhase } from '../types';

export const MR_SLOP_STORAGE_KEY = 'mrslop_specimens_v1';

const cloneGenomeSnapshot = (genome: Genome): Genome => ({
  ...genome,
  components: genome.components.map(component => ({
    ...component,
    tags: [...component.tags],
    roleHints: [...component.roleHints],
  })),
});

const cloneSpecimenForStorage = (specimen: Specimen): Specimen => ({
  ...specimen,
  birthGenome: cloneGenomeSnapshot(specimen.birthGenome),
  currentGenome: cloneGenomeSnapshot(specimen.currentGenome),
  messages: specimen.messages.map(message => ({
    ...message,
    attachments: message.attachments?.map(attachment => ({ ...attachment, fileHandle: undefined })),
  })),
  artifacts: specimen.artifacts.map(artifact => ({ ...artifact, componentIds: [...artifact.componentIds] })),
  checkpoints: specimen.checkpoints.map(checkpoint => ({
    ...checkpoint,
    genome: cloneGenomeSnapshot(checkpoint.genome),
  })),
  acquiredTraits: specimen.acquiredTraits.map(trait => ({ ...trait })),
  scars: [...specimen.scars],
});

const isValidSpecimen = (value: unknown): value is Specimen => {
  if (!value || typeof value !== 'object') return false;
  const specimen = value as Partial<Specimen>;
  return specimen.schemaVersion === 1 &&
    typeof specimen.id === 'string' &&
    typeof specimen.name === 'string' &&
    (specimen.phase === 'building' || specimen.phase === 'spawned') &&
    Boolean(specimen.birthGenome && specimen.currentGenome) &&
    Array.isArray(specimen.messages) &&
    Array.isArray(specimen.artifacts) &&
    Array.isArray(specimen.checkpoints) &&
    Array.isArray(specimen.acquiredTraits) &&
    Array.isArray(specimen.scars);
};

export const loadSpecimens = async (): Promise<Specimen[]> => {
  try {
    const stored = await localforage.getItem<unknown>(MR_SLOP_STORAGE_KEY);
    if (!Array.isArray(stored) || !stored.every(isValidSpecimen)) return [];
    return stored.map(cloneSpecimenForStorage);
  } catch (error) {
    console.warn('[MR_SLOP_STORE] Unable to load specimens.', error);
    return [];
  }
};

export const saveSpecimens = async (specimens: Specimen[]): Promise<void> => {
  const snapshot = specimens.map(cloneSpecimenForStorage);
  await localforage.setItem(MR_SLOP_STORAGE_KEY, snapshot);
};

export const makeSpecimen = (
  genome: Genome,
  name = 'NEW SPECIMEN',
  phase?: SpecimenPhase,
): Specimen => {
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: crypto.randomUUID(),
    name: name.trim() || 'NEW SPECIMEN',
    phase: phase ?? (genome.components.length === 0 ? 'building' : 'spawned'),
    birthGenome: cloneGenomeSnapshot(genome),
    currentGenome: cloneGenomeSnapshot(genome),
    messages: [],
    artifacts: [],
    checkpoints: [],
    acquiredTraits: [],
    scars: [],
    trajectory: null,
    controllerState: null,
    metrics: null,
    lineage: null,
    createdAt: now,
    lastModified: now,
  };
};

export const checkpointSpecimen = (specimen: Specimen, reason: string): Specimen => ({
  ...specimen,
  checkpoints: [
    ...specimen.checkpoints,
    {
      id: crypto.randomUUID(),
      reason: reason.trim() || 'structural change',
      genome: cloneGenomeSnapshot(specimen.currentGenome),
      createdAt: Date.now(),
    },
  ],
  lastModified: Date.now(),
});

export const replaceCurrentGenome = (
  specimen: Specimen,
  genome: Genome,
  phase: SpecimenPhase = 'spawned',
): Specimen => ({
  ...specimen,
  phase,
  currentGenome: cloneGenomeSnapshot(genome),
  lastModified: Date.now(),
});
