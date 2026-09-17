import { describe, expect, it } from 'vitest';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { buildCatalogIndex, findComponentsByRole } from '../lib/catalog';

describe('Round 1 AI SLOP library', () => {
  it('contains the complete first-round catalog', () => {
    expect(SLOP_LIBRARY.filter(component => component.kind === 'mind')).toHaveLength(26);
    expect(SLOP_LIBRARY).toHaveLength(40);
    expect(new Set(SLOP_LIBRARY.map(component => component.id)).size).toBe(SLOP_LIBRARY.length);
  });

  it('pins usable prompts and provenance for every component', () => {
    expect(SLOP_LIBRARY.every(component => component.prompt.trim().length > 40)).toBe(true);
    expect(SLOP_LIBRARY.every(component => Boolean(component.sourcePath && component.sourceSha))).toBe(true);
    expect(SLOP_LIBRARY.every(component => component.charWeight === component.prompt.length)).toBe(true);
  });

  it('keeps the canonical Temporary Mind numbering stable', () => {
    const minds = SLOP_LIBRARY.filter(component => component.kind === 'mind');
    expect(minds[0].id).toBe('tm-01');
    expect(minds[25].id).toBe('tm-26');
    expect(minds[14].name).toContain('Alien Distance Metrics');
  });

  it('builds a compact searchable catalog for conversation mode', () => {
    const catalog = buildCatalogIndex(SLOP_LIBRARY);
    expect(catalog).toContain('Separated Jurisdictions');
    expect(catalog).toContain('Synthetic Valence');
    expect(catalog).not.toContain('FULL INSTALLATION PROMPT');
  });

  it('can retrieve components by functional role', () => {
    expect(findComponentsByRole(SLOP_LIBRARY, 'memory').map(component => component.id)).toContain('tm-23');
    expect(findComponentsByRole(SLOP_LIBRARY, 'structure').length).toBeGreaterThan(0);
  });
});
