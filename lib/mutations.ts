import {
  AcquiredTrait,
  Infection,
  LifeHistoryEvent,
  MutationProposal,
  MutationProvenance,
  Specimen,
  TraitOriginType,
} from '../types';
import {
  addFossilizationScar,
  addInfectionSurvivedScar,
  addPromotionScar,
} from './scars';

export type InfectionDuration =
  | { mode: 'turns'; turns: number }
  | { mode: 'indefinite' };

export const MAX_ACTIVE_INFECTIONS = 3;

const byCreatedAtThenId = <T extends { createdAt: number; id: string }>(a: T, b: T): number =>
  a.createdAt - b.createdAt || a.id.localeCompare(b.id);

const cloneProvenance = (provenance: MutationProvenance): MutationProvenance => ({
  ...provenance,
  sourceMessageIds: [...provenance.sourceMessageIds],
  sourceArtifactIds: [...provenance.sourceArtifactIds],
});

const cloneInfection = (infection: Infection): Infection => ({
  ...infection,
  provenance: cloneProvenance(infection.provenance),
});

const cloneTrait = (trait: AcquiredTrait): AcquiredTrait => ({
  ...trait,
  provenance: cloneProvenance(trait.provenance),
});

const provenanceFromProposal = (
  specimen: Specimen,
  proposal: MutationProposal,
): MutationProvenance => ({
  specimenId: specimen.id,
  genomeId: specimen.currentGenome.id,
  sourceType: proposal.sourceType,
  sourceMessageIds: [...proposal.sourceMessageIds],
  sourceArtifactIds: [...proposal.sourceArtifactIds],
});

const makeHistoryEvent = (
  type: LifeHistoryEvent['type'],
  summary: string,
  mutationId: string,
  provenance: Pick<MutationProvenance, 'sourceMessageIds' | 'sourceArtifactIds'>,
): LifeHistoryEvent => ({
  id: crypto.randomUUID(),
  type,
  summary,
  mutationId,
  messageIds: [...provenance.sourceMessageIds],
  artifactIds: [...provenance.sourceArtifactIds],
  createdAt: Date.now(),
});

const validateTurns = (turns: number): number => {
  if (!Number.isInteger(turns) || turns < 1) {
    throw new Error('INVALID_INFECTION_DURATION');
  }
  return turns;
};

const requireProposalKind = (
  proposal: MutationProposal,
  kind: MutationProposal['kind'],
): void => {
  if (proposal.kind !== kind) throw new Error('MUTATION_KIND_MISMATCH');
};

const makeTrait = (
  specimen: Specimen,
  proposal: MutationProposal,
  originType: TraitOriginType,
): AcquiredTrait => ({
  id: crypto.randomUUID(),
  name: proposal.name,
  description: proposal.description,
  prompt: proposal.prompt,
  status: 'active',
  originType,
  provenance: provenanceFromProposal(specimen, proposal),
  createdAt: Date.now(),
});

const appendTraitWithHistory = (
  specimen: Specimen,
  trait: AcquiredTrait,
  prefixEvents: LifeHistoryEvent[] = [],
): Specimen => {
  const acquiredEvent = makeHistoryEvent(
    'trait-acquired',
    `Acquired trait: ${trait.name}`,
    trait.id,
    trait.provenance,
  );
  const now = Date.now();

  return {
    ...specimen,
    acquiredTraits: [...specimen.acquiredTraits.map(cloneTrait), cloneTrait(trait)],
    lifeHistory: [
      ...specimen.lifeHistory.map(event => ({
        ...event,
        messageIds: [...event.messageIds],
        artifactIds: [...event.artifactIds],
      })),
      ...prefixEvents,
      acquiredEvent,
    ],
    lastModified: now,
  };
};

export const startInfection = (
  specimen: Specimen,
  proposal: MutationProposal,
  duration: InfectionDuration,
): Specimen => {
  requireProposalKind(proposal, 'infection');

  if (specimen.infections.filter(item => item.status === 'active').length >= MAX_ACTIVE_INFECTIONS) {
    throw new Error('ACTIVE_INFECTION_LIMIT');
  }

  const now = Date.now();
  const infection: Infection = {
    id: crypto.randomUUID(),
    name: proposal.name,
    description: proposal.description,
    prompt: proposal.prompt,
    status: 'active',
    durationMode: duration.mode,
    ...(duration.mode === 'turns'
      ? {
          durationTurns: validateTurns(duration.turns),
          remainingTurns: validateTurns(duration.turns),
        }
      : {}),
    provenance: provenanceFromProposal(specimen, proposal),
    createdAt: now,
  };

  return {
    ...specimen,
    infections: [...specimen.infections.map(cloneInfection), infection],
    lifeHistory: [
      ...specimen.lifeHistory,
      makeHistoryEvent(
        'infection-started',
        `Started infection: ${infection.name}`,
        infection.id,
        infection.provenance,
      ),
    ],
    lastModified: now,
  };
};

export const removeInfection = (
  specimen: Specimen,
  infectionId: string,
  reason = 'removed manually',
): Specimen => {
  const infection = specimen.infections.find(item => item.id === infectionId);
  if (!infection) throw new Error('INFECTION_NOT_FOUND');
  if (infection.status !== 'active') throw new Error('INFECTION_NOT_ACTIVE');

  const now = Date.now();
  const endReason = reason.trim() || 'removed manually';
  const infections = specimen.infections.map(item =>
    item.id === infectionId
      ? {
          ...cloneInfection(item),
          status: 'removed' as const,
          endedAt: now,
          endReason,
        }
      : cloneInfection(item),
  );

  return {
    ...specimen,
    infections,
    lifeHistory: [
      ...specimen.lifeHistory,
      makeHistoryEvent(
        'infection-removed',
        `Removed infection: ${infection.name}`,
        infection.id,
        infection.provenance,
      ),
    ],
    lastModified: now,
  };
};

export const advanceSuccessfulTurn = (specimen: Specimen): Specimen => {
  const now = Date.now();
  const expiredEvents: LifeHistoryEvent[] = [];
  const expiredRecords: Array<{ infection: Infection; event: LifeHistoryEvent }> = [];

  const infections = specimen.infections.map(infection => {
    if (infection.status !== 'active' || infection.durationMode !== 'turns') {
      return cloneInfection(infection);
    }

    const current = infection.remainingTurns ?? infection.durationTurns ?? 0;
    const remainingTurns = Math.max(0, current - 1);

    if (remainingTurns === 0) {
      const event = makeHistoryEvent(
        'infection-expired',
        `Expired infection: ${infection.name}`,
        infection.id,
        infection.provenance,
      );
      expiredEvents.push(event);
      expiredRecords.push({ infection: cloneInfection(infection), event });
      return {
        ...cloneInfection(infection),
        status: 'expired' as const,
        remainingTurns: 0,
        endedAt: now,
        endReason: 'duration completed',
      };
    }

    return {
      ...cloneInfection(infection),
      remainingTurns,
    };
  });

  let next: Specimen = {
    ...specimen,
    infections,
    lifeHistory: [...specimen.lifeHistory, ...expiredEvents],
    lastModified: now,
  };

  for (const record of expiredRecords) {
    next = addInfectionSurvivedScar(next, record.infection, record.event.id, now);
  }

  return next;
};

export const acquireTrait = (
  specimen: Specimen,
  proposal: MutationProposal,
  originType: TraitOriginType,
): Specimen => {
  requireProposalKind(proposal, 'trait');
  return appendTraitWithHistory(specimen, makeTrait(specimen, proposal, originType));
};

export const retireTrait = (
  specimen: Specimen,
  traitId: string,
): Specimen => {
  const trait = specimen.acquiredTraits.find(item => item.id === traitId);
  if (!trait) throw new Error('TRAIT_NOT_FOUND');
  if (trait.status !== 'active') throw new Error('TRAIT_NOT_ACTIVE');

  const now = Date.now();
  const traits = specimen.acquiredTraits.map(item =>
    item.id === traitId
      ? {
          ...cloneTrait(item),
          status: 'retired' as const,
          retiredAt: now,
        }
      : cloneTrait(item),
  );

  return {
    ...specimen,
    acquiredTraits: traits,
    lifeHistory: [
      ...specimen.lifeHistory,
      makeHistoryEvent(
        'trait-retired',
        `Retired trait: ${trait.name}`,
        trait.id,
        trait.provenance,
      ),
    ],
    lastModified: now,
  };
};

export const promoteInfection = (
  specimen: Specimen,
  infectionId: string,
): Specimen => {
  const infection = specimen.infections.find(item => item.id === infectionId);
  if (!infection) throw new Error('INFECTION_NOT_FOUND');
  if (infection.status !== 'active') throw new Error('INFECTION_NOT_ACTIVE');

  const now = Date.now();
  const infections = specimen.infections.map(item =>
    item.id === infectionId
      ? {
          ...cloneInfection(item),
          status: 'promoted' as const,
          endedAt: now,
          endReason: 'promoted to acquired trait',
        }
      : cloneInfection(item),
  );

  const trait: AcquiredTrait = {
    id: crypto.randomUUID(),
    name: infection.name,
    description: infection.description,
    prompt: infection.prompt,
    status: 'active',
    originType: 'promoted-infection',
    provenance: cloneProvenance(infection.provenance),
    createdAt: now,
  };

  const promotedEvent = makeHistoryEvent(
    'infection-promoted',
    `Promoted infection to acquired trait: ${infection.name}`,
    infection.id,
    infection.provenance,
  );
  const acquiredEvent = makeHistoryEvent(
    'trait-acquired',
    `Acquired trait from infection: ${trait.name}`,
    trait.id,
    trait.provenance,
  );

  const next: Specimen = {
    ...specimen,
    infections,
    acquiredTraits: [...specimen.acquiredTraits.map(cloneTrait), trait],
    lifeHistory: [...specimen.lifeHistory, promotedEvent, acquiredEvent],
    lastModified: now,
  };

  return addPromotionScar(
    next,
    infection.id,
    trait.id,
    [promotedEvent.id, acquiredEvent.id],
    now,
  );
};

export const fossilizeAccident = (
  specimen: Specimen,
  proposal: MutationProposal,
): Specimen => {
  requireProposalKind(proposal, 'fossilized-accident');

  const trait = makeTrait(specimen, proposal, 'fossilized-accident');
  const fossilizedEvent = makeHistoryEvent(
    'accident-fossilized',
    `Fossilized observed behavior: ${trait.name}`,
    trait.id,
    trait.provenance,
  );

  const next = appendTraitWithHistory(specimen, trait, [fossilizedEvent]);
  const acquiredEvent = next.lifeHistory[next.lifeHistory.length - 1];

  return addFossilizationScar(
    next,
    trait.id,
    [fossilizedEvent.id, acquiredEvent.id],
  );
};

export const activeInfections = (specimen: Specimen): Infection[] =>
  specimen.infections
    .filter(infection => infection.status === 'active')
    .map(cloneInfection)
    .sort(byCreatedAtThenId);

export const activeTraits = (specimen: Specimen): AcquiredTrait[] =>
  specimen.acquiredTraits
    .filter(trait => trait.status === 'active')
    .map(cloneTrait)
    .sort(byCreatedAtThenId);


export const compileMutationRuntimeLayer = (
  traits: AcquiredTrait[],
  infections: Infection[],
): string => {
  const activeTraitBlocks = traits
    .filter(trait => trait.status === 'active')
    .map(cloneTrait)
    .sort(byCreatedAtThenId)
    .map(trait => [
      `--- TRAIT ${trait.id} :: ${trait.name} ---`,
      trait.prompt,
      `--- END TRAIT ${trait.id} ---`,
    ].join('\n'));

  const activeInfectionBlocks = infections
    .filter(infection => infection.status === 'active')
    .map(cloneInfection)
    .sort(byCreatedAtThenId)
    .map(infection => {
      const durationLabel = infection.durationMode === 'indefinite'
        ? 'INDEFINITE'
        : `${infection.remainingTurns ?? infection.durationTurns ?? 0} TURNS REMAINING`;

      return [
        `--- INFECTION ${infection.id} :: ${infection.name} :: ${durationLabel} ---`,
        infection.prompt,
        `--- END INFECTION ${infection.id} ---`,
      ].join('\n');
    });

  const layers: string[] = [];

  if (activeTraitBlocks.length > 0) {
    layers.push(`ACTIVE ACQUIRED TRAITS\n${activeTraitBlocks.join('\n\n')}`);
  }

  if (activeInfectionBlocks.length > 0) {
    layers.push(`ACTIVE TEMPORARY INFECTIONS\n${activeInfectionBlocks.join('\n\n')}`);
  }

  return layers.join('\n\n');
};
