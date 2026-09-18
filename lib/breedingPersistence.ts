import type { LifeHistoryEvent, Specimen } from '../types';
import type { BreedingPreview } from './breeding';
import { breedingStateHash } from './breedingState';
import { canonicalParentIds } from './geneticsRandom';
import { saveSpecimens } from '../services/specimenStore';

export interface CommitBreedingPreviewOptions {
  now?: number;
  idFactory?: () => string;
  save?: (specimens: Specimen[]) => Promise<void>;
}

export interface CommitBreedingPreviewResult {
  status: 'committed' | 'existing';
  specimens: Specimen[];
  child: Specimen;
}

const cloneSpecimen = (specimen: Specimen): Specimen =>
  structuredClone(specimen);

const findCommittedChild = (
  specimens: Specimen[],
  idempotencyKey: string,
): Specimen | undefined =>
  specimens.find(specimen =>
    specimen.lineage.kind === 'bred' &&
    specimen.geneticsReceipt?.idempotencyKey === idempotencyKey);

const parentStateHashes = (
  parentA: Specimen,
  parentB: Specimen,
): [string, string] => {
  const ids = canonicalParentIds(parentA.id, parentB.id);
  const first = parentA.id === ids[0] ? parentA : parentB;
  const second = parentA.id === ids[0] ? parentB : parentA;
  return [
    breedingStateHash(first),
    breedingStateHash(second),
  ];
};

const offspringEvent = (
  parent: Specimen,
  coParent: Specimen,
  child: Specimen,
  preview: BreedingPreview,
  now: number,
  idFactory: () => string,
): LifeHistoryEvent => ({
  id: idFactory(),
  type: 'specimen-offspring-bred',
  summary: `${parent.name} and ${coParent.name} bred child specimen ${child.name}.`,
  relatedSpecimenId: child.id,
  relatedSpecimenIds: [child.id, coParent.id],
  geneticsReceiptId: preview.receipt.id,
  breedingSeed: preview.receipt.breedingSeed,
  messageIds: [],
  artifactIds: [],
  createdAt: now,
});

const withOffspringEvent = (
  parent: Specimen,
  coParent: Specimen,
  child: Specimen,
  preview: BreedingPreview,
  now: number,
  idFactory: () => string,
): Specimen => {
  const copy = cloneSpecimen(parent);
  copy.lifeHistory = [
    ...copy.lifeHistory,
    offspringEvent(parent, coParent, child, preview, now, idFactory),
  ];
  copy.lastModified = now;
  return copy;
};

const committedChild = (
  preview: BreedingPreview,
  now: number,
): Specimen => {
  const child = cloneSpecimen(preview.child);
  const receipt = structuredClone(preview.receipt);
  receipt.persistedAt = now;
  child.geneticsReceipt = receipt;
  child.lastModified = now;
  return child;
};

export const commitBreedingPreview = async (
  specimens: Specimen[],
  preview: BreedingPreview,
  options: CommitBreedingPreviewOptions = {},
): Promise<CommitBreedingPreviewResult> => {
  const existing = findCommittedChild(
    specimens,
    preview.receipt.idempotencyKey,
  );

  if (existing) {
    return {
      status: 'existing',
      specimens,
      child: existing,
    };
  }

  const [canonicalAId, canonicalBId] = preview.receipt.canonicalParentIds;
  const parentA = specimens.find(specimen => specimen.id === canonicalAId);
  const parentB = specimens.find(specimen => specimen.id === canonicalBId);

  if (!parentA || !parentB) {
    throw new Error('BREEDING_PARENT_NOT_FOUND');
  }

  const currentHashes = parentStateHashes(parentA, parentB);
  const expectedHashes = preview.receipt.parentStateHashes;

  if (
    currentHashes[0] !== expectedHashes[0] ||
    currentHashes[1] !== expectedHashes[1]
  ) {
    throw new Error('BREEDING_PREVIEW_STALE');
  }

  const now = options.now ?? Date.now();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const save = options.save ?? saveSpecimens;
  const child = committedChild(preview, now);

  const updatedA = withOffspringEvent(
    parentA,
    parentB,
    child,
    preview,
    now,
    idFactory,
  );
  const updatedB = withOffspringEvent(
    parentB,
    parentA,
    child,
    preview,
    now,
    idFactory,
  );

  const nextSpecimens = specimens.map(specimen => {
    if (specimen.id === updatedA.id) return updatedA;
    if (specimen.id === updatedB.id) return updatedB;
    return cloneSpecimen(specimen);
  });

  nextSpecimens.push(child);

  await save(nextSpecimens);

  return {
    status: 'committed',
    specimens: nextSpecimens,
    child,
  };
};
