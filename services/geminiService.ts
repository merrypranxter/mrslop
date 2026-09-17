import { GenerateContentResponse, GoogleGenAI } from '@google/genai';
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

const MAX_RETRIES = 3;
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

export const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey || apiKey === 'undefined') {
    throw new Error('API_KEY_MISSING: No valid Gemini API key detected in environment.');
  }
  return new GoogleGenAI({ apiKey });
};

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

const errorDetails = (error: any): { message: string; code: unknown; status: string } => {
  const nested = error?.response || error?.error || error || {};
  return {
    message: nested.message || error?.message || 'UNKNOWN_ERROR',
    code: nested.code || 0,
    status: nested.status || '',
  };
};

const isRetryable = (details: { message: string; code: unknown; status: string }): boolean =>
  details.code === 429 ||
  details.code === 503 ||
  details.status === 'RESOURCE_EXHAUSTED' ||
  details.status === 'UNAVAILABLE' ||
  /429|503|quota|RESOURCE_EXHAUSTED|UNAVAILABLE/i.test(details.message);

const delay = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  if (signal) {
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  }
});

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

  const payloadBytes = JSON.stringify(contents).length + systemInstruction.length;
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    throw new Error('MR_SLOP_PAYLOAD_TOO_LARGE');
  }

  const ai = getGeminiClient();
  let attempt = 0;

  while (true) {
    if (signal?.aborted) return { text: 'Stopped.' };
    try {
      const response: GenerateContentResponse = await ai.models.generateContent({
        model: MR_SLOP_MODEL,
        contents,
        config: {
          systemInstruction: `${systemInstruction}\n\n${RESPONSE_ENVELOPE_CONTRACT}`,
          temperature: 0.9,
          maxOutputTokens: 8192,
        },
      });

      if (response.text?.trim()) return parseMrSlopEnvelope(response.text);

      const reason = response.candidates?.[0]?.finishReason;
      return {
        text: reason
          ? `Mr. Slop did not get a usable response back. Finish reason: ${reason}.`
          : 'Mr. Slop got an empty response. Try that turn again.',
      };
    } catch (error: any) {
      if (error?.name === 'AbortError' || signal?.aborted) return { text: 'Stopped.' };
      const details = errorDetails(error);
      if (isRetryable(details) && attempt < MAX_RETRIES) {
        attempt += 1;
        await delay((2 ** attempt) * 500 + Math.random() * 250, signal);
        continue;
      }
      if (/API_KEY_MISSING|API_KEY_INVALID|Requested entity was not found/i.test(details.message)) {
        throw new Error('MR_SLOP_API_KEY_INVALID');
      }
      throw new Error(`MR_SLOP_TRANSMISSION_FAILED:${details.message}`);
    }
  }
};

/**
 * Temporary compile-time bridge for the Ghost-derived Terminal component.
 * App.tsx no longer renders that component; Task 7 removes it entirely.
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
