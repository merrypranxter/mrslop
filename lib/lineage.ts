import { captureBirthBaseline } from '../services/specimenStore';
import {
  AcquiredTrait,
  Genome,
  Infection,
  LifeHistoryEvent,
  Role,
  Scar,
  Specimen,
} from '../types';

export interface ForkSpecimenResult {
  parent: Specimen;
  child: Specimen;
}

const cloneGenome = (genome: Genome): Genome => ({
  ...genome,
  components: genome.components.map(component => ({
    ...component,
    tags: [...component.tags],
    roleHints: [...component.roleHints],
  })),
});

const cloneProvenance = <T extends AcquiredTrait['provenance']>(provenance: T): T => ({
  ...provenance,
  sourceMessageIds: [...provenance.sourceMessageIds],
  sourceArtifactIds: [...provenance.sourceArtifactIds],
});

const cloneHistory = (event: LifeHistoryEvent): LifeHistoryEvent => ({
  ...event,
  ...(event.relatedSpecimenIds ? { relatedSpecimenIds: [...event.relatedSpecimenIds] } : {}),
  messageIds: [...event.messageIds],
  artifactIds: [...event.artifactIds],
});

const inheritedTrait = (
  parent: Specimen,
  trait: AcquiredTrait,
  now: number,
): AcquiredTrait => ({
  ...trait,
  id: crypto.randomUUID(),
  provenance: cloneProvenance(trait.provenance),
  inheritanceSources: [{
    specimenId: parent.id,
    recordId: trait.id,
    inheritedAt: now,
  }],
  ...(trait.inheritedSourceOriginTypes
    ? { inheritedSourceOriginTypes: [...trait.inheritedSourceOriginTypes] }
    : {}),
  ...(trait.supportingScarIdsAtBirth
    ? { supportingScarIdsAtBirth: [...trait.supportingScarIdsAtBirth] }
    : {}),
  ...(trait.birthVariation
    ? {
        birthVariation: {
          ...trait.birthVariation,
          before: { ...trait.birthVariation.before },
          after: { ...trait.birthVariation.after },
        },
      }
    : {}),
});

const inheritedInfection = (
  parent: Specimen,
  infection: Infection,
  now: number,
): Infection => ({
  ...infection,
  id: crypto.randomUUID(),
  provenance: cloneProvenance(infection.provenance),
  inheritanceSources: [{
    specimenId: parent.id,
    recordId: infection.id,
    inheritedAt: now,
  }],
});

const inheritedScar = (
  parent: Specimen,
  scar: Scar,
  now: number,
): Scar => ({
  ...scar,
  id: crypto.randomUUID(),
  origin: 'inherited',
  sourceSpecimenId: parent.id,
  sourceScarId: scar.id,
  inheritedAt: now,
  relatedEventIds: [...scar.relatedEventIds],
  relatedMutationIds: [...scar.relatedMutationIds],
  relatedCheckpointIds: [...scar.relatedCheckpointIds],
  messageIds: [...scar.messageIds],
  artifactIds: [...scar.artifactIds],
});

export const nextForkName = (parent: Specimen, specimens: Specimen[]): string => {
  const directChildren = specimens.filter(specimen =>
    specimen.lineage.kind === 'fork' &&
    specimen.lineage.parentSpecimenIds.length === 1 &&
    specimen.lineage.parentSpecimenIds[0] === parent.id);
  let index = directChildren.length + 1;
  let candidate = `${parent.name} / FORK ${index}`;

  while (directChildren.some(specimen => specimen.name === candidate)) {
    index += 1;
    candidate = `${parent.name} / FORK ${index}`;
  }

  return candidate;
};

export const forkSpecimen = (
  parent: Specimen,
  childName: string,
  now = Date.now(),
): ForkSpecimenResult => {
  if (parent.phase !== 'spawned') {
    throw new Error('CANNOT_FORK_BUILDING_SPECIMEN');
  }

  const childId = crypto.randomUUID();
  const parentForkEventId = crypto.randomUUID();

  const parentForkEvent: LifeHistoryEvent = {
    id: parentForkEventId,
    type: 'specimen-forked',
    summary: `Forked child specimen: ${childName.trim() || 'UNNAMED CHILD'}`,
    relatedSpecimenId: childId,
    relatedSpecimenIds: [childId],
    messageIds: [],
    artifactIds: [],
    createdAt: now,
  };

  const updatedParent: Specimen = {
    ...parent,
    birthGenome: cloneGenome(parent.birthGenome),
    currentGenome: cloneGenome(parent.currentGenome),
    messages: parent.messages.map(message => ({
      ...message,
      attachments: message.attachments?.map(attachment => ({ ...attachment })),
    })),
    artifacts: parent.artifacts.map(artifact => ({
      ...artifact,
      componentIds: [...artifact.componentIds],
    })),
    checkpoints: parent.checkpoints.map(checkpoint => ({
      ...checkpoint,
      genome: cloneGenome(checkpoint.genome),
      acquiredTraits: checkpoint.acquiredTraits.map(trait => ({
        ...trait,
        provenance: cloneProvenance(trait.provenance),
        ...(trait.inheritanceSources
          ? { inheritanceSources: trait.inheritanceSources.map(source => ({ ...source })) }
          : {}),
      })),
      infections: checkpoint.infections.map(infection => ({
        ...infection,
        provenance: cloneProvenance(infection.provenance),
        ...(infection.inheritanceSources
          ? { inheritanceSources: infection.inheritanceSources.map(source => ({ ...source })) }
          : {}),
      })),
    })),
    acquiredTraits: parent.acquiredTraits.map(trait => ({
      ...trait,
      provenance: cloneProvenance(trait.provenance),
      ...(trait.inheritanceSources
        ? { inheritanceSources: trait.inheritanceSources.map(source => ({ ...source })) }
        : {}),
    })),
    infections: parent.infections.map(infection => ({
      ...infection,
      provenance: cloneProvenance(infection.provenance),
      ...(infection.inheritanceSources
        ? { inheritanceSources: infection.inheritanceSources.map(source => ({ ...source })) }
        : {}),
    })),
    lifeHistory: [...parent.lifeHistory.map(cloneHistory), parentForkEvent],
    scars: parent.scars.map(scar => ({
      ...scar,
      relatedEventIds: [...scar.relatedEventIds],
      relatedMutationIds: [...scar.relatedMutationIds],
      relatedCheckpointIds: [...scar.relatedCheckpointIds],
      messageIds: [...scar.messageIds],
      artifactIds: [...scar.artifactIds],
    })),
    birthBaseline: {
      ...parent.birthBaseline,
      genome: cloneGenome(parent.birthBaseline.genome),
      activeTraitIds: [...parent.birthBaseline.activeTraitIds],
      activeInfectionIds: [...parent.birthBaseline.activeInfectionIds],
      inheritedScarIds: [...parent.birthBaseline.inheritedScarIds],
    },
    lineage: {
      ...parent.lineage,
      parentSpecimenIds: [...parent.lineage.parentSpecimenIds],
      rootSpecimenIds: [...parent.lineage.rootSpecimenIds],
    },
    lastModified: now,
  };

  const childTraits = parent.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(trait => inheritedTrait(parent, trait, now));

  const childInfections = parent.infections
    .filter(infection => infection.status === 'active')
    .map(infection => inheritedInfection(parent, infection, now));

  const childBirthEventId = crypto.randomUUID();
  const inheritedScars = parent.scars.map(item => inheritedScar(parent, item, now));

  const forkBirthScar: Scar = {
    id: crypto.randomUUID(),
    name: 'Born from a fork',
    description: `Forked from ${parent.name} at generation ${parent.lineage.generation + 1}.`,
    kind: 'fork-birth',
    origin: 'inherited',
    createdAt: now,
    sourceSpecimenId: parent.id,
    inheritedAt: now,
    relatedEventIds: [childBirthEventId],
    relatedMutationIds: [],
    relatedCheckpointIds: [],
    messageIds: [],
    artifactIds: [],
  };

  const preliminaryScars = [...inheritedScars, forkBirthScar];
  const scarEvents = preliminaryScars.map((scar): LifeHistoryEvent => ({
    id: crypto.randomUUID(),
    type: 'scar-inherited',
    summary: scar.kind === 'fork-birth'
      ? `Inherited ancestry scar from ${parent.name}: born from fork.`
      : `Inherited scar from ${parent.name}: ${scar.name}`,
    scarId: scar.id,
    relatedSpecimenId: parent.id,
    relatedSpecimenIds: [parent.id],
    messageIds: [],
    artifactIds: [],
    createdAt: now,
  }));

  const childScars = preliminaryScars.map((scar, index) => ({
    ...scar,
    relatedEventIds: [...scar.relatedEventIds, scarEvents[index].id],
  }));

  const childGenome = cloneGenome(parent.currentGenome);
  const childBirthGenome = cloneGenome(parent.currentGenome);

  const childBirthEvent: LifeHistoryEvent = {
    id: childBirthEventId,
    type: 'specimen-born-from-fork',
    summary: `Born from fork of ${parent.name}.`,
    relatedSpecimenId: parent.id,
    relatedSpecimenIds: [parent.id],
    messageIds: [],
    artifactIds: [],
    createdAt: now,
  };

  const name = childName.trim() || `${parent.name} / FORK`;
  const childMessage = {
    id: crypto.randomUUID(),
    role: Role.SYSTEM,
    content: [
      `Forked from ${parent.name} at generation ${parent.lineage.generation + 1}.`,
      `Inherited current genome, ${childTraits.length} active acquired traits, ${childInfections.length} active infection${childInfections.length === 1 ? '' : 's'}, and ${childScars.length} ancestry scars.`,
      'This specimen starts a fresh conversation from that inherited state.',
    ].join(' '),
    timestamp: now,
  };

  const childShell = {
    acquiredTraits: childTraits,
    infections: childInfections,
    scars: childScars,
  };

  const child: Specimen = {
    schemaVersion: 4,
    id: childId,
    name,
    phase: 'spawned',
    birthGenome: childBirthGenome,
    currentGenome: childGenome,
    messages: [childMessage],
    artifacts: [],
    checkpoints: [],
    acquiredTraits: childTraits,
    infections: childInfections,
    lifeHistory: [childBirthEvent, ...scarEvents],
    scars: childScars,
    birthBaseline: captureBirthBaseline(childShell, childBirthGenome, 'fork-v4', now),
    lineage: {
      kind: 'fork',
      parentSpecimenIds: [parent.id],
      rootSpecimenIds: [...parent.lineage.rootSpecimenIds],
      generation: parent.lineage.generation + 1,
      forkedAt: now,
      forkSourceEventId: parentForkEventId,
      forkSourceGenomeId: parent.currentGenome.id,
      source: 'fork-v4',
    },
    trajectory: null,
    controllerState: null,
    metrics: null,
    createdAt: now,
    lastModified: now,
  };

  return {
    parent: updatedParent,
    child,
  };
};
