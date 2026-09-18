import { describe, expect, it } from 'vitest';
import { assembleSystemInstruction } from '../lib/kernel';
import {
  advanceSuccessfulTurn,
  fossilizeAccident,
  promoteInfection,
  startInfection,
  acquireTrait,
} from '../lib/mutations';
import {
  addGenomeChangeScar,
  addInfectionSurvivedScar,
} from '../lib/scars';
import {
  checkpointSpecimen,
  makeSpecimen,
  restoreCheckpoint,
} from '../services/specimenStore';
import { Genome, MutationProposal } from '../types';

const genome: Genome = {
  id: 'g-scar',
  mode: 'stack',
  components: [],
};

const infectionProposal: MutationProposal = {
  id: 'p-infection',
  kind: 'infection',
  name: 'Metric Vertigo',
  description: 'Use a wrong ruler temporarily.',
  prompt: 'Measure distance with an alien metric.',
  reason: 'Experiment.',
  recommendedTurns: 1,
  sourceMessageIds: ['m1'],
  sourceArtifactIds: ['a1'],
  sourceType: 'conversation',
};

const fossilProposal: MutationProposal = {
  id: 'p-fossil',
  kind: 'fossilized-accident',
  name: 'Navigation Harmony',
  description: 'Harmony unexpectedly behaved like navigation.',
  prompt: 'When harmony stalls, remap it as navigation.',
  reason: 'Useful accident.',
  sourceMessageIds: ['m2'],
  sourceArtifactIds: ['a2'],
  sourceType: 'conversation',
};

const traitProposal: MutationProposal = {
  id: 'p-trait',
  kind: 'trait',
  name: 'Lasting Wobble',
  description: 'Keep a lasting wobble.',
  prompt: 'Preserve the wobble.',
  reason: 'Useful.',
  sourceMessageIds: [],
  sourceArtifactIds: [],
  sourceType: 'user',
};

describe('specimen scars', () => {
  it('adds an experienced scar when a limited infection reaches natural expiry', () => {
    const infected = startInfection(
      makeSpecimen(genome, 'SCAR SLOP'),
      infectionProposal,
      { mode: 'turns', turns: 1 },
    );

    const next = advanceSuccessfulTurn(infected);

    expect(next.infections[0].status).toBe('expired');
    expect(next.scars).toContainEqual(expect.objectContaining({
      kind: 'infection-survived',
      origin: 'experienced',
      relatedMutationIds: [next.infections[0].id],
      messageIds: ['m1'],
      artifactIds: ['a1'],
    }));
    const scar = next.scars.find(item => item.kind === 'infection-survived');
    expect(next.lifeHistory).toContainEqual(expect.objectContaining({
      type: 'scar-acquired',
      scarId: scar?.id,
    }));
    expect(next.lifeHistory.some(event => event.type === 'infection-expired')).toBe(true);
  });

  it('adds one promotion scar tied to promotion and trait-acquisition events', () => {
    const infected = startInfection(
      makeSpecimen(genome, 'PROMOTION SLOP'),
      infectionProposal,
      { mode: 'turns', turns: 3 },
    );

    const promoted = promoteInfection(infected, infected.infections[0].id);

    expect(promoted.scars.filter(item => item.kind === 'infection-promoted')).toHaveLength(1);
    const scar = promoted.scars.find(item => item.kind === 'infection-promoted')!;
    expect(scar.relatedMutationIds).toContain(infected.infections[0].id);
    expect(scar.relatedMutationIds).toContain(promoted.acquiredTraits[0].id);
    const sourceEventIds = promoted.lifeHistory
      .filter(event => event.type === 'infection-promoted' || event.type === 'trait-acquired')
      .map(event => event.id);
    expect(scar.relatedEventIds).toEqual(expect.arrayContaining(sourceEventIds));
  });

  it('fossilizes observed behavior as a trait and a historical scar', () => {
    const fossilized = fossilizeAccident(makeSpecimen(genome, 'FOSSIL SLOP'), fossilProposal);

    expect(fossilized.acquiredTraits[0].originType).toBe('fossilized-accident');
    expect(fossilized.scars).toContainEqual(expect.objectContaining({
      kind: 'fossilized-accident',
      origin: 'experienced',
      messageIds: ['m2'],
      artifactIds: ['a2'],
    }));
  });

  it('does not compile scars into runtime prompt layers', () => {
    const fossilized = fossilizeAccident(makeSpecimen(genome, 'PROMPT SLOP'), fossilProposal);
    const scar = fossilized.scars.find(item => item.kind === 'fossilized-accident')!;

    const instruction = assembleSystemInstruction({
      phase: 'spawned',
      catalogIndex: '',
      genome: fossilized.currentGenome,
      acquiredTraits: [],
      infections: [],
      specimenState: 'STATE_ONLY',
    });

    expect(instruction).toContain('STATE_ONLY');
    expect(instruction).not.toContain(scar.description);
    expect(instruction).not.toContain(scar.name);
  });

  it('preserves old scars across checkpoint restore and adds a reversion scar when structural state changes', () => {
    const root = makeSpecimen(genome, 'RESTORE SCAR SLOP');
    const checkpointed = checkpointSpecimen(root, 'before lasting trait');
    const changed = acquireTrait(checkpointed, traitProposal, 'explicit');
    const withExistingScar = addGenomeChangeScar(
      changed,
      'g-old',
      'g-new',
      'event-genome',
      50,
    );

    const restored = restoreCheckpoint(withExistingScar, checkpointed.checkpoints[0].id);

    expect(restored.acquiredTraits).toEqual([]);
    expect(restored.scars.some(item => item.kind === 'genome-change')).toBe(true);
    expect(restored.scars.some(item => item.kind === 'checkpoint-reversion')).toBe(true);
    expect(restored.lifeHistory.some(event => event.type === 'checkpoint-restored')).toBe(true);
  });

  it('does not duplicate an automatic scar for the same source event', () => {
    const infected = startInfection(
      makeSpecimen(genome, 'DEDUPE SLOP'),
      infectionProposal,
      { mode: 'turns', turns: 1 },
    );
    const infection = infected.infections[0];

    const once = addInfectionSurvivedScar(infected, infection, 'expiry-event', 100);
    const twice = addInfectionSurvivedScar(once, infection, 'expiry-event', 100);

    expect(twice.scars.filter(item => item.kind === 'infection-survived')).toHaveLength(1);
    expect(twice.lifeHistory.filter(event => event.type === 'scar-acquired')).toHaveLength(1);
  });
});
