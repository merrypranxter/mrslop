import { Genome } from '../types';
import { getGeminiClient, MR_SLOP_MODEL } from './geminiService';

export const MR_SLOP_FUSE_VERSION = 'MR_SLOP_FUSE_V1';

const compilerInstruction = `
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

export const compileFuseGenome = async (
  genome: Genome,
  signal?: AbortSignal,
): Promise<string> => {
  const components = genome.components
    .filter(component => component.enabled)
    .sort((a, b) => a.order - b.order);

  if (components.length === 0) throw new Error('FUSE_EMPTY_GENOME');
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const source = components.map(component => [
    `COMPONENT ${component.id} :: ${component.name}`,
    component.prompt,
  ].join('\n')).join('\n\n');

  const seed = genome.customSeed?.trim()
    ? `\n\nCUSTOM SEED\n${genome.customSeed.trim()}`
    : '';

  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: MR_SLOP_MODEL,
    contents: {
      parts: [{ text: `${source}${seed}` }],
    },
    config: {
      systemInstruction: compilerInstruction,
      temperature: 0.45,
      maxOutputTokens: 8192,
    },
  });

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const kernel = response.text?.trim() || '';
  if (kernel.length < 120) throw new Error('FUSE_KERNEL_INCOMPLETE');

  return kernel;
};
