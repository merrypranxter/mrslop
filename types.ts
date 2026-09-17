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

export interface Checkpoint {
  id: string;
  reason: string;
  genome: Genome;
  createdAt: number;
}

export interface AcquiredTrait {
  id: string;
  name: string;
  description: string;
  prompt?: string;
  createdAt: number;
}

export interface Specimen {
  schemaVersion: 1;
  id: string;
  name: string;
  phase: SpecimenPhase;
  birthGenome: Genome;
  currentGenome: Genome;
  messages: Message[];
  artifacts: Artifact[];
  checkpoints: Checkpoint[];
  acquiredTraits: AcquiredTrait[];
  scars: unknown[];
  trajectory: unknown | null;
  controllerState: unknown | null;
  metrics: unknown | null;
  lineage: unknown | null;
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
