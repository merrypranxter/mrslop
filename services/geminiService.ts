import {
  Attachment,
  ChoiceCardEvent,
  Message,
  MrSlopResponseEnvelope,
  MutationActionRequest,
  MutationProposal,
  Role,
  StructuralDecisionEvent,
} from '../types';
import { readFileAsBase64 } from './fileService';

export const MR_SLOP_MODEL = 'gemini-3-flash-preview';

const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 100_000;
const MAX_TEXT_ATTACHMENT_CHARS = 500_000;
const MAX_PAYLOAD_BYTES = 80 * 1024 * 1024;
const MAX_MUTATION_TURNS = 100;

const RESPONSE_ENVELOPE_CONTRACT = `
RESPONSE FORMAT
Return one JSON object and no markdown fence.
Required: {"text":"your conversational response"}
Optional uiEvent may be either:
{"type":"choice-card","id":"...","title":"...","reason":"...","options":[{"id":"...","label":"...","description":"...","componentIds":["tm-01"],"mode":"stack"}]}
or
{"type":"structural-decision","id":"...","title":"...","reason":"why this changes the specimen","recommendation":"...","options":[...]}
Optional proposedGenome: {"componentIds":["existing-catalog-id"],"mode":"stack|fuse","customSeed":"optional"}

Optional mutationProposal:
{"id":"...","kind":"infection|trait|fossilized-accident","name":"...","description":"...","prompt":"operational behavior to apply","reason":"why this is useful now","recommendedTurns":5,"sourceMessageIds":["optional-message-id"],"sourceArtifactIds":["optional-artifact-id"],"sourceType":"user|mr-slop|artifact|conversation|mutation-proposal"}

Optional mutationAction may request exactly one application-owned operation:
{"type":"start-infection","proposal":{...valid infection mutationProposal...},"durationMode":"turns","durationTurns":5}
{"type":"start-infection","proposal":{...valid infection mutationProposal...},"durationMode":"indefinite"}
{"type":"remove-infection|promote-infection|retire-trait|restore-checkpoint","targetId":"existing-id"}
{"type":"acquire-trait","proposal":{...valid trait mutationProposal...}}
{"type":"fossilize-accident","proposal":{...valid fossilized-accident mutationProposal...}}

Mutation rules:
- mutationProposal and mutationAction are suggestions/requests, not proof that state changed.
- Never claim a mutation action was applied until application state confirms it.
- Persistent trait acquisition, promotion, fossilization, retirement, or checkpoint restore requires application/user approval.
- If the user says "fuck with yourself", offer 2-3 operationally distinct candidates when useful; a choice-card may summarize alternatives and mutationProposal should describe the current recommended candidate.
- If the user says "try that temporarily", propose a bounded infection duration when appropriate.
- If the user says "keep that shit", describe the concrete observed behavior to preserve and include supplied source message/artifact IDs when available.
- If the user says "undo that shit", request remove-infection or restore-checkpoint for the likely target; if ambiguous, ask/offer a choice instead of guessing.
Do not claim an optional event was applied. The application/user must approve structural changes.
`.trim();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === 'string');

const isMode = (value: unknown): value is 'stack' | 'fuse' =>
  value === 'stack' || value === 'fuse';

const isPositiveBoundedInteger = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 1 &&
  value <= MAX_MUTATION_TURNS;

const isMutationSourceType = (value: unknown): value is MutationProposal['sourceType'] =>
  value === 'user' ||
  value === 'mr-slop' ||
  value === 'artifact' ||
  value === 'conversation' ||
  value === 'mutation-proposal';

const isMutationKind = (value: unknown): value is MutationProposal['kind'] =>
  value === 'infection' || value === 'trait' || value === 'fossilized-accident';

const parseMutationProposal = (value: unknown): MutationProposal | undefined => {
  if (!isRecord(value)) return undefined;

  if (
    typeof value.id !== 'string' ||
    !isMutationKind(value.kind) ||
    typeof value.name !== 'string' ||
    typeof value.description !== 'string' ||
    typeof value.prompt !== 'string' ||
    typeof value.reason !== 'string' ||
    !isStringArray(value.sourceMessageIds) ||
    !isStringArray(value.sourceArtifactIds) ||
    !isMutationSourceType(value.sourceType)
  ) {
    return undefined;
  }

  if (value.recommendedTurns !== undefined && !isPositiveBoundedInteger(value.recommendedTurns)) {
    return undefined;
  }

  return {
    id: value.id,
    kind: value.kind,
    name: value.name,
    description: value.description,
    prompt: value.prompt,
    reason: value.reason,
    ...(value.recommendedTurns !== undefined ? { recommendedTurns: value.recommendedTurns } : {}),
    sourceMessageIds: [...value.sourceMessageIds],
    sourceArtifactIds: [...value.sourceArtifactIds],
    sourceType: value.sourceType,
  };
};

const parseMutationAction = (value: unknown): MutationActionRequest | undefined => {
  if (!isRecord(value) || typeof value.type !== 'string') return undefined;

  const targetId = value.targetId;
  const proposal = parseMutationProposal(value.proposal);

  switch (value.type) {
    case 'start-infection': {
      if (!proposal || proposal.kind !== 'infection') return undefined;
      if (value.durationMode !== 'turns' && value.durationMode !== 'indefinite') return undefined;
      if (value.durationMode === 'turns' && !isPositiveBoundedInteger(value.durationTurns)) return undefined;
      if (value.durationMode === 'indefinite' && value.durationTurns !== undefined) return undefined;
      return {
        type: 'start-infection',
        proposal,
        durationMode: value.durationMode,
        ...(value.durationMode === 'turns' ? { durationTurns: value.durationTurns as number } : {}),
      };
    }

    case 'remove-infection':
    case 'promote-infection':
    case 'retire-trait':
    case 'restore-checkpoint':
      if (typeof targetId !== 'string' || !targetId.trim()) return undefined;
      return { type: value.type, targetId };

    case 'acquire-trait':
      if (!proposal || proposal.kind !== 'trait') return undefined;
      return { type: 'acquire-trait', proposal };

    case 'fossilize-accident':
      if (!proposal || proposal.kind !== 'fossilized-accident') return undefined;
      return { type: 'fossilize-accident', proposal };

    default:
      return undefined;
  }
};

const parseOption = (value: unknown) => {
  if (!isRecord(value)) return null;
  if (typeof value.id !== 'string' || typeof value.label !== 'string' || typeof value.description !== 'string') {
    return null;
  }
  if (value.componentIds !== undefined && !isStringArray(value.componentIds)) return null;
  if (value.mode !== undefined && !isMode(value.mode)) return null;
  return {
    id: value.id,
    label: value.label,
    description: value.description,
    ...(value.componentIds ? { componentIds: value.componentIds } : {}),
    ...(value.mode ? { mode: value.mode } : {}),
  };
};

const parseUiEvent = (value: unknown): ChoiceCardEvent | StructuralDecisionEvent | undefined => {
  if (!isRecord(value)) return undefined;
  if (value.type !== 'choice-card' && value.type !== 'structural-decision') return undefined;
  if (typeof value.id !== 'string' || typeof value.title !== 'string' || !Array.isArray(value.options)) return undefined;
  const options = value.options.map(parseOption);
  if (options.some(option => option === null) || options.length === 0) return undefined;

  if (value.type === 'structural-decision') {
    if (typeof value.reason !== 'string') return undefined;
    return {
      type: 'structural-decision',
      id: value.id,
      title: value.title,
      reason: value.reason,
      ...(typeof value.recommendation === 'string' ? { recommendation: value.recommendation } : {}),
      options: options as StructuralDecisionEvent['options'],
    };
  }

  return {
    type: 'choice-card',
    id: value.id,
    title: value.title,
    ...(typeof value.reason === 'string' ? { reason: value.reason } : {}),
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

    const mutationProposal = parseMutationProposal(parsed.mutationProposal);
    if (mutationProposal) envelope.mutationProposal = mutationProposal;

    const mutationAction = parseMutationAction(parsed.mutationAction);
    if (mutationAction) envelope.mutationAction = mutationAction;

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
