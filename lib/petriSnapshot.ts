import type {
  AcquiredTrait,
  Genome,
  GenomeComponent,
  Infection,
  PetriEntrantSnapshot,
  Specimen,
} from '../types';
import { calculateDrift } from './drift';
import { stableHash } from './geneticsRandom';
import { activeInfections, activeTraits } from './mutations';

export const PETRI_SNAPSHOT_VERSION = 'mrslop-petri-snapshot-v1';

export interface CreatePetriSnapshotOptions {
  now?: number;
  idFactory?: () => string;
}

const cloneGenome = (genome: Genome): Genome => structuredClone(genome);

const runtimeComponent = (component: GenomeComponent) => ({
  id: component.id,
  name: component.name,
  kind: component.kind,
  version: component.version,
  sourceRepo: component.sourceRepo,
  sourcePath: component.sourcePath,
  sourceSha: component.sourceSha,
  prompt: component.prompt,
  order: component.order,
});

const runtimeTrait = (trait: AcquiredTrait) => ({
  id: trait.id,
  name: trait.name,
  prompt: trait.prompt,
  createdAt: trait.createdAt,
});

const runtimeInfection = (infection: Infection) => ({
  id: infection.id,
  name: infection.name,
  prompt: infection.prompt,
  durationMode: infection.durationMode,
  durationTurns: infection.durationTurns,
  remainingTurns: infection.remainingTurns,
  createdAt: infection.createdAt,
});

const runtimeHashInput = (snapshot: Pick<
  PetriEntrantSnapshot,
  'genome' | 'activeTraits' | 'activeInfections'
>) => {
  const enabledComponents = snapshot.genome.components
    .filter(component => component.enabled)
    .map(runtimeComponent)
    .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));

  return {
    snapshotVersion: PETRI_SNAPSHOT_VERSION,
    genome: {
      mode: snapshot.genome.mode,
      components: enabledComponents,
      ...(snapshot.genome.mode === 'stack'
        ? { customSeed: snapshot.genome.customSeed?.trim() || undefined }
        : {
            compiledKernel: snapshot.genome.compiledKernel ?? '',
            compilerVersion: snapshot.genome.compilerVersion,
          }),
    },
    activeTraits: snapshot.activeTraits
      .map(runtimeTrait)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
    activeInfections: snapshot.activeInfections
      .map(runtimeInfection)
      .sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id)),
  };
};

export const petriEntrantStateHash = (
  snapshot: Pick<PetriEntrantSnapshot, 'genome' | 'activeTraits' | 'activeInfections'>,
): string => stableHash(runtimeHashInput(snapshot));

export const createPetriChallengeHash = (challenge: string): string =>
  stableHash({ challenge });

export const createPetriEntrantSnapshot = (
  specimen: Specimen,
  options: CreatePetriSnapshotOptions = {},
): PetriEntrantSnapshot => {
  if (specimen.phase !== 'spawned') {
    throw new Error('PETRI_ENTRANT_NOT_SPAWNED');
  }

  const now = options.now ?? Date.now();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const drift = calculateDrift(specimen);
  const genome = cloneGenome(specimen.currentGenome);
  const traits = structuredClone(activeTraits(specimen));
  const infections = structuredClone(activeInfections(specimen));

  const snapshotWithoutHash: Omit<PetriEntrantSnapshot, 'stateHash'> = {
    id: idFactory(),
    specimenId: specimen.id,
    specimenName: specimen.name,
    specimenSchemaVersion: 4,
    generation: specimen.lineage.generation,
    lineageKind: specimen.lineage.kind,
    driftScore: drift.score,
    driftBand: drift.band,
    genome,
    activeTraits: traits,
    activeInfections: infections,
    capturedAt: now,
  };

  return {
    ...snapshotWithoutHash,
    stateHash: petriEntrantStateHash(snapshotWithoutHash),
  };
};
