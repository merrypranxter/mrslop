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
  inheritedFrom?: InheritanceRef;
  createdAt: number;
  endedAt?: number;
  endReason?: string;
}

export type TraitStatus = 'active' | 'retired';
export type TraitOriginType = 'explicit' | 'promoted-infection' | 'fossilized-accident' | 'mr-slop-proposal';

export interface AcquiredTrait {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: TraitStatus;
  originType: TraitOriginType;
  provenance: MutationProvenance;
  inheritedFrom?: InheritanceRef;
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
  | 'scar-inherited';

export interface LifeHistoryEvent {
  id: string;
  type: LifeHistoryEventType;
  summary: string;
  mutationId?: string;
  checkpointId?: string;
  scarId?: string;
  relatedSpecimenId?: string;
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

export interface LineageRecord {
  rootSpecimenId: string;
  parentSpecimenId: string | null;
  generation: number;
  forkedAt?: number;
  forkSourceEventId?: string;
  forkSourceCheckpointId?: string;
  forkSourceGenomeId?: string;
  source: 'native-v3' | 'fork-v3' | 'migrated-v2';
}

export interface DriftBaseline {
  capturedAt: number;
  source: 'native-v3' | 'fork-v3' | 'migrated-v2';
  genome: Genome;
  activeTraitIds: string[];
  activeInfectionIds: string[];
  inheritedScarIds: string[];
}

export interface Specimen {
  schemaVersion: 3;
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
