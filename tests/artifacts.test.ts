import { describe, expect, it } from 'vitest';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createGenome } from '../lib/genome';
import { makeSpecimen, saveArtifact } from '../services/specimenStore';


describe('artifact provenance', () => {
  it('records specimen, message, genome, and installed component ancestry', () => {
    const genome = createGenome(['tm-15', 'separated-jurisdictions'], SLOP_LIBRARY, 'stack');
    const specimen = makeSpecimen(genome, 'Artifact Gremlin');

    const next = saveArtifact(specimen, {
      messageId: 'msg-42',
      kind: 'suno',
      title: 'Alien groove prompt',
      content: 'Make rhythm and harmony disagree about distance.',
    });

    expect(specimen.artifacts).toHaveLength(0);
    expect(next.artifacts).toHaveLength(1);
    expect(next.artifacts[0].specimenId).toBe(specimen.id);
    expect(next.artifacts[0].messageId).toBe('msg-42');
    expect(next.artifacts[0].genomeId).toBe(specimen.currentGenome.id);
    expect(next.artifacts[0].componentIds).toEqual(['tm-15', 'separated-jurisdictions']);
    expect(next.artifacts[0].content).toBe('Make rhythm and harmony disagree about distance.');
  });
});
