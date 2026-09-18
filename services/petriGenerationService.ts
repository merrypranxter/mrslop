import { postMrSlopServer } from './geminiService';

export interface PetriGenerationRequest {
  challenge: string;
  systemInstruction: string;
  model: string;
  temperature: number;
  maxOutputTokens: number;
  signal?: AbortSignal;
}

export interface PetriGenerationResponse {
  text: string;
  finishReason?: string;
}

interface PetriServerResponse {
  text?: string;
  finishReason?: string;
  error?: string;
  code?: string;
}

export const sendPetriGeneration = async ({
  challenge,
  systemInstruction,
  model,
  temperature,
  maxOutputTokens,
  signal,
}: PetriGenerationRequest): Promise<PetriGenerationResponse> => {
  const result = await postMrSlopServer<PetriServerResponse>(
    '/api/mr-slop/chat',
    {
      model,
      contents: [{
        role: 'user',
        parts: [{ text: challenge }],
      }],
      systemInstruction,
      temperature,
      maxOutputTokens,
    },
    signal,
  );

  return {
    text: result.text ?? '',
    ...(result.finishReason ? { finishReason: result.finishReason } : {}),
  };
};
