import { describe, expect, it } from 'vitest';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import {
  breedingStateHash,
  breedingStateSnapshot,
  componentFunctionalFingerprint,
  traitFunctionalFingerprint,
} from '../lib/breedingState';
import { createGenome } from '../lib/genome';
import { makeSpecimen } from '../services/specimenStore';
import type { AcquiredTrait, Infection, Scar, Specimen } from '../types';

const baseSpecimen = (): Specimen => {
  const specimen = makeSpecimen(
    createGenome(['tm-01', 'tm-15'], SLOP_LIBRARY, 'stack'),
    'BREEDER',
    'spawned',
  );

  return {
    ...specimen,
    currentGenome: {
      ...specimen.currentGenome,
      components: specimen.currentGenome.components.map((component, index) => ({
        ...component,
        order: index,
      })),
    },
  };
};

const trait = (
  specimen: Specimen,
  id: string,
  prompt: string,
  originType: AcquiredTrait['originType'] = 'explicit',
  status: AcquiredTrait['status'] = 'active',
): AcquiredTrait => ({
  id,
  name: `Trait ${id}`,
  description: `Description ${id}`,
  prompt,
  status,
  originType,
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 10,
});

const infection = (specimen: Specimen): Infection => ({
  id: 'infection-active',
  name: 'TEMP THING',
  description: 'Temporary and excluded from breeding.',
  prompt: 'Temporarily reinterpret every boundary.',
  status: 'active',
  durationMode: 'indefinite',
  provenance: {
    specimenId: specimen.id,
    genomeId: specimen.currentGenome.id,
    sourceType: 'conversation',
    sourceMessageIds: [],
    sourceArtifactIds: [],
  },
  createdAt: 11,
});

const supportingScar = (specimen: Specimen, traitId: string): Scar => ({
  id: 'scar-support',
  name: 'Trait support',
  description: 'A factual scar linked to one trait.',
  kind: 'fossilized-accident',
  origin: 'experienced',
  createdAt: 12,
  sourceSpecimenId: specimen.id,
  relatedEventIds: [],
  relatedMutationIds: [traitId],
  relatedCheckpointIds: [],
  messageIds: [],
  artifactIds: [],
});

const unrelatedScar = (specimen: Specimen): Scar => ({
  ...supportingScar(specimen, 'something-else'),
  id: 'scar-unrelated',
});

describe('breeding-relevant state', () => {
  it('fingerprints component behavior without treating display metadata or order as identity', () => {
    const component = baseSpecimen().currentGenome.components[0];
    const sameBehavior = {
      ...component,
      name: 'DISPLAY NAME CHANGED',
      description: 'display copy changed',
      tags: ['totally-different-tag'],
      roleHints: ['different-display-hint'],
      order: 99,
    };

    expect(componentFunctionalFingerprint(component))
      .toBe(componentFunctionalFingerprint(sameBehavior));

    expect(componentFunctionalFingerprint(component))
      .not.toBe(componentFunctionalFingerprint({ ...component, prompt: component.prompt + '\nchanged' }));
  });

  it('fingerprints trait behavior rather than IDs names or provenance', () => {
    const specimen = baseSpecimen();
    const a = trait(specimen, 'trait-a', 'Always choose the minority reading.');
    const b = {
      ...trait(specimen, 'trait-b', 'Always choose the minority reading.'),
      name: 'Totally different display name',
      description: 'Different prose description',
      createdAt: 999,
    };

    expect(traitFunctionalFingerprint(a)).toBe(traitFunctionalFingerprint(b));
    expect(traitFunctionalFingerprint(a))
      .not.toBe(traitFunctionalFingerprint({ ...b, prompt: 'Always choose the majority reading.' }));
  });

  it('excludes conversation artifacts infections unrelated history and runtime assembly metadata', () => {
    const specimen = baseSpecimen();
    const baseline = breedingStateHash(specimen);

    const changed: Specimen = {
      ...specimen,
      messages: [{
        id: 'message-new',
        role: 'user' as const,
        content: 'This should not change genetics.',
        timestamp: 100,
      }],
      artifacts: [{
        id: 'artifact-new',
        specimenId: specimen.id,
        kind: 'other',
        title: 'irrelevant',
        content: 'not genetic material',
        genomeId: specimen.currentGenome.id,
        componentIds: [],
        createdAt: 101,
      }],
      infections: [infection(specimen)],
      lifeHistory: [{
        id: 'offspring-old',
        type: 'specimen-offspring-bred',
        summary: 'Already had a child.',
        relatedSpecimenId: 'child-old',
        messageIds: [],
        artifactIds: [],
        createdAt: 102,
      }],
      scars: [unrelatedScar(specimen)],
      currentGenome: {
        ...specimen.currentGenome,
        mode: 'fuse',
        customSeed: 'free-form parent seed that does not cross breeding',
        compiledKernel: 'compiled parent kernel',
        compiledAt: 103,
        compilerVersion: 'anything',
      },
      lastModified: 104,
    };

    expect(breedingStateHash(changed)).toBe(baseline);

    const snapshot = breedingStateSnapshot(changed) as Record<string, unknown>;
    expect(snapshot).not.toHaveProperty('messages');
    expect(snapshot).not.toHaveProperty('artifacts');
    expect(snapshot).not.toHaveProperty('infections');
    expect(snapshot).not.toHaveProperty('lifeHistory');
  });

  it('changes when enabled component identity order or behavior changes', () => {
    const specimen = baseSpecimen();
    const baseline = breedingStateHash(specimen);

    const disabled: Specimen = {
      ...specimen,
      currentGenome: {
        ...specimen.currentGenome,
        components: specimen.currentGenome.components.map((component, index) =>
          index === 0 ? { ...component, enabled: false } : component),
      },
    };
    expect(breedingStateHash(disabled)).not.toBe(baseline);

    const reordered: Specimen = {
      ...specimen,
      currentGenome: {
        ...specimen.currentGenome,
        components: [...specimen.currentGenome.components]
          .reverse()
          .map((component, order) => ({ ...component, order })),
      },
    };
    expect(breedingStateHash(reordered)).not.toBe(baseline);

    const promptChanged: Specimen = {
      ...specimen,
      currentGenome: {
        ...specimen.currentGenome,
        components: specimen.currentGenome.components.map((component, index) =>
          index === 0 ? { ...component, prompt: component.prompt + '\nmutation' } : component),
      },
    };
    expect(breedingStateHash(promptChanged)).not.toBe(baseline);
  });

  it('changes for active trait behavior origin and direct scar support but ignores retired traits', () => {
    const specimen = baseSpecimen();
    const baseline = breedingStateHash(specimen);
    const active = trait(specimen, 'trait-active', 'Choose the minority reading.');

    const withActive: Specimen = {
      ...specimen,
      acquiredTraits: [active],
    };
    expect(breedingStateHash(withActive)).not.toBe(baseline);

    const promoted: Specimen = {
      ...withActive,
      acquiredTraits: [{ ...active, originType: 'promoted-infection' }],
    };
    expect(breedingStateHash(promoted)).not.toBe(breedingStateHash(withActive));

    const scarred: Specimen = {
      ...withActive,
      scars: [supportingScar(specimen, active.id)],
    };
    expect(breedingStateHash(scarred)).not.toBe(breedingStateHash(withActive));

    const retiredOnly: Specimen = {
      ...specimen,
      acquiredTraits: [trait(specimen, 'trait-retired', 'Retired behavior.', 'explicit', 'retired')],
    };
    expect(breedingStateHash(retiredOnly)).toBe(baseline);
  });

  it('includes lineage ancestry needed to construct future two-parent lineage', () => {
    const specimen = baseSpecimen();
    const changed: Specimen = {
      ...specimen,
      lineage: {
        ...specimen.lineage,
        generation: specimen.lineage.generation + 1,
      },
    };

    expect(breedingStateHash(changed)).not.toBe(breedingStateHash(specimen));
  });
});
