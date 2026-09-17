import localforage from 'localforage';
import {
  AcquiredTrait,
  Artifact,
  Checkpoint,
  Genome,
  Infection,
  LifeHistoryEvent,
  MutationProvenance,
  Specimen,
  SpecimenPhase,
} from '../types';

export const MR_SLOP_STORAGE_KEY = 'mrslop_specimens_v1';

interface LegacyAcquiredTrait {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  createdAt: number;
}

interface LegacyCheckpoint {
  id: string;
  reason: string;
  genome: Genome;
  createdAt: number;
}

interface LegacyV1Specimen {
  schemaVersion: 1;
  id: string;
  name: string;
  phase: SpecimenPhase;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Specimen['messages'];
  artifacts: Artifact[];
  checkpoints: LegacyCheckpoint[];
  acquiredTraits: LegacyAcquiredTrait[];
  scars: unknown[];
  trajectory: unknown | null;
  controllerState: unknown | null;
  metrics: unknown | null;
  lineage: unknown | null;
  createdAt: number;
  lastModified: number;
}

const cloneGenomeSnapshot = (genome: Genome): Genome => ({
  ...genome,
  components: genome.components.map(component => ({
    ...component,
    tags: [...component.tags],
    roleHints: [...component.roleHints],
  })),
});

const cloneProvenance = (provenance: MutationProvenance): MutationProvenance => ({
  ...provenance,
  sourceMessageIds: [...provenance.sourceMessageIds],
  sourceArtifactIds: [...provenance.sourceArtifactIds],
});

const cloneTraits = (traits: AcquiredTrait[]): AcquiredTrait[] => traits.map(trait => ({
  ...trait,
  provenance: cloneProvenance(trait.provenance),
}));

const cloneInfections = (infections: Infection[]): Infection[] => infections.map(infection => ({
  ...infection,
  provenance: cloneProvenance(infection.provenance),
}));

const cloneLifeHistory = (history: LifeHistoryEvent[]): LifeHistoryEvent[] => history.map(event => ({
  ...event,
  messageIds: [...event.messageIds],
  artifactIds: [...event.artifactIds],
}));

const cloneCheckpoint = (checkpoint: Checkpoint): Checkpoint => ({
  ...checkpoint,
  genome: cloneGenomeSnapshot(checkpoint.genome),
  acquiredTraits: cloneTraits(checkpoint.acquiredTraits),
  infections: cloneInfections(checkpoint.infections),
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
  checkpoints: specimen.checkpoints.map(cloneCheckpoint),
  acquiredTraits: cloneTraits(specimen.acquiredTraits),
  infections: cloneInfections(specimen.infections),
  lifeHistory: cloneLifeHistory(specimen.lifeHistory),
  scars: [...specimen.scars],
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const isGenomeLike = (value: unknown): value is Genome => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    (value.mode === 'stack' || value.mode === 'fuse') &&
    Array.isArray(value.components);
};

const hasBaseSpecimenShape = (value: Record<string, unknown>): boolean =>
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  (value.phase === 'building' || value.phase === 'spawned') &&
  isGenomeLike(value.birthGenome) &&
  isGenomeLike(value.currentGenome) &&
  Array.isArray(value.messages) &&
  Array.isArray(value.artifacts) &&
  Array.isArray(value.checkpoints) &&
  Array.isArray(value.acquiredTraits) &&
  Array.isArray(value.scars) &&
  typeof value.createdAt === 'number' &&
  typeof value.lastModified === 'number';

const isMutationProvenance = (value: unknown): value is MutationProvenance => {
  if (!isRecord(value)) return false;
  return typeof value.specimenId === 'string' &&
    typeof value.genomeId === 'string' &&
    ['user', 'mr-slop', 'artifact', 'conversation', 'mutation-proposal'].includes(String(value.sourceType)) &&
    Array.isArray(value.sourceMessageIds) &&
    value.sourceMessageIds.every(item => typeof item === 'string') &&
    Array.isArray(value.sourceArtifactIds) &&
    value.sourceArtifactIds.every(item => typeof item === 'string');
};

const isAcquiredTrait = (value: unknown): value is AcquiredTrait => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.prompt === 'string' &&
    (value.status === 'active' || value.status === 'retired') &&
    ['explicit', 'promoted-infection', 'fossilized-accident', 'mr-slop-proposal'].includes(String(value.originType)) &&
    isMutationProvenance(value.provenance) &&
    typeof value.createdAt === 'number';
};

const isInfection = (value: unknown): value is Infection => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.prompt === 'string' &&
    ['active', 'expired', 'removed', 'promoted'].includes(String(value.status)) &&
    (value.durationMode === 'turns' || value.durationMode === 'indefinite') &&
    isMutationProvenance(value.provenance) &&
    typeof value.createdAt === 'number';
};

const isLifeHistoryEvent = (value: unknown): value is LifeHistoryEvent => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.summary === 'string' &&
    Array.isArray(value.messageIds) &&
    value.messageIds.every(item => typeof item === 'string') &&
    Array.isArray(value.artifactIds) &&
    value.artifactIds.every(item => typeof item === 'string') &&
    typeof value.createdAt === 'number';
};

const isCheckpointV2 = (value: unknown): value is Checkpoint => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.reason === 'string' &&
    isGenomeLike(value.genome) &&
    Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isAcquiredTrait) &&
    Array.isArray(value.infections) &&
    value.infections.every(isInfection) &&
    typeof value.createdAt === 'number';
};

const isValidV2Specimen = (value: unknown): value is Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 2 || !hasBaseSpecimenShape(value)) return false;
  if (!Array.isArray(value.infections) ||
      !Array.isArray(value.acquiredTraits) ||
      !Array.isArray(value.lifeHistory) ||
      !Array.isArray(value.checkpoints)) return false;
  return value.infections.every(isInfection) &&
    value.acquiredTraits.every(isAcquiredTrait) &&
    value.lifeHistory.every(isLifeHistoryEvent) &&
    value.checkpoints.every(isCheckpointV2);
};

const isLegacyTrait = (value: unknown): value is LegacyAcquiredTrait => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    (value.prompt === undefined || typeof value.prompt === 'string') &&
    typeof value.createdAt === 'number';
};

const isLegacyCheckpoint = (value: unknown): value is LegacyCheckpoint => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.reason === 'string' &&
    isGenomeLike(value.genome) &&
    typeof value.createdAt === 'number';
};

const isValidLegacyV1Specimen = (value: unknown): value is LegacyV1Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 1 || !hasBaseSpecimenShape(value)) return false;
  if (!Array.isArray(value.acquiredTraits) || !Array.isArray(value.checkpoints)) return false;
  return value.acquiredTraits.every(isLegacyTrait) && value.checkpoints.every(isLegacyCheckpoint);
};

const migrateLegacyTrait = (
  trait: LegacyAcquiredTrait,
  specimenId: string,
  genomeId: string,
): AcquiredTrait => ({
  id: trait.id,
  name: trait.name,
  description: trait.description,
  prompt: trait.prompt?.trim() || trait.description || trait.name,
  status: 'active',
  originType: 'explicit',
  provenance: {
    specimenId,
    genomeId,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: trait.createdAt,
});

export const migrateSpecimen = (value: unknown): Specimen | null => {
  if (isValidV2Specimen(value)) return cloneSpecimenForStorage(value);
  if (!isValidLegacyV1Specimen(value)) return null;

  const migrated: Specimen = {
    schemaVersion: 2,
    id: value.id,
    name: value.name,
    phase: value.phase,
    birthGenome: cloneGenomeSnapshot(value.birthGenome),
    currentGenome: cloneGenomeSnapshot(value.currentGenome),
    messages: value.messages.map(message => ({
      ...message,
      attachments: message.attachments?.map(attachment => ({ ...attachment, fileHandle: undefined })),
    })),
    artifacts: value.artifacts.map(artifact => ({ ...artifact, componentIds: [...artifact.componentIds] })),
    checkpoints: value.checkpoints.map(checkpoint => ({
      id: checkpoint.id,
      reason: checkpoint.reason,
      genome: cloneGenomeSnapshot(checkpoint.genome),
      acquiredTraits: [],
      infections: [],
      createdAt: checkpoint.createdAt,
    })),
    acquiredTraits: value.acquiredTraits.map(trait =>
      migrateLegacyTrait(trait, value.id, value.currentGenome.id)),
    infections: [],
    lifeHistory: [],
    scars: [...value.scars],
    trajectory: value.trajectory,
    controllerState: value.controllerState,
    metrics: value.metrics,
    lineage: value.lineage,
    createdAt: value.createdAt,
    lastModified: value.lastModified,
  };

  return cloneSpecimenForStorage(migrated);
};

export const loadSpecimens = async (): Promise<Specimen[]> => {
  try {
    const stored = await localforage.getItem<unknown>(MR_SLOP_STORAGE_KEY);
    if (!Array.isArray(stored)) return [];
    return stored
      .map(migrateSpecimen)
      .filter((specimen): specimen is Specimen => specimen !== null);
  } catch (error) {
    console.warn('[MR_SLOP_STORE] Unable to load specimens.', error);
    return [];
  }
};

export const saveSpecimens = async (specimens: Specimen[]): Promise<void> => {
  const snapshot = specimens.map(cloneSpecimenForStorage);
  await localforage.setItem(MR_SLOP_STORAGE_KEY, snapshot);
};

const makeHistoryEvent = (
  type: LifeHistoryEvent['type'],
  summary: string,
  extras: Pick<LifeHistoryEvent, 'mutationId' | 'checkpointId'> = {},
): LifeHistoryEvent => ({
  id: crypto.randomUUID(),
  type,
  summary,
  ...extras,
  messageIds: [],
  artifactIds: [],
  createdAt: Date.now(),
});

export const makeSpecimen = (
  genome: Genome,
  name = 'NEW SPECIMEN',
  phase?: SpecimenPhase,
): Specimen => {
  const now = Date.now();
  const id = crypto.randomUUID();
  const specimenName = name.trim() || 'NEW SPECIMEN';
  return {
    schemaVersion: 2,
    id,
    name: specimenName,
    phase: phase ?? (genome.components.length === 0 ? 'building' : 'spawned'),
    birthGenome: cloneGenomeSnapshot(genome),
    currentGenome: cloneGenomeSnapshot(genome),
    messages: [],
    artifacts: [],
    checkpoints: [],
    acquiredTraits: [],
    infections: [],
    lifeHistory: [{
      id: crypto.randomUUID(),
      type: 'specimen-born',
      summary: `${specimenName} was created.`,
      messageIds: [],
      artifactIds: [],
      createdAt: now,
    }],
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
      acquiredTraits: cloneTraits(specimen.acquiredTraits),
      infections: cloneInfections(specimen.infections),
      createdAt: Date.now(),
    },
  ],
  lastModified: Date.now(),
});

export const restoreCheckpoint = (specimen: Specimen, checkpointId: string): Specimen => {
  const checkpoint = specimen.checkpoints.find(item => item.id === checkpointId);
  if (!checkpoint) throw new Error('CHECKPOINT_NOT_FOUND');

  return {
    ...specimen,
    currentGenome: cloneGenomeSnapshot(checkpoint.genome),
    acquiredTraits: cloneTraits(checkpoint.acquiredTraits),
    infections: cloneInfections(checkpoint.infections),
    lifeHistory: [
      ...cloneLifeHistory(specimen.lifeHistory),
      makeHistoryEvent(
        'checkpoint-restored',
        `Restored checkpoint: ${checkpoint.reason}`,
        { checkpointId: checkpoint.id },
      ),
    ],
    lastModified: Date.now(),
  };
};

export interface SaveArtifactInput {
  messageId?: string;
  kind: Artifact['kind'];
  title: string;
  content: string;
}

export const saveArtifact = (specimen: Specimen, input: SaveArtifactInput): Specimen => {
  const artifact: Artifact = {
    id: crypto.randomUUID(),
    specimenId: specimen.id,
    messageId: input.messageId,
    kind: input.kind,
    title: input.title.trim() || 'Saved artifact',
    content: input.content,
    genomeId: specimen.currentGenome.id,
    componentIds: specimen.currentGenome.components
      .filter(component => component.enabled)
      .sort((a, b) => a.order - b.order)
      .map(component => component.id),
    createdAt: Date.now(),
  };

  return {
    ...specimen,
    artifacts: [...specimen.artifacts, artifact],
    lastModified: Date.now(),
  };
};

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
