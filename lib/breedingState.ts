import type {
  AcquiredTrait,
  GenomeComponent,
  InheritanceRef,
  Scar,
  Specimen,
} from '../types';
import { stableHash } from './geneticsRandom';

const compactInheritanceSource = (source: InheritanceRef) => ({
  specimenId: source.specimenId,
  recordId: source.recordId,
});

export const componentFunctionalFingerprint = (component: GenomeComponent): string =>
  stableHash({
    id: component.id,
    kind: component.kind,
    version: component.version,
    sourceRepo: component.sourceRepo,
    sourcePath: component.sourcePath,
    sourceSha: component.sourceSha,
    prompt: component.prompt,
  });

export const traitFunctionalFingerprint = (trait: AcquiredTrait): string =>
  stableHash({
    prompt: trait.prompt.trim(),
    birthVariation: trait.birthVariation
      ? {
          mutatorId: trait.birthVariation.mutatorId,
          mutatorVersion: trait.birthVariation.mutatorVersion,
          after: trait.birthVariation.after,
        }
      : undefined,
  });

const activeTraitSnapshot = (trait: AcquiredTrait) => ({
  id: trait.id,
  fingerprint: traitFunctionalFingerprint(trait),
  originType: trait.originType,
  inheritanceSources: (trait.inheritanceSources ?? [])
    .map(compactInheritanceSource)
    .sort((a, b) =>
      a.specimenId.localeCompare(b.specimenId) ||
      a.recordId.localeCompare(b.recordId)),
});

const relevantScars = (
  scars: Scar[],
  traits: AcquiredTrait[],
): Array<{
  id: string;
  kind: Scar['kind'];
  sourceSpecimenId?: string;
  sourceScarId?: string;
  relatedMutationIds: string[];
}> => {
  const relevantMutationIds = new Set<string>();

  for (const trait of traits) {
    relevantMutationIds.add(trait.id);
    for (const source of trait.inheritanceSources ?? []) {
      relevantMutationIds.add(source.recordId);
    }
  }

  return scars
    .filter(scar => scar.relatedMutationIds.some(id => relevantMutationIds.has(id)))
    .map(scar => ({
      id: scar.id,
      kind: scar.kind,
      sourceSpecimenId: scar.sourceSpecimenId,
      sourceScarId: scar.sourceScarId,
      relatedMutationIds: [...scar.relatedMutationIds].sort(),
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
};

export interface BreedingStateSnapshot {
  specimenId: string;
  lineage: {
    kind: Specimen['lineage']['kind'];
    parentSpecimenIds: string[];
    rootSpecimenIds: string[];
    generation: number;
  };
  currentGenome: {
    id: string;
    components: Array<{
      id: string;
      enabled: boolean;
      order: number;
      fingerprint: string;
    }>;
  };
  activeTraits: ReturnType<typeof activeTraitSnapshot>[];
  supportingScars: ReturnType<typeof relevantScars>;
}

export const breedingStateSnapshot = (specimen: Specimen): BreedingStateSnapshot => {
  const activeTraits = specimen.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(activeTraitSnapshot)
    .sort((a, b) => a.id.localeCompare(b.id));

  const components = specimen.currentGenome.components
    .map(component => ({
      id: component.id,
      enabled: component.enabled,
      order: component.order,
      fingerprint: componentFunctionalFingerprint(component),
    }))
    .sort((a, b) =>
      a.order - b.order ||
      a.id.localeCompare(b.id) ||
      a.fingerprint.localeCompare(b.fingerprint));

  return {
    specimenId: specimen.id,
    lineage: {
      kind: specimen.lineage.kind,
      parentSpecimenIds: [...specimen.lineage.parentSpecimenIds].sort(),
      rootSpecimenIds: [...specimen.lineage.rootSpecimenIds].sort(),
      generation: specimen.lineage.generation,
    },
    currentGenome: {
      id: specimen.currentGenome.id,
      components,
    },
    activeTraits,
    supportingScars: relevantScars(specimen.scars, specimen.acquiredTraits.filter(
      trait => trait.status === 'active',
    )),
  };
};

export const breedingStateHash = (specimen: Specimen): string =>
  stableHash(breedingStateSnapshot(specimen));
