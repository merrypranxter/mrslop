import type {
  GeneticsFinalBirthState,
  GeneticsReceipt,
  GenomeComponent,
  Specimen,
} from '../types';
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
  stableSerialize,
} from './geneticsRandom';
import { inheritTraits } from './traitBreeding';

export interface GeneticsReplayOptions {
  library?: GenomeComponent[];
}

export interface GeneticsReplayResult {
  valid: boolean;
  errors: string[];
  finalBirthState?: GeneticsFinalBirthState;
}

const same = (left: unknown, right: unknown): boolean =>
  stableSerialize(left) === stableSerialize(right);

const canonicalParents = (
  parentA: Specimen,
  parentB: Specimen,
): [Specimen, Specimen] => {
  const ids = canonicalParentIds(parentA.id, parentB.id);
  return parentA.id === ids[0] ? [parentA, parentB] : [parentB, parentA];
};

const parentLabel = (
  id: string,
  names: Record<string, string>,
): string => names[id] ?? id;

export const renderGeneticsReceipt = (
  receipt: GeneticsReceipt,
  specimenNames: Record<string, string> = {},
): string => {
  const parentA = parentLabel(receipt.parentAId, specimenNames);
  const parentB = parentLabel(receipt.parentBId, specimenNames);
  const inherited = receipt.traits.candidates.filter(
    candidate => candidate.result === 'inherited',
  );
  const displaced = receipt.traits.candidates.filter(
    candidate => candidate.result === 'displaced-by-cap',
  );

  const lines = [
    'GENETICS RECEIPT',
    `Algorithm: ${receipt.algorithmVersion}`,
    `Parents: ${parentA} × ${parentB}`,
    `Seed: ${receipt.breedingSeed}`,
    `Genome: ${receipt.genome.parentEnabledCounts[0]} + ${receipt.genome.parentEnabledCounts[1]} enabled parent components -> ordinary target ${receipt.genome.targetSize}.`,
  ];

  for (const candidate of receipt.genome.candidates) {
    const sources = candidate.sourceParentIds
      .map(id => parentLabel(id, specimenNames))
      .join(' + ');
    lines.push(
      `Component ${candidate.componentId}: ${candidate.status}, weight ${candidate.weight}, source ${sources || 'none'}, ${candidate.selected ? 'selected' : 'not selected'}.`,
    );
  }

  for (const candidate of receipt.traits.candidates) {
    const sources = candidate.sourceParentIds
      .map(id => parentLabel(id, specimenNames))
      .join(' + ');
    const scarText = candidate.scarBonus > 0
      ? ` + scar support ${Math.round(candidate.scarBonus * 100)}pp`
      : '';
    lines.push(
      `Trait ${candidate.fingerprint}: source ${sources}, base ${Math.round(candidate.baseProbability * 100)}%${scarText}, final ${Math.round(candidate.finalProbability * 100)}%, roll ${candidate.roll.toFixed(6)} -> ${candidate.result}.`,
    );
  }

  if (displaced.length > 0) {
    lines.push(
      `${displaced.length} trait${displaced.length === 1 ? '' : 's'} passed the inheritance roll but were displaced by the three-trait birth cap.`,
    );
  }

  lines.push(
    `Inherited traits: ${inherited.length}.`,
    `Birth mutation: ${receipt.mutation.triggered ? receipt.mutation.outcome : 'not triggered'} (roll ${receipt.mutation.triggerRoll.toFixed(6)}, threshold 0.125).`,
    `Final birth: STACK, ${receipt.finalBirthState.componentIds.length} components, ${receipt.finalBirthState.traitFingerprints.length} traits, expected lifetime drift 0.`,
  );

  return lines.join('\n');
};

export const verifyGeneticsReplay = (
  parentA: Specimen,
  parentB: Specimen,
  receipt: GeneticsReceipt,
  options: GeneticsReplayOptions = {},
): GeneticsReplayResult => {
  const errors: string[] = [];

  if (receipt.algorithmVersion !== GENETICS_ALGORITHM_VERSION) {
    errors.push('ALGORITHM_VERSION_MISMATCH');
    return { valid: false, errors };
  }

  if (parentA.id === parentB.id) {
    errors.push('PARENT_PAIR_MISMATCH');
    return { valid: false, errors };
  }

  const ids = canonicalParentIds(parentA.id, parentB.id);
  if (!same(ids, receipt.canonicalParentIds)) {
    errors.push('PARENT_PAIR_MISMATCH');
    return { valid: false, errors };
  }

  const parents = canonicalParents(parentA, parentB);
  const stateHashes: [string, string] = [
    breedingStateHash(parents[0]),
    breedingStateHash(parents[1]),
  ];

  if (!same(stateHashes, receipt.parentStateHashes)) {
    errors.push('PARENT_STATE_HASH_MISMATCH');
    return { valid: false, errors };
  }

  const genome = crossoverGenome(parentA, parentB, receipt.breedingSeed);
  let traitIndex = 0;
  const traits = inheritTraits(parentA, parentB, receipt.breedingSeed, {
    now: receipt.previewCreatedAt,
    idFactory: () => `replay-trait-${traitIndex++}`,
  });
  const mutation = applyBirthMutation(
    parentA,
    parentB,
    genome.components,
    traits.traits,
    receipt.breedingSeed,
    { library: options.library },
  );

  const finalBirthState: GeneticsFinalBirthState = {
    componentFingerprints: mutation.components.map(componentFunctionalFingerprint),
    componentIds: mutation.components.map(component => component.id),
    traitFingerprints: mutation.traits.map(traitFunctionalFingerprint),
    mode: 'stack',
    expectedLifetimeDrift: 0,
  };

  if (!same(genome.receipt, receipt.genome)) {
    errors.push('GENOME_RECEIPT_MISMATCH');
  }
  if (!same(traits.receipt, receipt.traits)) {
    errors.push('TRAIT_RECEIPT_MISMATCH');
  }
  if (!same(mutation.receipt, receipt.mutation)) {
    errors.push('MUTATION_RECEIPT_MISMATCH');
  }
  if (!same(finalBirthState, receipt.finalBirthState)) {
    errors.push('FINAL_BIRTH_STATE_MISMATCH');
  }

  return {
    valid: errors.length === 0,
    errors,
    finalBirthState,
  };
};
