import {
  Attachment,
  ChoiceCardEvent,
  Message,
  MrSlopResponseEnvelope,
  Role,
  StructuralDecisionEvent,
} from '../types';
import { readFileAsBase64 } from './fileService';

export const MR_SLOP_MODEL = 'gemini-3-flash-preview';

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 100_000;
const MAX_TEXT_ATTACHMENT_CHARS = 500_000;
const MAX_PAYLOAD_BYTES = 80 * 1024 * 1024;

const RESPONSE_ENVELOPE_CONTRACT = `
RESPONSE FORMAT
Return one JSON object and no markdown fence.
Required: {"text":"your conversational response"}
Optional uiEvent may be either:
{"type":"choice-card","id":"...","title":"...","reason":"...","options":[{"id":"...","label":"...","description":"...","componentIds":["tm-01"],"mode":"stack"}]}
or
{"type":"structural-decision","id":"...","title":"...","reason":"why this changes the specimen","recommendation":"...","options":[...]}
Optional proposedGenome: {"componentIds":["existing-catalog-id"],"mode":"stack|fuse","customSeed":"optional"}
Do not claim an optional event was applied. The application/user must approve structural changes.
`.trim();

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isMode = (value: unknown): value is 'stack' | 'fuse' =>
  value === 'stack' || value === 'fuse';

const parseOption = (value: unknown) => {
  if (!value || typeof value !== 'object') return null;
  const option = value as Record<string, unknown>;
  if (typeof option.id !== 'string' || typeof option.label !== 'string' || typeof option.description !== 'string') {
    return null;
  }
  if (option.componentIds !== undefined && !isStringArray(option.componentIds)) return null;
  if (option.mode !== undefined && !isMode(option.mode)) return null;
  return {
    id: option.id,
    label: option.label,
    description: option.description,
    ...(option.componentIds ? { componentIds: option.componentIds } : {}),
    ...(option.mode ? { mode: option.mode } : {}),
  };
};

const parseUiEvent = (value: unknown): ChoiceCardEvent | StructuralDecisionEvent | undefined => {
  if (!value || typeof value !== 'object') return undefined;
  const event = value as Record<string, unknown>;
  if (event.type !== 'choice-card' && event.type !== 'structural-decision') return undefined;
  if (typeof event.id !== 'string' || typeof event.title !== 'string' || !Array.isArray(event.options)) return undefined;
  const options = event.options.map(parseOption);
  if (options.some(option => option === null) || options.length === 0) return undefined;

  if (event.type === 'structural-decision') {
    if (typeof event.reason !== 'string') return undefined;
    return {
      type: 'structural-decision',
      id: event.id,
      title: event.title,
      reason: event.reason,
      ...(typeof event.recommendation === 'string' ? { recommendation: event.recommendation } : {}),
      options: options as StructuralDecisionEvent['options'],
    };
  }

  return {
    type: 'choice-card',
    id: event.id,
    title: event.title,
    ...(typeof event.reason === 'string' ? { reason: event.reason } : {}),
    options: options as ChoiceCardEvent['options'],
  };
};

const stripJsonFence = (raw: string): string => {
  const trimmed = raw.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1].trim() : trimmed;
};

export const parseMrSlopEnvelope = (raw: string): MrSlopResponseEnvelope => {
  const cleaned = stripJsonFence(raw);
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || typeof parsed.text !== 'string') {
      return { text: raw };
    }

    const envelope: MrSlopResponseEnvelope = { text: parsed.text };
    const uiEvent = parseUiEvent(parsed.uiEvent);
    if (uiEvent) envelope.uiEvent = uiEvent;

    if (parsed.proposedGenome && typeof parsed.proposedGenome === 'object') {
      const proposed = parsed.proposedGenome as Record<string, unknown>;
      if (isStringArray(proposed.componentIds) && isMode(proposed.mode)) {
        envelope.proposedGenome = {
          componentIds: proposed.componentIds,
          mode: proposed.mode,
          ...(typeof proposed.customSeed === 'string' ? { customSeed: proposed.customSeed } : {}),
        };
      }
    }

    return envelope;
  } catch {
    return { text: raw };
  }
};

export interface SendMrSlopArgs {
  history: Message[];
  userMessage: string;
  attachments?: Attachment[];
  systemInstruction: string;
  signal?: AbortSignal;
}

interface ServerGenerationResponse {
  text?: string;
  finishReason?: string;
  error?: string;
  code?: string;
}

const truncate = (value: string, max: number): string =>
  value.length <= max ? value : `${value.slice(0, max)}\n\n[TRUNCATED_FOR_CONTEXT_SIZE]`;

const buildCurrentParts = async (attachments: Attachment[], userMessage: string) => {
  const parts: any[] = [];

  for (const attachment of attachments) {
    if (attachment.isInlineData) {
      let data = attachment.data;
      if ((!data || data.startsWith('[')) && attachment.fileHandle) {
        data = await readFileAsBase64(attachment.fileHandle);
      }
      if (data && !data.startsWith('[')) {
        parts.push({ inlineData: { mimeType: attachment.mimeType, data } });
      }
    } else if (attachment.data) {
      parts.push({
        text: `[ATTACHMENT: ${attachment.name}]\n${truncate(attachment.data, MAX_TEXT_ATTACHMENT_CHARS)}`,
      });
    }
  }

  parts.push({ text: userMessage });
  return parts;
};

export const postMrSlopServer = async <T extends ServerGenerationResponse>(
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<T> => {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  let data: ServerGenerationResponse = {};
  try {
    data = await response.json() as ServerGenerationResponse;
  } catch {
    data = { error: `Server returned HTTP ${response.status} without a JSON response.` };
  }

  if (!response.ok) {
    const code = data.code || `HTTP_${response.status}`;
    throw new Error(`${code}:${data.error || response.statusText || 'Mr. Slop server request failed.'}`);
  }

  return data as T;
};

export const sendMrSlopMessage = async ({
  history,
  userMessage,
  attachments = [],
  systemInstruction,
  signal,
}: SendMrSlopArgs): Promise<MrSlopResponseEnvelope> => {
  if (signal?.aborted) return { text: 'Stopped.' };

  const withoutDuplicateCurrent = history.length > 0 &&
    history[history.length - 1].role === Role.USER &&
    history[history.length - 1].content === userMessage
      ? history.slice(0, -1)
      : history;

  const recentHistory = withoutDuplicateCurrent
    .filter(message => message.role === Role.USER || message.role === Role.MODEL)
    .slice(-MAX_HISTORY_MESSAGES);

  const contents = recentHistory.map(message => ({
    role: message.role === Role.USER ? 'user' : 'model',
    parts: [{ text: truncate(message.content, MAX_MESSAGE_CHARS) }],
  }));
  contents.push({ role: 'user', parts: await buildCurrentParts(attachments, userMessage) });

  const fullSystemInstruction = `${systemInstruction}\n\n${RESPONSE_ENVELOPE_CONTRACT}`;
  const payloadBytes = JSON.stringify(contents).length + fullSystemInstruction.length;
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error('MR_SLOP_PAYLOAD_TOO_LARGE:Reduce attachments or conversation size and try again.');
  }

  try {
    const result = await postMrSlopServer<ServerGenerationResponse>(
      '/api/mr-slop/chat',
      {
        model: MR_SLOP_MODEL,
        contents,
        systemInstruction: fullSystemInstruction,
        temperature: 0.9,
        maxOutputTokens: 8192,
      },
      signal,
    );

    if (result.text?.trim()) return parseMrSlopEnvelope(result.text);

    return {
      text: result.finishReason
        ? `Mr. Slop did not get a usable response back. Finish reason: ${result.finishReason}.`
        : 'Mr. Slop got an empty response. Try that turn again.',
    };
  } catch (error: any) {
    if (error?.name === 'AbortError' || signal?.aborted) return { text: 'Stopped.' };
    throw error;
  }
};

/**
 * Temporary compile-time bridge for the Ghost-derived Terminal component.
 * App.tsx no longer renders that component; final cleanup removes it entirely.
 */
export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string,
  attachments: Attachment[] = [],
  _isMasked = false,
  systemNotes = '',
  signal?: AbortSignal,
): Promise<string> => {
  const envelope = await sendMrSlopMessage({
    history,
    userMessage: systemNotes ? `${systemNotes}\n\n${newMessage}` : newMessage,
    attachments,
    systemInstruction: 'You are Mr. Slop. Respond helpfully and conversationally. This compatibility path is temporary.',
    signal,
  });
  return envelope.text;
};