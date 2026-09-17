import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DEFAULT_MODEL = 'gemini-3-flash-preview';
const MAX_RETRIES = 3;

app.use(express.json({ limit: '85mb' }));

const FUSE_COMPILER_INSTRUCTION = `
You are the Mr. Slop FUSE compiler. You receive a set of cognitive mechanisms selected by the user.

Produce ONE compact operational specimen kernel, not commentary about the components.

Requirements:
- preserve every supplied mechanism as causally active;
- do not average the mechanisms into generic creativity or weirdness;
- assign separate jurisdictions when mechanisms can operate on different parts of cognition or generation;
- when a contradiction is productive, preserve it as an explicit operating tension rather than reconciling it away;
- make interactions between mechanisms operational and specific;
- preserve the user's custom seed when one is supplied;
- do not claim to modify model weights, hidden states, or neural architecture;
- return only the compiled kernel text with no preamble, analysis, markdown fence, or source list.
`.trim();

const getGeminiClient = (): GoogleGenAI => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'undefined' || apiKey === 'MY_GEMINI_API_KEY') {
    const error = new Error('GEMINI_API_KEY is missing from the server-side AI Studio Secrets environment.');
    (error as any).code = 'MR_SLOP_SERVER_KEY_MISSING';
    throw error;
  }

  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: { 'User-Agent': 'aistudio-build' },
    },
  });
};

const getErrorDetails = (error: any) => {
  const nested = error?.response || error?.error || error || {};
  return {
    message: nested.message || error?.message || 'Unknown Gemini server error.',
    code: error?.code || nested.code || 'MR_SLOP_GEMINI_ERROR',
    status: Number(nested.status || error?.status || 0),
  };
};

const isRetryable = (details: ReturnType<typeof getErrorDetails>) =>
  details.status === 429 ||
  details.status === 503 ||
  /429|503|RESOURCE_EXHAUSTED|UNAVAILABLE|quota|overload/i.test(details.message);

const generateWithRetry = async (request: Parameters<GoogleGenAI['models']['generateContent']>[0]) => {
  const ai = getGeminiClient();
  let attempt = 0;

  while (true) {
    try {
      return await ai.models.generateContent(request);
    } catch (error) {
      const details = getErrorDetails(error);
      if (!isRetryable(details) || attempt >= MAX_RETRIES) throw error;
      attempt += 1;
      await new Promise(resolve => setTimeout(resolve, (2 ** attempt) * 500 + Math.random() * 250));
    }
  }
};

app.post('/api/mr-slop/chat', async (req, res) => {
  const { model, contents, systemInstruction, temperature, maxOutputTokens } = req.body || {};

  if (!Array.isArray(contents) || typeof systemInstruction !== 'string') {
    return res.status(400).json({
      code: 'MR_SLOP_BAD_CHAT_REQUEST',
      error: 'Chat request is missing contents or systemInstruction.',
    });
  }

  try {
    const response = await generateWithRetry({
      model: typeof model === 'string' && model.trim() ? model : DEFAULT_MODEL,
      contents,
      config: {
        systemInstruction,
        ...(typeof temperature === 'number' ? { temperature } : {}),
        maxOutputTokens: typeof maxOutputTokens === 'number' ? maxOutputTokens : 8192,
      },
    });

    return res.json({
      text: response.text || '',
      finishReason: response.candidates?.[0]?.finishReason,
    });
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('[MR_SLOP_SERVER] Chat generation failed:', details.code, details.message);
    return res.status(details.status === 429 ? 429 : details.status === 503 ? 503 : 500).json({
      code: String(details.code),
      error: details.message,
    });
  }
});

app.post('/api/mr-slop/fuse', async (req, res) => {
  const source = req.body?.source;
  if (typeof source !== 'string' || !source.trim()) {
    return res.status(400).json({
      code: 'MR_SLOP_BAD_FUSE_REQUEST',
      error: 'FUSE request is missing source mechanisms.',
    });
  }

  try {
    const response = await generateWithRetry({
      model: DEFAULT_MODEL,
      contents: { parts: [{ text: source }] },
      config: {
        systemInstruction: FUSE_COMPILER_INSTRUCTION,
        temperature: 0.45,
        maxOutputTokens: 8192,
      },
    });

    return res.json({ text: response.text?.trim() || '' });
  } catch (error) {
    const details = getErrorDetails(error);
    console.error('[MR_SLOP_SERVER] FUSE generation failed:', details.code, details.message);
    return res.status(details.status === 429 ? 429 : details.status === 503 ? 503 : 500).json({
      code: String(details.code),
      error: details.message,
    });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[MR_SLOP_SERVER] listening on http://0.0.0.0:${PORT}`);
  });
}

void startServer();
