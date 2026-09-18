import localforage from 'localforage';
import { addCheckpointReversionScar } from '../lib/scars';
import {
  AcquiredTrait,
  Artifact,
  Checkpoint,
  DriftBaseline,
  GeneticsReceipt,
  Genome,
  Infection,
  InheritanceRef,
  LifeHistoryEvent,
  LineageRecord,
  MutationProvenance,
  Scar,
  Specimen,
  SpecimenPhase,
  TraitOriginType,
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

interface LegacyStructuredTrait extends Omit<
  AcquiredTrait,
  'inheritanceSources' | 'inheritedSourceOriginTypes' | 'supportingScarIdsAtBirth' | 'birthVariation'
> {
  inheritedFrom?: InheritanceRef;
  originType: Exclude<TraitOriginType, 'inherited'>;
}

interface LegacyStructuredInfection extends Omit<Infection, 'inheritanceSources'> {
  inheritedFrom?: InheritanceRef;
}

interface LegacyStructuredCheckpoint {
  id: string;
  reason: string;
  genome: Genome;
  acquiredTraits: LegacyStructuredTrait[];
  infections: LegacyStructuredInfection[];
  createdAt: number;
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
  checkpoints: LegacyStructuredCheckpoint[];
  acquiredTraits: LegacyStructuredTrait[];
  infections: LegacyStructuredInfection[];
  lifeHistory: LifeHistoryEvent[];
  scars: unknown[];
  trajectory: unknown | null;
  controllerState: unknown | null;
  metrics: unknown | null;
  lineage: unknown | null;
  createdAt: number;
  lastModified: number;
}

interface LegacyV3LineageRecord {
  rootSpecimenId: string;
  parentSpecimenId: string | null;
  generation: number;
  forkedAt?: number;
  forkSourceEventId?: string;
  forkSourceCheckpointId?: string;
  forkSourceGenomeId?: string;
  source: 'native-v3' | 'fork-v3' | 'migrated-v2';
}

interface LegacyV3Specimen {
  schemaVersion: 3;
  id: string;
  name: string;
  phase: SpecimenPhase;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Specimen['messages'];
  artifacts: Artifact[];
  checkpoints: LegacyStructuredCheckpoint[];
  acquiredTraits: LegacyStructuredTrait[];
  infections: LegacyStructuredInfection[];
  lifeHistory: LifeHistoryEvent[];
  scars: Scar[];
  birthBaseline: DriftBaseline;
  lineage: LegacyV3LineageRecord;
  trajectory: unknown | null;
  controllerState: unknown | null;
  metrics: unknown | null;
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

const cloneInheritanceRef = (ref: InheritanceRef): InheritanceRef => ({ ...ref });

const cloneInheritanceSources = (refs: InheritanceRef[] | undefined): InheritanceRef[] | undefined =>
  refs?.map(cloneInheritanceRef);

const cloneProvenance = (provenance: MutationProvenance): MutationProvenance => ({
  ...provenance,
  sourceMessageIds: [...provenance.sourceMessageIds],
  sourceArtifactIds: [...provenance.sourceArtifactIds],
});

const cloneTraits = (traits: AcquiredTrait[]): AcquiredTrait[] => traits.map(trait => ({
  ...trait,
  provenance: cloneProvenance(trait.provenance),
  ...(trait.inheritanceSources
    ? { inheritanceSources: cloneInheritanceSources(trait.inheritanceSources) }
    : {}),
  ...(trait.inheritedSourceOriginTypes
    ? { inheritedSourceOriginTypes: [...trait.inheritedSourceOriginTypes] }
    : {}),
  ...(trait.supportingScarIdsAtBirth
    ? { supportingScarIdsAtBirth: [...trait.supportingScarIdsAtBirth] }
    : {}),
  ...(trait.birthVariation
    ? {
        birthVariation: {
          ...trait.birthVariation,
          before: { ...trait.birthVariation.before },
          after: { ...trait.birthVariation.after },
        },
      }
    : {}),
}));

const cloneInfections = (infections: Infection[]): Infection[] => infections.map(infection => ({
  ...infection,
  provenance: cloneProvenance(infection.provenance),
  ...(infection.inheritanceSources
    ? { inheritanceSources: cloneInheritanceSources(infection.inheritanceSources) }
    : {}),
}));

const cloneLifeHistory = (history: LifeHistoryEvent[]): LifeHistoryEvent[] => history.map(event => ({
  ...event,
  ...(event.relatedSpecimenIds ? { relatedSpecimenIds: [...event.relatedSpecimenIds] } : {}),
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

const cloneLineage = (lineage: LineageRecord): LineageRecord => ({
  ...lineage,
  parentSpecimenIds: [...lineage.parentSpecimenIds],
  rootSpecimenIds: [...lineage.rootSpecimenIds],
});

const cloneGeneticsReceipt = (receipt: GeneticsReceipt | undefined): GeneticsReceipt | undefined => {
  if (!receipt) return undefined;
  return {
    ...receipt,
    canonicalParentIds: [...receipt.canonicalParentIds] as [string, string],
    parentStateHashes: [...receipt.parentStateHashes] as [string, string],
    genome: {
      ...receipt.genome,
      parentEnabledCounts: [...receipt.genome.parentEnabledCounts] as [number, number],
      roleCounts: Object.fromEntries(
        Object.entries(receipt.genome.roleCounts).map(([role, counts]) => [
          role,
          [...counts] as [number, number],
        ]),
      ) as GeneticsReceipt['genome']['roleCounts'],
      roleQuotas: { ...receipt.genome.roleQuotas },
      redistributedSlots: receipt.genome.redistributedSlots.map(item => ({ ...item })),
      candidates: receipt.genome.candidates.map(item => ({
        ...item,
        sourceParentIds: [...item.sourceParentIds],
      })),
      initialUniqueContribution: [...receipt.genome.initialUniqueContribution] as [number, number],
      finalUniqueContribution: [...receipt.genome.finalUniqueContribution] as [number, number],
    },
    traits: {
      ...receipt.traits,
      candidates: receipt.traits.candidates.map(item => ({
        ...item,
        sourceParentIds: [...item.sourceParentIds],
        sourceTraitIds: [...item.sourceTraitIds],
        sourceOriginTypes: [...item.sourceOriginTypes],
        supportingScarIds: [...item.supportingScarIds],
      })),
      inheritedFingerprints: [...receipt.traits.inheritedFingerprints],
    },
    mutation: {
      ...receipt.mutation,
      attemptedBranches: [...receipt.mutation.attemptedBranches],
    },
    finalBirthState: {
      ...receipt.finalBirthState,
      componentFingerprints: [...receipt.finalBirthState.componentFingerprints],
      componentIds: [...receipt.finalBirthState.componentIds],
      traitFingerprints: [...receipt.finalBirthState.traitFingerprints],
    },
  };
};

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
  ...(specimen.geneticsReceipt
    ? { geneticsReceipt: cloneGeneticsReceipt(specimen.geneticsReceipt) }
    : {}),
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

const isTraitOrigin = (value: unknown): value is TraitOriginType =>
  ['explicit', 'promoted-infection', 'fossilized-accident', 'mr-slop-proposal', 'inherited']
    .includes(String(value));

const isAcquiredTrait = (value: unknown): value is AcquiredTrait => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.prompt === 'string' &&
    (value.status === 'active' || value.status === 'retired') &&
    isTraitOrigin(value.originType) &&
    isMutationProvenance(value.provenance) &&
    (value.inheritanceSources === undefined ||
      (Array.isArray(value.inheritanceSources) && value.inheritanceSources.every(isInheritanceRef))) &&
    typeof value.createdAt === 'number';
};

const isLegacyStructuredTrait = (value: unknown): value is LegacyStructuredTrait => {
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
    (value.inheritanceSources === undefined ||
      (Array.isArray(value.inheritanceSources) && value.inheritanceSources.every(isInheritanceRef))) &&
    typeof value.createdAt === 'number';
};

const isLegacyStructuredInfection = (value: unknown): value is LegacyStructuredInfection => {
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
    (value.relatedSpecimenIds === undefined || isStringArray(value.relatedSpecimenIds)) &&
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

const isLegacyStructuredCheckpoint = (value: unknown): value is LegacyStructuredCheckpoint => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.reason === 'string' &&
    isGenomeLike(value.genome) &&
    Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isLegacyStructuredTrait) &&
    Array.isArray(value.infections) &&
    value.infections.every(isLegacyStructuredInfection) &&
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
  const kind = String(value.kind);
  const parents = value.parentSpecimenIds;
  const roots = value.rootSpecimenIds;
  const parentCountValid =
    (kind === 'root' && Array.isArray(parents) && parents.length === 0) ||
    (kind === 'fork' && Array.isArray(parents) && parents.length === 1) ||
    (kind === 'bred' && Array.isArray(parents) && parents.length === 2);

  return ['root', 'fork', 'bred'].includes(kind) &&
    parentCountValid &&
    isStringArray(parents) &&
    isStringArray(roots) &&
    roots.length >= 1 &&
    Number.isInteger(value.generation) &&
    Number(value.generation) >= 0 &&
    ['native-v4', 'fork-v4', 'bred-v4', 'migrated-v3', 'migrated-v2'].includes(String(value.source)) &&
    (value.forkedAt === undefined || typeof value.forkedAt === 'number') &&
    (value.forkSourceEventId === undefined || typeof value.forkSourceEventId === 'string') &&
    (value.forkSourceCheckpointId === undefined || typeof value.forkSourceCheckpointId === 'string') &&
    (value.forkSourceGenomeId === undefined || typeof value.forkSourceGenomeId === 'string') &&
    (value.bredAt === undefined || typeof value.bredAt === 'number') &&
    (value.geneticsReceiptId === undefined || typeof value.geneticsReceiptId === 'string');
};

const isLegacyV3LineageRecord = (value: unknown): value is LegacyV3LineageRecord => {
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
    ['native-v3', 'fork-v3', 'migrated-v2', 'native-v4', 'fork-v4', 'bred-v4'].includes(String(value.source)) &&
    isGenomeLike(value.genome) &&
    isStringArray(value.activeTraitIds) &&
    isStringArray(value.activeInfectionIds) &&
    isStringArray(value.inheritedScarIds);
};

const isGeneticsReceipt = (value: unknown): value is GeneticsReceipt => {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string' &&
    typeof value.algorithmVersion === 'string' &&
    typeof value.breedingSeed === 'string' &&
    typeof value.idempotencyKey === 'string' &&
    typeof value.previewCreatedAt === 'number' &&
    typeof value.parentAId === 'string' &&
    typeof value.parentBId === 'string' &&
    isStringArray(value.canonicalParentIds) &&
    value.canonicalParentIds.length === 2 &&
    isStringArray(value.parentStateHashes) &&
    value.parentStateHashes.length === 2 &&
    isRecord(value.genome) &&
    isRecord(value.traits) &&
    isRecord(value.mutation) &&
    isRecord(value.finalBirthState);
};

const isValidV4Specimen = (value: unknown): value is Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 4 || !hasBaseSpecimenShape(value)) return false;
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
    isLineageRecord(value.lineage) &&
    (value.geneticsReceipt === undefined || isGeneticsReceipt(value.geneticsReceipt));
};

const isValidV3Specimen = (value: unknown): value is LegacyV3Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 3 || !hasBaseSpecimenShape(value)) return false;
  return Array.isArray(value.infections) &&
    value.infections.every(isLegacyStructuredInfection) &&
    Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isLegacyStructuredTrait) &&
    Array.isArray(value.lifeHistory) &&
    value.lifeHistory.every(isLifeHistoryEvent) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isLegacyStructuredCheckpoint) &&
    Array.isArray(value.scars) &&
    value.scars.every(isScar) &&
    isDriftBaseline(value.birthBaseline) &&
    isLegacyV3LineageRecord(value.lineage);
};

const isValidV2Specimen = (value: unknown): value is LegacyV2Specimen => {
  if (!isRecord(value) || value.schemaVersion !== 2 || !hasBaseSpecimenShape(value)) return false;
  return Array.isArray(value.infections) &&
    value.infections.every(isLegacyStructuredInfection) &&
    Array.isArray(value.acquiredTraits) &&
    value.acquiredTraits.every(isLegacyStructuredTrait) &&
    Array.isArray(value.lifeHistory) &&
    value.lifeHistory.every(isLifeHistoryEvent) &&
    Array.isArray(value.checkpoints) &&
    value.checkpoints.every(isLegacyStructuredCheckpoint);
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

const migrateStructuredTrait = (trait: LegacyStructuredTrait): AcquiredTrait => {
  const { inheritedFrom, ...rest } = trait;
  return {
    ...rest,
    provenance: cloneProvenance(trait.provenance),
    ...(inheritedFrom ? { inheritanceSources: [cloneInheritanceRef(inheritedFrom)] } : {}),
  };
};

const migrateStructuredInfection = (infection: LegacyStructuredInfection): Infection => {
  const { inheritedFrom, ...rest } = infection;
  return {
    ...rest,
    provenance: cloneProvenance(infection.provenance),
    ...(inheritedFrom ? { inheritanceSources: [cloneInheritanceRef(inheritedFrom)] } : {}),
  };
};

const migrateStructuredCheckpoint = (checkpoint: LegacyStructuredCheckpoint): Checkpoint => ({
  ...checkpoint,
  genome: cloneGenomeSnapshot(checkpoint.genome),
  acquiredTraits: checkpoint.acquiredTraits.map(migrateStructuredTrait),
  infections: checkpoint.infections.map(migrateStructuredInfection),
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
  kind: 'root',
  parentSpecimenIds: [],
  rootSpecimenIds: [specimenId],
  generation: 0,
  source: 'migrated-v2',
});

const migrateV3Lineage = (lineage: LegacyV3LineageRecord): LineageRecord => ({
  kind: lineage.parentSpecimenId ? 'fork' : 'root',
  parentSpecimenIds: lineage.parentSpecimenId ? [lineage.parentSpecimenId] : [],
  rootSpecimenIds: [lineage.rootSpecimenId],
  generation: lineage.generation,
  ...(lineage.forkedAt !== undefined ? { forkedAt: lineage.forkedAt } : {}),
  ...(lineage.forkSourceEventId ? { forkSourceEventId: lineage.forkSourceEventId } : {}),
  ...(lineage.forkSourceCheckpointId ? { forkSourceCheckpointId: lineage.forkSourceCheckpointId } : {}),
  ...(lineage.forkSourceGenomeId ? { forkSourceGenomeId: lineage.forkSourceGenomeId } : {}),
  source: 'migrated-v3',
});

const migrateV3ToV4 = (value: LegacyV3Specimen): Specimen => {
  const traits = value.acquiredTraits.map(migrateStructuredTrait);
  const infections = value.infections.map(migrateStructuredInfection);
  return cloneSpecimenForStorage({
    schemaVersion: 4,
    id: value.id,
    name: value.name,
    phase: value.phase,
    birthGenome: cloneGenomeSnapshot(value.birthGenome),
    currentGenome: cloneGenomeSnapshot(value.currentGenome),
    messages: cloneMessages(value.messages),
    artifacts: cloneArtifacts(value.artifacts),
    checkpoints: value.checkpoints.map(migrateStructuredCheckpoint),
    acquiredTraits: traits,
    infections,
    lifeHistory: cloneLifeHistory(value.lifeHistory),
    scars: value.scars.map(cloneScar),
    birthBaseline: cloneBaseline(value.birthBaseline),
    lineage: migrateV3Lineage(value.lineage),
    trajectory: value.trajectory,
    controllerState: value.controllerState,
    metrics: value.metrics,
    createdAt: value.createdAt,
    lastModified: value.lastModified,
  });
};

const migrateV2ToV4 = (value: LegacyV2Specimen): Specimen => {
  const traits = value.acquiredTraits.map(migrateStructuredTrait);
  const infections = value.infections.map(migrateStructuredInfection);
  const now = Date.now();

  const specimenShell = {
    acquiredTraits: traits,
    infections,
    scars: [] as Scar[],
  };

  return cloneSpecimenForStorage({
    schemaVersion: 4,
    id: value.id,
    name: value.name,
    phase: value.phase,
    birthGenome: cloneGenomeSnapshot(value.birthGenome),
    currentGenome: cloneGenomeSnapshot(value.currentGenome),
    messages: cloneMessages(value.messages),
    artifacts: cloneArtifacts(value.artifacts),
    checkpoints: value.checkpoints.map(migrateStructuredCheckpoint),
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

const migrateV1ToV4 = (value: LegacyV1Specimen): Specimen => {
  const traits = value.acquiredTraits.map(trait =>
    migrateLegacyTrait(trait, value.id, value.currentGenome.id));
  const now = Date.now();
  const specimenShell = {
    acquiredTraits: traits,
    infections: [] as Infection[],
    scars: [] as Scar[],
  };

  return cloneSpecimenForStorage({
    schemaVersion: 4,
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
  if (isValidV4Specimen(value)) return cloneSpecimenForStorage(value);
  if (isValidV3Specimen(value)) return migrateV3ToV4(value);
  if (isValidV2Specimen(value)) return migrateV2ToV4(value);
  if (isValidLegacyV1Specimen(value)) return migrateV1ToV4(value);
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
    kind: 'root',
    parentSpecimenIds: [],
    rootSpecimenIds: [id],
    generation: 0,
    source: 'native-v4',
  };
  const specimenShell = {
    acquiredTraits: [] as AcquiredTrait[],
    infections: [] as Infection[],
    scars: [] as Scar[],
  };

  return {
    schemaVersion: 4,
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
    birthBaseline: captureBirthBaseline(specimenShell, birthGenome, 'native-v4', now),
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

  const restoredEvent = makeHistoryEvent(
    'checkpoint-restored',
    `Restored checkpoint: ${checkpoint.reason}`,
    { checkpointId: checkpoint.id },
  );

  const restored: Specimen = {
    ...specimen,
    currentGenome: cloneGenomeSnapshot(checkpoint.genome),
    acquiredTraits: cloneTraits(checkpoint.acquiredTraits),
    infections: cloneInfections(checkpoint.infections),
    lifeHistory: [
      ...cloneLifeHistory(specimen.lifeHistory),
      restoredEvent,
    ],
    lastModified: restoredEvent.createdAt,
  };

  return addCheckpointReversionScar(
    specimen,
    restored,
    checkpoint.id,
    restoredEvent.id,
    restoredEvent.createdAt,
  );
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
