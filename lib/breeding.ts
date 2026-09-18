import type {
  GeneticsReceipt,
  Genome,
  GenomeComponent,
  LifeHistoryEvent,
  Specimen,
} from '../types';
import { Role } from '../types';
import { applyBirthMutation } from './birthMutation';
import {
  breedingStateHash,
  componentFunctionalFingerprint,
  traitFunctionalFingerprint,
} from './breedingState';
import { crossoverGenome } from './genomeBreeding';
import {
  GENETICS_ALGORITHM_VERSION,
  canonicalParentIds,
  generateBreedingSeed,
  stableHash,
} from './geneticsRandom';
import { inheritTraits } from './traitBreeding';
import { captureBirthBaseline } from '../services/specimenStore';

export interface BreedingPreviewOptions {
  seed?: string;
  now?: number;
  idFactory?: () => string;
  library?: GenomeComponent[];
  childName?: string;
}

export interface BreedingPreview {
  child: Specimen;
  receipt: GeneticsReceipt;
}

const cloneComponent = (component: GenomeComponent): GenomeComponent => ({
  ...component,
  tags: [...component.tags],
  roleHints: [...component.roleHints],
});

const cloneGenome = (genome: Genome): Genome => ({
  ...genome,
  components: genome.components.map(cloneComponent),
});

const canonicalParentPair = (
  parentA: Specimen,
  parentB: Specimen,
): [Specimen, Specimen] => {
  const ids = canonicalParentIds(parentA.id, parentB.id);
  return parentA.id === ids[0] ? [parentA, parentB] : [parentB, parentA];
};

const childLineageRoots = (
  parentA: Specimen,
  parentB: Specimen,
): string[] =>
  [...new Set([
    ...parentA.lineage.rootSpecimenIds,
    ...parentB.lineage.rootSpecimenIds,
  ])].sort();

const makeBirthNote = (
  parentA: Specimen,
  parentB: Specimen,
  componentCount: number,
  traitCount: number,
  mutationOutcome: GeneticsReceipt['mutation']['outcome'],
  generation: number,
): string => {
  const mutationText = mutationOutcome === 'none'
    ? 'No birth mutation occurred.'
    : mutationOutcome === 'no-valid-candidate'
      ? 'The birth-mutation roll triggered, but no valid mutation candidate existed.'
      : `One ${mutationOutcome} birth mutation occurred.`;

  return [
    `Bred from ${parentA.name} and ${parentB.name} at generation ${generation}.`,
    `Born STACK with ${componentCount} genome component${componentCount === 1 ? '' : 's'} and ${traitCount} inherited active trait${traitCount === 1 ? '' : 's'}.`,
    mutationText,
    'This specimen starts a fresh conversation from its own birth state.',
  ].join(' ');
};

const makeIdempotencyKey = (
  canonicalIds: [string, string],
  stateHashes: [string, string],
  seed: string,
): string => stableHash({
  algorithmVersion: GENETICS_ALGORITHM_VERSION,
  canonicalParentIds: canonicalIds,
  parentStateHashes: stateHashes,
  seed,
});

export const createBreedingPreview = (
  parentA: Specimen,
  parentB: Specimen,
  options: BreedingPreviewOptions = {},
): BreedingPreview => {
  if (parentA.id === parentB.id) {
    throw new Error('BREEDING_REQUIRES_DISTINCT_PARENTS');
  }
  if (parentA.phase !== 'spawned' || parentB.phase !== 'spawned') {
    throw new Error('BREEDING_REQUIRES_SPAWNED_PARENTS');
  }

  const now = options.now ?? Date.now();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const seed = options.seed ?? generateBreedingSeed();
  const canonicalParents = canonicalParentPair(parentA, parentB);
  const canonicalIds = canonicalParentIds(parentA.id, parentB.id);
  const stateHashes: [string, string] = [
    breedingStateHash(canonicalParents[0]),
    breedingStateHash(canonicalParents[1]),
  ];

  const receiptId = idFactory();
  const childId = idFactory();
  const genomeId = idFactory();

  const genomeResult = crossoverGenome(parentA, parentB, seed);
  const traitResult = inheritTraits(parentA, parentB, seed, {
    now,
    idFactory,
  });
  const mutationResult = applyBirthMutation(
    parentA,
    parentB,
    genomeResult.components,
    traitResult.traits,
    seed,
    { library: options.library },
  );

  const finalComponents = mutationResult.components.map((component, order) => ({
    ...cloneComponent(component),
    enabled: true,
    order,
  }));
  const finalTraits = mutationResult.traits;

  const birthGenome: Genome = {
    id: genomeId,
    mode: 'stack',
    components: finalComponents.map(cloneComponent),
  };
  const currentGenome = cloneGenome(birthGenome);

  const generation = Math.max(
    parentA.lineage.generation,
    parentB.lineage.generation,
  ) + 1;
  const roots = childLineageRoots(parentA, parentB);
  const idempotencyKey = makeIdempotencyKey(canonicalIds, stateHashes, seed);

  const receipt: GeneticsReceipt = {
    id: receiptId,
    algorithmVersion: GENETICS_ALGORITHM_VERSION,
    breedingSeed: seed,
    idempotencyKey,
    previewCreatedAt: now,
    parentAId: parentA.id,
    parentBId: parentB.id,
    canonicalParentIds: canonicalIds,
    parentStateHashes: stateHashes,
    genome: structuredClone(genomeResult.receipt),
    traits: structuredClone(traitResult.receipt),
    mutation: structuredClone(mutationResult.receipt),
    finalBirthState: {
      componentFingerprints: finalComponents.map(componentFunctionalFingerprint),
      componentIds: finalComponents.map(component => component.id),
      traitFingerprints: finalTraits.map(traitFunctionalFingerprint),
      mode: 'stack',
      expectedLifetimeDrift: 0,
    },
  };

  const childName = options.childName?.trim() ||
    `${parentA.name} × ${parentB.name} / CHILD`;

  const birthEvent: LifeHistoryEvent = {
    id: idFactory(),
    type: 'specimen-born-from-breeding',
    summary: `Born from breeding of ${parentA.name} and ${parentB.name}.`,
    relatedSpecimenIds: [...canonicalIds],
    geneticsReceiptId: receipt.id,
    breedingSeed: seed,
    messageIds: [],
    artifactIds: [],
    createdAt: now,
  };

  const birthMessage = {
    id: idFactory(),
    role: Role.SYSTEM,
    content: makeBirthNote(
      parentA,
      parentB,
      finalComponents.length,
      finalTraits.length,
      mutationResult.receipt.outcome,
      generation,
    ),
    timestamp: now,
  };

  const childShell = {
    acquiredTraits: finalTraits,
    infections: [],
    scars: [],
  };

  const child: Specimen = {
    schemaVersion: 4,
    id: childId,
    name: childName,
    phase: 'spawned',
    birthGenome,
    currentGenome,
    messages: [birthMessage],
    artifacts: [],
    checkpoints: [],
    acquiredTraits: finalTraits,
    infections: [],
    lifeHistory: [birthEvent],
    scars: [],
    birthBaseline: captureBirthBaseline(
      childShell,
      birthGenome,
      'bred-v4',
      now,
    ),
    lineage: {
      kind: 'bred',
      parentSpecimenIds: [...canonicalIds],
      rootSpecimenIds: roots,
      generation,
      bredAt: now,
      geneticsReceiptId: receipt.id,
      source: 'bred-v4',
    },
    geneticsReceipt: structuredClone(receipt),
    trajectory: null,
    controllerState: null,
    metrics: null,
    createdAt: now,
    lastModified: now,
  };

  return {
    child,
    receipt,
  };
};
