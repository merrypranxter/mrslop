import localforage from 'localforage';
import {
  AcquiredTrait,
  Artifact,
  Checkpoint,
  DriftBaseline,
  Genome,
  Infection,
  InheritanceRef,
  LifeHistoryEvent,
  LineageRecord,
  MutationProvenance,
  Scar,
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

interface LegacyV2Specimen {
  schemaVersion: 2;
  id: string;
  name: string;
  phase: SpecimenPhase;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Specimen['messages'];
  artifacts: Artifact[];
  checkpoints: Checkpoint[];
  acquiredTraits: AcquiredTrait[];
  infections: Infection[];
  lifeHistory: LifeHistoryEvent[];
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

const cloneInheritanceRef = (ref: InheritanceRef | undefined): InheritanceRef | undefined =>
  ref ? { ...ref } : undefined;

const cloneProvenance = (provenance: MutationProvenance): MutationProvenance => ({
  ...provenance,
  sourceMessageIds: [...provenance.sourceMessageIds],
  sourceArtifactIds: [...provenance.sourceArtifactIds],
});

const cloneTraits = (traits: AcquiredTrait[]): AcquiredTrait[] => traits.map(trait => ({
  ...trait,
  provenance: cloneProvenance(trait.provenance),
  ...(trait.inheritedFrom ? { inheritedFrom: cloneInheritanceRef(trait.inheritedFrom) } : {}),
}));

const cloneInfections = (infections: Infection[]): Infection[] => infections.map(infection => ({
  ...infection,
  provenance: cloneProvenance(infection.provenance),
  ...(infection.inheritedFrom ? { inheritedFrom: cloneInheritanceRef(infection.inheritedFrom) } : {}),
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

const cloneScar = (scar: Scar): Scar => ({
  ...scar,
  relatedEventIds: [...scar.relatedEventIds],
  relatedMutationIds: [...scar.relatedMutationIds],
  relatedCheckpointIds: [...scar.relatedCheckpointIds],
  messageIds: [...scar.messageIds],
  artifactIds: [...scar.artifactIds],
});

const cloneBaseline = (baseline: DriftBaseline): DriftBaseline => ({
  ...baseline,
  genome: cloneGenomeSnapshot(baseline.genome),
  activeTraitIds: [...baseline.activeTraitIds],
  activeInfectionIds: [...baseline.activeInfectionIds],
  inheritedScarIds: [...baseline.inheritedScarIds],
});

const cloneLineage = (lineage: LineageRecord): LineageRecord => ({ ...lineage });

const cloneMessages = (messages: Specimen['messages']): Specimen['messages'] =>
  messages.map(message => ({
    ...message,
    attachments: message.attachments?.map(attachment => ({ ...attachment, fileHandle: undefined })),
  }));

const cloneArtifacts = (artifacts: Artifact[]): Artifact[] =>
  artifacts.map(artifact => ({ ...artifact, componentIds: [...artifact.componentIds] }));

const cloneSpecimenForStorage = (specimen: Specimen): Specimen => ({
  ...specimen,
  birthGenome: cloneGenomeSnapshot(specimen.birthGenome),
  currentGenome: cloneGenomeSnapshot(specimen.currentGenome),
  messages: cloneMessages(specimen.messages),
  artifacts: cloneArtifacts(specimen.artifacts),
  checkpoints: specimen.checkpoints.map(cloneCheckpoint),
  acquiredTraits: cloneTraits(specimen.acquiredTraits),
  infections: cloneInfections(specimen.infections),
  lifeHistory: cloneLifeHistory(specimen.lifeHistory),
  scars: specimen.scars.map(cloneScar),
  birthBaseline: cloneBaseline(specimen.birthBaseline),
  lineage: cloneLineage(specimen.lineage),
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

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

const isInheritanceRef = (value: unknown): value is InheritanceRef => {
  if (!isRecord(value)) return false;
  return typeof value.specimenId === 'string' &&
    typeof value.recordId === 'string' &&
    typeof value.inheritedAt === 'number';
};

const isMutationProvenance = (value: unknown): value is MutationProvenance => {
  if (!isRecord(value)) return false;
  return typeof value.specimenId === 'string' &&
    typeof value.genomeId === 'string' &&
    ['user', 'mr-slop', 'artifact', 'conversation', 'mutation-proposal'].includes(String(value.sourceType)) &&
    isStringArray(value.sourceMessageIds) &&
    isStringArray(value.sourceArtifactIds);
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
    (value.inheritedFrom === undefined || isInheritanceRef(value.inheritedFrom)) &&
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
    (value.inheritedFrom === undefined || isInheritanceRef(value.inheritedFrom)) &&
    typeof value.createdAt === 'number';
};

const isLifeHistoryEvent = (value: unknown): value is LifeHistoryEvent => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    typeof value.summary === 'string' &&
    isStringArray(value.messageIds) &&
    isStringArray(value.artifactIds) &&
    typeof value.createdAt === 'number';
};

const isCheckpoint = (value: unknown): value is Checkpoint => {
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

const isScar = (value: unknown): value is Scar => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    ['infection-survived', 'infection-promoted', 'fossilized-accident', 'checkpoint-reversion', 'genome-change', 'fork-birth']
      .includes(String(value.kind)) &&
    (value.origin === 'experienced' || value.origin === 'inherited') &&
    typeof value.createdAt === 'number' &&
    (value.sourceSpecimenId === undefined || typeof value.sourceSpecimenId === 'string') &&
    (value.sourceScarId === undefined || typeof value.sourceScarId === 'string') &&
    (value.inheritedAt === undefined || typeof value.inheritedAt === 'number') &&
    isStringArray(value.relatedEventIds) &&
    isStringArray(value.relatedMutationIds) &&
    isStringArray(value.relatedCheckpointIds) &&
    isStringArray(value.messageIds) &&
    isStringArray(value.artifactIds);
};

const isLineageRecord = (value: unknown): value is LineageRecord => {
  if (!isRecord(value)) return false;
  return typeof value.rootSpecimenId === 'string' &&
    (value.parentSpecimenId === null || typeof value.parentSpecimenId === 'string') &&
    Number.isInteger(value.generation) &&
    Number(value.generation) >= 0 &&
    ['native-v3', 'fork-v3', 'migrated-v2'].includes(String(value.source)) &&
    (value.forkedAt === undefined || typeof value.forkedAt === 'number') &&
    (value.forkSourceEventId === undefined || typeof value.forkSourceEventId === 'string') &&
    (value.forkSourceCheckpointId === undefined || typeof value.forkSourceCheckpointId === 'string') &&
    (value.forkSourceGenomeId === undefined || typeof value.forkSourceGenomeId === 'string');
};

const isDriftBaseline = (value: unknown): value is DriftBaseline => {
  if (!isRecord(value)) return false;
  return typeof value.capturedAt === 'number' &&
    ['native-v3', 'fork-v3', 'migrated-v2'].includes(String(value.source)) &&
    isGenomeLike(value.genome) &&
    isStringArray(value.activeTraitIds) &&
    isStringArray(value.activeInfectionIds) &&
    isStringArray(value.inheritedScarIds);
};

const isValidV3Specimen = (value: unknown): value is Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 3 || !hasBaseSpecimenShape(value)) return false;
  return Array.isArray(value.infections) &&
    value.infections.every(isInfection) &&
    Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isAcquiredTrait) &&
    Array.isArray(value.lifeHistory) &&
    value.lifeHistory.every(isLifeHistoryEvent) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isCheckpoint) &&
    Array.isArray(value.scars) &&
    value.scars.every(isScar) &&
    isDriftBaseline(value.birthBaseline) &&
    isLineageRecord(value.lineage);
};

const isValidV2Specimen = (value: unknown): value is LegacyV2Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 2 || !hasBaseSpecimenShape(value)) return false;
  return Array.isArray(value.infections) &&
    value.infections.every(isInfection) &&
    Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isAcquiredTrait) &&
    Array.isArray(value.lifeHistory) &&
    value.lifeHistory.every(isLifeHistoryEvent) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isCheckpoint);
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
  return Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isLegacyTrait) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isLegacyCheckpoint);
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

export const captureBirthBaseline = (
  specimen: Pick<Specimen, 'acquiredTraits' | 'infections' | 'scars'>,
  genome: Genome,
  source: DriftBaseline['source'],
  capturedAt = Date.now(),
): DriftBaseline => ({
  capturedAt,
  source,
  genome: cloneGenomeSnapshot(genome),
  activeTraitIds: specimen.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(trait => trait.id),
  activeInfectionIds: specimen.infections
    .filter(infection => infection.status === 'active')
    .map(infection => infection.id),
  inheritedScarIds: specimen.scars
    .filter(scar => scar.origin === 'inherited')
    .map(scar => scar.id),
});

const migratedRootLineage = (specimenId: string): LineageRecord => ({
  rootSpecimenId: specimenId,
  parentSpecimenId: null,
  generation: 0,
  source: 'migrated-v2',
});

const migrateV2ToV3 = (value: LegacyV2Specimen): Specimen => {
  const traits = cloneTraits(value.acquiredTraits);
  const infections = cloneInfections(value.infections);
  const now = Date.now();

  const specimenShell = {
    acquiredTraits: traits,
    infections,
    scars: [] as Scar[],
  };

  return cloneSpecimenForStorage({
    schemaVersion: 3,
    id: value.id,
    name: value.name,
    phase: value.phase,
    birthGenome: cloneGenomeSnapshot(value.birthGenome),
    currentGenome: cloneGenomeSnapshot(value.currentGenome),
    messages: cloneMessages(value.messages),
    artifacts: cloneArtifacts(value.artifacts),
    checkpoints: value.checkpoints.map(cloneCheckpoint),
    acquiredTraits: traits,
    infections,
    lifeHistory: cloneLifeHistory(value.lifeHistory),
    scars: [],
    birthBaseline: captureBirthBaseline(specimenShell, value.birthGenome, 'migrated-v2', now),
    lineage: migratedRootLineage(value.id),
    trajectory: value.trajectory,
    controllerState: value.controllerState,
    metrics: value.metrics,
    createdAt: value.createdAt,
    lastModified: value.lastModified,
  });
};

const migrateV1ToV3 = (value: LegacyV1Specimen): Specimen => {
  const traits = value.acquiredTraits.map(trait =>
    migrateLegacyTrait(trait, value.id, value.currentGenome.id));
  const now = Date.now();
  const specimenShell = {
    acquiredTraits: traits,
    infections: [] as Infection[],
    scars: [] as Scar[],
  };

  return cloneSpecimenForStorage({
    schemaVersion: 3,
    id: value.id,
    name: value.name,
    phase: value.phase,
    birthGenome: cloneGenomeSnapshot(value.birthGenome),
    currentGenome: cloneGenomeSnapshot(value.currentGenome),
    messages: cloneMessages(value.messages),
    artifacts: cloneArtifacts(value.artifacts),
    checkpoints: value.checkpoints.map(checkpoint => ({
      id: checkpoint.id,
      reason: checkpoint.reason,
      genome: cloneGenomeSnapshot(checkpoint.genome),
      acquiredTraits: [],
      infections: [],
      createdAt: checkpoint.createdAt,
    })),
    acquiredTraits: traits,
    infections: [],
    lifeHistory: [],
    scars: [],
    birthBaseline: captureBirthBaseline(specimenShell, value.birthGenome, 'migrated-v2', now),
    lineage: migratedRootLineage(value.id),
    trajectory: value.trajectory,
    controllerState: value.controllerState,
    metrics: value.metrics,
    createdAt: value.createdAt,
    lastModified: value.lastModified,
  });
};

export const migrateSpecimen = (value: unknown): Specimen | null => {
  if (isValidV3Specimen(value)) return cloneSpecimenForStorage(value);
  if (isValidV2Specimen(value)) return migrateV2ToV3(value);
  if (isValidLegacyV1Specimen(value)) return migrateV1ToV3(value);
  return null;
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
  const birthGenome = cloneGenomeSnapshot(genome);
  const currentGenome = cloneGenomeSnapshot(genome);
  const lineage: LineageRecord = {
    rootSpecimenId: id,
    parentSpecimenId: null,
    generation: 0,
    source: 'native-v3',
  };
  const specimenShell = {
    acquiredTraits: [] as AcquiredTrait[],
    infections: [] as Infection[],
    scars: [] as Scar[],
  };

  return {
    schemaVersion: 3,
    id,
    name: specimenName,
    phase: phase ?? (genome.components.length === 0 ? 'building' : 'spawned'),
    birthGenome,
    currentGenome,
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
    birthBaseline: captureBirthBaseline(specimenShell, birthGenome, 'native-v3', now),
    lineage,
    trajectory: null,
    controllerState: null,
    metrics: null,
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
