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
  data: string; // Base64 or Text content depending on type
  isInlineData: boolean; // true for media (base64), false for text/hex
  fileHandle?: File; // Keep reference to avoid loading massive strings into state
}

export interface Session {
  id: string;
  title: string; // First 50 chars of first message or "New Session"
  messages: Message[];
  createdAt: number;
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

// Helper to extract visual type from string if valid
export const getVisualType = (typeStr: string): VisualType | null => {
  const normalized = typeStr.toLowerCase();
  if (Object.values(VisualType).includes(normalized as VisualType)) {
    return normalized as VisualType;
  }
  return null;
};

// Global definition for Google Identity Services
declare global {
  var google: any;
}