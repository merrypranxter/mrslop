import { Genome } from '../types';
import { postMrSlopServer } from './geminiService';

export const MR_SLOP_FUSE_VERSION = 'MR_SLOP_FUSE_V1';

interface FuseResponse {
  text?: string;
  error?: string;
  code?: string;
}

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

  const response = await postMrSlopServer<FuseResponse>(
    '/api/mr-slop/fuse',
    { source: `${source}${seed}` },
    signal,
  );

  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

  const kernel = response.text?.trim() || '';
  if (kernel.length < 120) throw new Error('FUSE_KERNEL_INCOMPLETE');

  return kernel;
};