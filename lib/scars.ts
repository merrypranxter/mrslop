import {
  Infection,
  LifeHistoryEvent,
  Scar,
  ScarKind,
  Specimen,
} from '../types';

type ExperiencedScarInput = Omit<Scar, 'id' | 'origin' | 'createdAt'>;

const cloneScar = (scar: Scar): Scar => ({
  ...scar,
  relatedEventIds: [...scar.relatedEventIds],
  relatedMutationIds: [...scar.relatedMutationIds],
  relatedCheckpointIds: [...scar.relatedCheckpointIds],
  messageIds: [...scar.messageIds],
  artifactIds: [...scar.artifactIds],
});

const cloneHistory = (event: LifeHistoryEvent): LifeHistoryEvent => ({
  ...event,
  messageIds: [...event.messageIds],
  artifactIds: [...event.artifactIds],
});

export const hasEquivalentScar = (
  specimen: Specimen,
  kind: ScarKind,
  relatedId: string,
): boolean => specimen.scars.some(scar =>
  scar.kind === kind && (
    scar.relatedEventIds.includes(relatedId) ||
    scar.relatedMutationIds.includes(relatedId) ||
    scar.relatedCheckpointIds.includes(relatedId)
  ));

export const addExperiencedScar = (
  specimen: Specimen,
  input: ExperiencedScarInput,
  now = Date.now(),
): Specimen => {
  const scarId = crypto.randomUUID();
  const historyEventId = crypto.randomUUID();
  const scar: Scar = {
    ...input,
    id: scarId,
    origin: 'experienced',
    createdAt: now,
    sourceSpecimenId: input.sourceSpecimenId ?? specimen.id,
    relatedEventIds: [...input.relatedEventIds, historyEventId],
    relatedMutationIds: [...input.relatedMutationIds],
    relatedCheckpointIds: [...input.relatedCheckpointIds],
    messageIds: [...input.messageIds],
    artifactIds: [...input.artifactIds],
  };
  const event: LifeHistoryEvent = {
    id: historyEventId,
    type: 'scar-acquired',
    summary: `Acquired scar: ${scar.name}`,
    scarId,
    relatedSpecimenId: specimen.id,
    messageIds: [...scar.messageIds],
    artifactIds: [...scar.artifactIds],
    createdAt: now,
  };

  return {
    ...specimen,
    scars: [...specimen.scars.map(cloneScar), scar],
    lifeHistory: [...specimen.lifeHistory.map(cloneHistory), event],
    lastModified: now,
  };
};

export const addInfectionSurvivedScar = (
  specimen: Specimen,
  infection: Infection,
  eventId: string,
  now = Date.now(),
): Specimen => {
  if (
    hasEquivalentScar(specimen, 'infection-survived', eventId) ||
    hasEquivalentScar(specimen, 'infection-survived', infection.id)
  ) {
    return specimen;
  }

  return addExperiencedScar(specimen, {
    name: `Survived ${infection.name}`,
    description: `Temporary infection “${infection.name}” ran to natural expiry.`,
    kind: 'infection-survived',
    sourceSpecimenId: specimen.id,
    relatedEventIds: [eventId],
    relatedMutationIds: [infection.id],
    relatedCheckpointIds: [],
    messageIds: [...infection.provenance.sourceMessageIds],
    artifactIds: [...infection.provenance.sourceArtifactIds],
  }, now);
};

export const addPromotionScar = (
  specimen: Specimen,
  infectionId: string,
  traitId: string,
  eventIds: string[],
  now = Date.now(),
): Specimen => {
  if (hasEquivalentScar(specimen, 'infection-promoted', infectionId)) return specimen;

  const infection = specimen.infections.find(item => item.id === infectionId);
  const trait = specimen.acquiredTraits.find(item => item.id === traitId);
  const label = infection?.name || trait?.name || 'temporary infection';
  const provenance = infection?.provenance ?? trait?.provenance;

  return addExperiencedScar(specimen, {
    name: `Promoted ${label}`,
    description: `Temporary infection “${label}” became a lasting acquired trait.`,
    kind: 'infection-promoted',
    sourceSpecimenId: specimen.id,
    relatedEventIds: [...eventIds],
    relatedMutationIds: [infectionId, traitId],
    relatedCheckpointIds: [],
    messageIds: [...(provenance?.sourceMessageIds ?? [])],
    artifactIds: [...(provenance?.sourceArtifactIds ?? [])],
  }, now);
};

export const addFossilizationScar = (
  specimen: Specimen,
  traitId: string,
  eventIds: string[],
  now = Date.now(),
): Specimen => {
  if (hasEquivalentScar(specimen, 'fossilized-accident', traitId)) return specimen;

  const trait = specimen.acquiredTraits.find(item => item.id === traitId);
  const label = trait?.name || 'observed behavior';

  return addExperiencedScar(specimen, {
    name: `Fossilized ${label}`,
    description: `Observed behavior “${label}” was preserved as a lasting acquired trait.`,
    kind: 'fossilized-accident',
    sourceSpecimenId: specimen.id,
    relatedEventIds: [...eventIds],
    relatedMutationIds: [traitId],
    relatedCheckpointIds: [],
    messageIds: [...(trait?.provenance.sourceMessageIds ?? [])],
    artifactIds: [...(trait?.provenance.sourceArtifactIds ?? [])],
  }, now);
};

const structuralSignature = (specimen: Specimen): string => {
  const components = specimen.currentGenome.components
    .filter(component => component.enabled)
    .map(component => component.id)
    .sort();
  const traits = specimen.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(trait => trait.id)
    .sort();
  const infections = specimen.infections
    .filter(infection => infection.status === 'active')
    .map(infection => [
      infection.id,
      infection.durationMode,
      infection.remainingTurns ?? '',
    ].join(':'))
    .sort();

  return JSON.stringify({
    genomeId: specimen.currentGenome.id,
    mode: specimen.currentGenome.mode,
    customSeed: specimen.currentGenome.customSeed ?? '',
    components,
    traits,
    infections,
  });
};

export const addCheckpointReversionScar = (
  before: Specimen,
  restored: Specimen,
  checkpointId: string,
  eventId: string,
  now = Date.now(),
): Specimen => {
  if (structuralSignature(before) === structuralSignature(restored)) return restored;
  if (hasEquivalentScar(restored, 'checkpoint-reversion', checkpointId)) return restored;

  const checkpoint = restored.checkpoints.find(item => item.id === checkpointId);
  const label = checkpoint?.reason || checkpointId;

  return addExperiencedScar(restored, {
    name: 'Checkpoint reversion',
    description: `Restored checkpoint “${label}”, reversing later specimen state.`,
    kind: 'checkpoint-reversion',
    sourceSpecimenId: restored.id,
    relatedEventIds: [eventId],
    relatedMutationIds: [],
    relatedCheckpointIds: [checkpointId],
    messageIds: [],
    artifactIds: [],
  }, now);
};

export const addGenomeChangeScar = (
  specimen: Specimen,
  previousGenomeId: string,
  nextGenomeId: string,
  eventId: string,
  now = Date.now(),
): Specimen => {
  if (previousGenomeId === nextGenomeId) return specimen;
  if (hasEquivalentScar(specimen, 'genome-change', eventId)) return specimen;

  return addExperiencedScar(specimen, {
    name: 'Genome changed',
    description: `Current genome changed from ${previousGenomeId} to ${nextGenomeId}.`,
    kind: 'genome-change',
    sourceSpecimenId: specimen.id,
    relatedEventIds: [eventId],
    relatedMutationIds: [previousGenomeId, nextGenomeId],
    relatedCheckpointIds: [],
    messageIds: [],
    artifactIds: [],
  }, now);
};
