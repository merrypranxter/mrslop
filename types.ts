export enum Role {
  USER = 'user',
  MODEL = 'model',
  SYSTEM = 'system'
}

export interface Message {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  data: string;
  isInlineData: boolean;
  fileHandle?: File;
}

export type ComponentKind = 'mind' | 'operator' | 'regulator' | 'seed' | 'media' | 'custom';
export type GenomeMode = 'stack' | 'fuse';
export type SpecimenPhase = 'building' | 'spawned';

export interface GenomeComponent {
  id: string;
  name: string;
  kind: ComponentKind;
  version: string;
  sourceRepo?: string;
  sourcePath?: string;
  sourceSha?: string;
  description: string;
  prompt: string;
  tags: string[];
  roleHints: string[];
  status?: 'procedural' | 'experimental' | 'observed' | 'speculative';
  enabled: boolean;
  order: number;
  charWeight: number;
}

export interface Genome {
  id: string;
  mode: GenomeMode;
  components: GenomeComponent[];
  customSeed?: string;
  compiledKernel?: string;
  compiledAt?: number;
  compilerVersion?: string;
}

export interface Artifact {
  id: string;
  specimenId: string;
  messageId?: string;
  kind: 'suno' | 'image-prompt' | 'video-prompt' | 'shader' | 'system-prompt' | 'note' | 'other';
  title: string;
  content: string;
  genomeId: string;
  componentIds: string[];
  createdAt: number;
}

export type InfectionStatus = 'active' | 'expired' | 'removed' | 'promoted';
export type InfectionDurationMode = 'turns' | 'indefinite';
export type MutationSourceType = 'user' | 'mr-slop' | 'artifact' | 'conversation' | 'mutation-proposal';

export interface InheritanceRef {
  specimenId: string;
  recordId: string;
  inheritedAt: number;
}

export interface MutationProvenance {
  specimenId: string;
  genomeId: string;
  sourceType: MutationSourceType;
  sourceMessageIds: string[];
  sourceArtifactIds: string[];
}

export interface Infection {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: InfectionStatus;
  durationMode: InfectionDurationMode;
  durationTurns?: number;
  remainingTurns?: number;
  provenance: MutationProvenance;
  inheritanceSources?: InheritanceRef[];
  createdAt: number;
  endedAt?: number;
  endReason?: string;
}

export type TraitStatus = 'active' | 'retired';
export type TraitOriginType =
  | 'explicit'
  | 'promoted-infection'
  | 'fossilized-accident'
  | 'mr-slop-proposal'
  | 'inherited';

export interface TraitBirthVariation {
  mutatorId: string;
  mutatorVersion: string;
  sourceTraitFingerprint: string;
  before: Record<string, string | number | boolean | null>;
  after: Record<string, string | number | boolean | null>;
}

export interface AcquiredTrait {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: TraitStatus;
  originType: TraitOriginType;
  provenance: MutationProvenance;
  inheritanceSources?: InheritanceRef[];
  inheritedSourceOriginTypes?: TraitOriginType[];
  supportingScarIdsAtBirth?: string[];
  birthVariation?: TraitBirthVariation;
  createdAt: number;
  retiredAt?: number;
}

export type LifeHistoryEventType =
  | 'specimen-born'
  | 'genome-mutated'
  | 'infection-started'
  | 'infection-expired'
  | 'infection-removed'
  | 'infection-promoted'
  | 'trait-acquired'
  | 'trait-retired'
  | 'accident-fossilized'
  | 'checkpoint-restored'
  | 'specimen-forked'
  | 'specimen-born-from-fork'
  | 'scar-acquired'
  | 'scar-inherited'
  | 'specimen-offspring-bred'
  | 'specimen-born-from-breeding';

export interface LifeHistoryEvent {
  id: string;
  type: LifeHistoryEventType;
  summary: string;
  mutationId?: string;
  checkpointId?: string;
  scarId?: string;
  relatedSpecimenId?: string;
  relatedSpecimenIds?: string[];
  geneticsReceiptId?: string;
  breedingSeed?: string;
  messageIds: string[];
  artifactIds: string[];
  createdAt: number;
}

export interface MutationProposal {
  id: string;
  kind: 'infection' | 'trait' | 'fossilized-accident';
  name: string;
  description: string;
  prompt: string;
  reason: string;
  recommendedTurns?: number;
  sourceMessageIds: string[];
  sourceArtifactIds: string[];
  sourceType: MutationSourceType;
}

export interface MutationActionRequest {
  type:
    | 'start-infection'
    | 'promote-infection'
    | 'remove-infection'
    | 'acquire-trait'
    | 'retire-trait'
    | 'fossilize-accident'
    | 'restore-checkpoint';
  targetId?: string;
  proposal?: MutationProposal;
  durationMode?: InfectionDurationMode;
  durationTurns?: number;
}

export interface Checkpoint {
  id: string;
  reason: string;
  genome: Genome;
  acquiredTraits: AcquiredTrait[];
  infections: Infection[];
  createdAt: number;
}

export type ScarOrigin = 'experienced' | 'inherited';
export type ScarKind =
  | 'infection-survived'
  | 'infection-promoted'
  | 'fossilized-accident'
  | 'checkpoint-reversion'
  | 'genome-change'
  | 'fork-birth';

export interface Scar {
  id: string;
  name: string;
  description: string;
  kind: ScarKind;
  origin: ScarOrigin;
  createdAt: number;
  sourceSpecimenId?: string;
  sourceScarId?: string;
  inheritedAt?: number;
  relatedEventIds: string[];
  relatedMutationIds: string[];
  relatedCheckpointIds: string[];
  messageIds: string[];
  artifactIds: string[];
}

export type LineageKind = 'root' | 'fork' | 'bred';
export type LineageSource =
  | 'native-v4'
  | 'fork-v4'
  | 'bred-v4'
  | 'migrated-v3'
  | 'migrated-v2';

export interface LineageRecord {
  kind: LineageKind;
  parentSpecimenIds: string[];
  rootSpecimenIds: string[];
  generation: number;
  forkedAt?: number;
  forkSourceEventId?: string;
  forkSourceCheckpointId?: string;
  forkSourceGenomeId?: string;
  bredAt?: number;
  geneticsReceiptId?: string;
  source: LineageSource;
}

export type DriftBaselineSource =
  | 'native-v3'
  | 'fork-v3'
  | 'migrated-v2'
  | 'native-v4'
  | 'fork-v4'
  | 'bred-v4';

export interface DriftBaseline {
  capturedAt: number;
  source: DriftBaselineSource;
  genome: Genome;
  activeTraitIds: string[];
  activeInfectionIds: string[];
  inheritedScarIds: string[];
}

export interface GeneticsComponentDecision {
  fingerprint: string;
  componentId: string;
  role: ComponentKind;
  sourceParentIds: string[];
  status: 'unique' | 'shared' | 'divergent-allele';
  weight: number;
  uniform: number;
  selectionKey: number;
  selected: boolean;
  balanceRepair?: 'removed' | 'added';
  childOrderMetric?: number;
}

export interface GeneticsTraitDecision {
  fingerprint: string;
  sourceParentIds: string[];
  sourceTraitIds: string[];
  sourceOriginTypes: TraitOriginType[];
  shared: boolean;
  baseProbability: number;
  supportingScarIds: string[];
  scarBonus: number;
  finalProbability: number;
  roll: number;
  passed: boolean;
  inheritanceStrength?: number;
  result: 'inherited' | 'failed-roll' | 'displaced-by-cap';
}

export interface GeneticsMutationReceipt {
  triggerRoll: number;
  threshold: number;
  triggered: boolean;
  branchRoll?: number;
  preferredBranch?: 'canonical-component' | 'trait-variation';
  attemptedBranches: Array<'canonical-component' | 'trait-variation'>;
  outcome: 'none' | 'canonical-component' | 'trait-variation' | 'no-valid-candidate';
  canonicalCandidateIds?: string[];
  componentId?: string;
  sourceTraitFingerprint?: string;
  mutatorId?: string;
  mutatorVersion?: string;
  fallbackUsed?: boolean;
  noOpReason?: string;
}

export interface GeneticsGenomeReceipt {
  parentEnabledCounts: [number, number];
  rawMean: number;
  roundingRoll?: number;
  targetSize: number;
  roleCounts: Record<ComponentKind, [number, number]>;
  roleQuotas: Record<ComponentKind, number>;
  redistributedSlots: Array<{
    fromRole: ComponentKind;
    toRole: ComponentKind;
    count: number;
  }>;
  candidates: GeneticsComponentDecision[];
  initialUniqueContribution: [number, number];
  finalUniqueContribution: [number, number];
  balanceNote?: string;
}

export interface GeneticsTraitReceipt {
  candidates: GeneticsTraitDecision[];
  inheritedFingerprints: string[];
}

export interface GeneticsFinalBirthState {
  componentFingerprints: string[];
  componentIds: string[];
  traitFingerprints: string[];
  mode: 'stack';
  expectedLifetimeDrift: 0;
}

export interface GeneticsReceipt {
  id: string;
  algorithmVersion: string;
  breedingSeed: string;
  idempotencyKey: string;
  previewCreatedAt: number;
  persistedAt?: number;
  parentAId: string;
  parentBId: string;
  canonicalParentIds: [string, string];
  parentStateHashes: [string, string];
  genome: GeneticsGenomeReceipt;
  traits: GeneticsTraitReceipt;
  mutation: GeneticsMutationReceipt;
  finalBirthState: GeneticsFinalBirthState;
}

export interface Specimen {
  schemaVersion: 4;
  id: string;
  name: string;
  phase: SpecimenPhase;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Message[];
  artifacts: Artifact[];
  checkpoints: Checkpoint[];
  acquiredTraits: AcquiredTrait[];
  infections: Infection[];
  lifeHistory: LifeHistoryEvent[];
  scars: Scar[];
  birthBaseline: DriftBaseline;
  lineage: LineageRecord;
  geneticsReceipt?: GeneticsReceipt;
  trajectory: unknown | null;
  controllerState: unknown | null;
  metrics: unknown | null;
  createdAt: number;
  lastModified: number;
}

export interface ChoiceCardOption {
  id: string;
  label: string;
  description: string;
  componentIds?: string[];
  mode?: GenomeMode;
}

export interface ChoiceCardEvent {
  type: 'choice-card';
  id: string;
  title: string;
  reason?: string;
  options: ChoiceCardOption[];
}

export interface StructuralDecisionEvent {
  type: 'structural-decision';
  id: string;
  title: string;
  reason: string;
  recommendation?: string;
  options: ChoiceCardOption[];
}

export interface ForkActionRequest {
  type: 'fork-specimen';
  suggestedName?: string;
  reason: string;
}

export interface MrSlopResponseEnvelope {
  text: string;
  uiEvent?: ChoiceCardEvent | StructuralDecisionEvent;
  proposedGenome?: {
    componentIds: string[];
    mode: GenomeMode;
    customSeed?: string;
  };
  mutationProposal?: MutationProposal;
  mutationAction?: MutationActionRequest;
  forkAction?: ForkActionRequest;
}


export type PetriTrialStatus =
  | 'draft'
  | 'running'
  | 'partial'
  | 'complete'
  | 'abandoned';

export type PetriEntrantResultStatus =
  | 'pending'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'aborted';

export type PetriSelectionIdentityMode = 'blind' | 'revealed';

export type PetriDriftBand = 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';

export interface PetriGenerationConfig {
  model: string;
  temperature: number;
  maxOutputTokens: number;
  experimentInstructionVersion: string;
}

export interface PetriEntrantSnapshot {
  id: string;
  specimenId: string;
  specimenName: string;
  specimenSchemaVersion: 4;
  stateHash: string;
  generation: number;
  lineageKind: LineageKind;
  driftScore: number;
  driftBand: PetriDriftBand;
  genome: Genome;
  activeTraits: AcquiredTrait[];
  activeInfections: Infection[];
  capturedAt: number;
}

export interface PetriEntrantAttempt {
  attempt: number;
  status: PetriEntrantResultStatus;
  startedAt: number;
  endedAt?: number;
  outputText?: string;
  finishReason?: string;
  errorCode?: string;
  errorMessage?: string;
  systemInstructionHash: string;
  challengeHash: string;
  entrantStateHash: string;
}

export interface PetriEntrantResult {
  entrantSnapshotId: string;
  specimenId: string;
  status: PetriEntrantResultStatus;
  attempts: PetriEntrantAttempt[];
  outputText?: string;
  finishReason?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PetriSelection {
  selectedEntrantSnapshotIds: string[];
  note?: string;
  identityMode: PetriSelectionIdentityMode;
  selectedAt: number;
  revisedAt?: number;
}

export interface PetriTrial {
  schemaVersion: 1;
  id: string;
  challenge: string;
  challengeHash: string;
  status: PetriTrialStatus;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  experimentInstructionVersion: string;
  entrantOrder: string[];
  entrants: PetriEntrantSnapshot[];
  results: PetriEntrantResult[];
  selection: PetriSelection | null;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  lastModified: number;
}

export enum VisualType {
  STARS = 'stars',
  MATRIX = 'matrix',
  POLYTOPE = 'polytope',
  DYSTOPIA = 'dystopia',
  GLITCH = 'glitch',
  HEX_MAP = 'hex_map',
  NETWORK = 'network'
}

export const getVisualType = (typeStr: string): VisualType | null => {
  const normalized = typeStr.toLowerCase();
  if (Object.values(VisualType).includes(normalized as VisualType)) {
    return normalized as VisualType;
  }
  return null;
};

declare global {
  var google: any;
}
