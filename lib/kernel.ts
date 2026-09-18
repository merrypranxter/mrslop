import { AcquiredTrait, Genome, Infection, SpecimenPhase } from '../types';
import { BUILD_MODE_INSTRUCTION, MR_SLOP_BASE_SHELL } from '../prompts/mrSlopBase';
import { KERNEL_PROTOCOL } from '../prompts/kernelProtocol';
import { compileMutationRuntimeLayer } from './mutations';

export interface AssembleSystemInstructionArgs {
  phase: SpecimenPhase;
  catalogIndex: string;
  genome: Genome;
  acquiredTraits?: AcquiredTrait[];
  infections?: Infection[];
  specimenState?: string;
}

export const compileStackKernel = (genome: Genome): string => {
  const installed = genome.components
    .filter(component => component.enabled)
    .sort((a, b) => a.order - b.order)
    .map(component => [
      `--- COMPONENT ${component.id} :: ${component.name} ---`,
      component.prompt,
      `--- END COMPONENT ${component.id} ---`,
    ].join('\n'));

  if (genome.customSeed?.trim()) {
    installed.push([
      '--- CUSTOM SEED ---',
      genome.customSeed.trim(),
      '--- END CUSTOM SEED ---',
    ].join('\n'));
  }

  return installed.join('\n\n');
};

const specimenKernel = (genome: Genome): string => {
  if (genome.mode === 'fuse') {
    const fused = genome.compiledKernel?.trim();
    if (!fused) throw new Error('FUSE_KERNEL_MISSING');
    return fused;
  }
  return compileStackKernel(genome);
};

export const assembleSystemInstruction = ({
  phase,
  catalogIndex,
  genome,
  acquiredTraits = [],
  infections = [],
  specimenState,
}: AssembleSystemInstructionArgs): string => {
  const layers = [MR_SLOP_BASE_SHELL, KERNEL_PROTOCOL];

  if (phase === 'building') {
    layers.push(BUILD_MODE_INSTRUCTION);
    if (catalogIndex.trim()) {
      layers.push(`COMPACT INSTALLABLE CATALOG\n${catalogIndex.trim()}`);
    }
    return layers.join('\n\n');
  }

  const kernel = specimenKernel(genome);
  layers.push(`ACTIVE SPECIMEN KERNEL\n${kernel || '[NO COMPONENTS INSTALLED]'}`);

  const mutationRuntime = compileMutationRuntimeLayer(acquiredTraits, infections);
  if (mutationRuntime.trim()) {
    layers.push(mutationRuntime);
  }

  if (specimenState?.trim()) {
    layers.push(`CURRENT SPECIMEN STATE\n${specimenState.trim()}`);
  }

  return layers.join('\n\n');
};
