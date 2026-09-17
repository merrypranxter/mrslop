import { describe, expect, test } from 'vitest';
import type { GenomeComponent } from '../types';
import {
  cloneGenome,
  createGenome,
  estimateGenomeChars,
  selectSurpriseComponents,
} from '../lib/genome';

const component = (
  id: string,
  roleHints: string[],
  prompt = `PROMPT_${id.toUpperCase()}`,
): GenomeComponent => ({
  id,
  name: id.toUpperCase(),
  kind: roleHints.includes('regulator') ? 'regulator' : 'operator',
  version: '1.0.0',
  sourceRepo: 'test/repo',
  sourcePath: `test/${id}.md`,
  sourceSha: `sha-${id}`,
  description: `fixture ${id}`,
  prompt,
  tags: [id],
  roleHints,
  status: 'procedural',
  enabled: true,
  order: 0,
  charWeight: prompt.length,
});

const library: GenomeComponent[] = [
  component('a', ['ontology']),
  component('b', ['selection']),
  component('c', ['structure']),
  component('d', ['regulator']),
];

describe('genome helpers', () => {
  test('preserves requested component ordering', () => {
    expect(createGenome(['b', 'a'], library, 'stack').components.map(c => c.id)).toEqual(['b', 'a']);
  });

  test('clones genomes and component records instead of sharing references', () => {
    const genome = createGenome(['a'], library, 'stack');
    const clone = cloneGenome(genome);
    expect(clone).not.toBe(genome);
    expect(clone.components[0]).not.toBe(genome.components[0]);
  });

  test('estimates enabled prompt and seed character weight', () => {
    const genome = createGenome(['a', 'b'], library, 'stack', 'seed');
    const expected = genome.components.reduce((n, c) => n + c.prompt.length, 0) + 4;
    expect(estimateGenomeChars(genome)).toBe(expected);
  });

  test('selects a role-balanced surprise set', () => {
    const result = selectSurpriseComponents(library, () => 0);
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(new Set(result).size).toBe(result.length);
    expect(result).toContain('a');
    expect(result).toContain('b');
    expect(result).toContain('c');
  });

  test('throws when asked to install an unknown component', () => {
    expect(() => createGenome(['missing'], library, 'stack')).toThrow('UNKNOWN_COMPONENT:missing');
  });
});
