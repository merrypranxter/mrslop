import { describe, expect, it } from 'vitest';
import { assembleSystemInstruction, compileStackKernel } from '../lib/kernel';
import { Genome, GenomeComponent } from '../types';

const component = (id: string, prompt: string, order: number): GenomeComponent => ({
  id,
  name: id.toUpperCase(),
  kind: 'mind',
  version: 'test',
  description: `${id} description`,
  prompt,
  tags: [],
  roleHints: ['structure'],
  enabled: true,
  order,
  charWeight: prompt.length,
});

const genome = (mode: 'stack' | 'fuse' = 'stack'): Genome => ({
  id: 'genome-test',
  mode,
  components: [component('a', 'PROMPT_A', 0), component('b', 'PROMPT_B', 1)],
});

describe('Mr. Slop kernel architecture', () => {
  it('preserves STACK component order and prompt bodies', () => {
    const kernel = compileStackKernel(genome());
    expect(kernel.indexOf('PROMPT_A')).toBeLessThan(kernel.indexOf('PROMPT_B'));
    expect(kernel).toContain('PROMPT_A');
    expect(kernel).toContain('PROMPT_B');
  });

  it('appends a custom seed after installed components', () => {
    const withSeed = { ...genome(), customSeed: 'CUSTOM_SEED' };
    const kernel = compileStackKernel(withSeed);
    expect(kernel.indexOf('CUSTOM_SEED')).toBeGreaterThan(kernel.indexOf('PROMPT_B'));
  });

  it('gives builder mode the compact catalog but not specimen prompts', () => {
    const instruction = assembleSystemInstruction({
      phase: 'building',
      catalogIndex: 'tm-01 | Example Mind | mind | roles:ontology | example',
      genome: { id: 'empty', mode: 'stack', components: [] },
    });
    expect(instruction).toContain('tm-01 | Example Mind');
    expect(instruction).not.toContain('PROMPT_A');
  });

  it('gives spawned STACK specimens their installed kernel', () => {
    const instruction = assembleSystemInstruction({
      phase: 'spawned',
      catalogIndex: '',
      genome: genome(),
      specimenState: 'Specimen is active.',
    });
    expect(instruction).toContain('PROMPT_A');
    expect(instruction).toContain('Specimen is active.');
  });

  it('requires a compiled kernel for FUSE specimens', () => {
    expect(() => assembleSystemInstruction({
      phase: 'spawned',
      catalogIndex: '',
      genome: genome('fuse'),
    })).toThrow('FUSE_KERNEL_MISSING');
  });

  it('uses the saved FUSE kernel instead of silently stacking', () => {
    const fused: Genome = { ...genome('fuse'), compiledKernel: 'FUSED_KERNEL' };
    const instruction = assembleSystemInstruction({
      phase: 'spawned',
      catalogIndex: '',
      genome: fused,
    });
    expect(instruction).toContain('FUSED_KERNEL');
    expect(instruction).not.toContain('PROMPT_A');
  });
});
