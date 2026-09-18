import { describe, expect, it } from 'vitest';
import { MutationProposal } from '../types';
import { makeSpecimen } from '../services/specimenStore';
import {
  acquireTrait,
  activeInfections,
  activeTraits,
  advanceSuccessfulTurn,
  fossilizeAccident,
  MAX_ACTIVE_INFECTIONS,
  promoteInfection,
  removeInfection,
  retireTrait,
  startInfection,
} from '../lib/mutations';

const makeProposal = (overrides: Partial<MutationProposal> = {}): MutationProposal => ({
  id: 'proposal-1',
  kind: 'infection',
  name: 'Metric Vertigo',
  description: 'Temporarily use a bad ruler for conceptual distance.',
  prompt: 'Measure conceptual distance using a deliberately alien metric.',
  reason: 'The specimen is converging too quickly.',
  recommendedTurns: 3,
  sourceMessageIds: ['message-1'],
  sourceArtifactIds: [],
  sourceType: 'mr-slop',
  ...overrides,
});

const makeSpecimenFixture = () => makeSpecimen({
  id: 'genome-1',
  mode: 'stack',
  components: [],
}, 'Mutation Gremlin');

describe('mutation state engine', () => {
  it('starts a turn-limited infection with provenance and history', () => {
    const specimen = makeSpecimenFixture();
    const next = startInfection(specimen, makeProposal(), { mode: 'turns', turns: 3 });

    expect(specimen.infections).toEqual([]);
    expect(next.infections).toHaveLength(1);
    expect(next.infections[0]).toMatchObject({
      name: 'Metric Vertigo',
      status: 'active',
      durationMode: 'turns',
      durationTurns: 3,
      remainingTurns: 3,
    });
    expect(next.infections[0].provenance).toMatchObject({
      specimenId: specimen.id,
      genomeId: specimen.currentGenome.id,
      sourceType: 'mr-slop',
      sourceMessageIds: ['message-1'],
    });
    expect(next.lifeHistory.at(-1)?.type).toBe('infection-started');
  });

  it('expires a 1-turn infection after one successful accepted reply', () => {
    const specimen = makeSpecimenFixture();
    const infected = startInfection(specimen, makeProposal(), { mode: 'turns', turns: 1 });
    const advanced = advanceSuccessfulTurn(infected);

    expect(advanced.infections[0].status).toBe('expired');
    expect(advanced.infections[0].remainingTurns).toBe(0);
    expect(advanced.infections[0].endedAt).toEqual(expect.any(Number));
    expect(advanced.lifeHistory.at(-1)?.type).toBe('infection-expired');
    expect(infected.infections[0].status).toBe('active');
  });

  it('does not decrement indefinite infections', () => {
    const infected = startInfection(
      makeSpecimenFixture(),
      makeProposal(),
      { mode: 'indefinite' },
    );
    const advanced = advanceSuccessfulTurn(infected);

    expect(advanced.infections[0].status).toBe('active');
    expect(advanced.infections[0].durationMode).toBe('indefinite');
    expect(advanced.infections[0].remainingTurns).toBeUndefined();
    expect(advanced.lifeHistory.filter(event => event.type === 'infection-expired')).toHaveLength(0);
  });

  it('decrements every active turn-limited infection exactly once', () => {
    const first = startInfection(
      makeSpecimenFixture(),
      makeProposal({ id: 'p1', name: 'One' }),
      { mode: 'turns', turns: 3 },
    );
    const second = startInfection(
      first,
      makeProposal({ id: 'p2', name: 'Two' }),
      { mode: 'turns', turns: 2 },
    );

    const advanced = advanceSuccessfulTurn(second);
    expect(advanced.infections.map(item => item.remainingTurns)).toEqual([2, 1]);
  });

  it('manually removes an infection without deleting its historical record', () => {
    const infected = startInfection(
      makeSpecimenFixture(),
      makeProposal(),
      { mode: 'turns', turns: 3 },
    );
    const id = infected.infections[0].id;
    const removed = removeInfection(infected, id, 'user ended experiment');

    expect(removed.infections[0]).toMatchObject({
      id,
      status: 'removed',
      endReason: 'user ended experiment',
    });
    expect(removed.infections[0].endedAt).toEqual(expect.any(Number));
    expect(removed.lifeHistory.at(-1)?.type).toBe('infection-removed');
  });

  it('does not mutate the birth genome while acquiring a trait', () => {
    const specimen = makeSpecimenFixture();
    const birth = structuredClone(specimen.birthGenome);
    const next = acquireTrait(
      specimen,
      makeProposal({ kind: 'trait', id: 'trait-proposal' }),
      'explicit',
    );

    expect(next.birthGenome).toEqual(birth);
    expect(next.acquiredTraits).toHaveLength(1);
    expect(next.acquiredTraits[0]).toMatchObject({
      status: 'active',
      originType: 'explicit',
      name: 'Metric Vertigo',
    });
    expect(next.lifeHistory.at(-1)?.type).toBe('trait-acquired');
  });

  it('retires an acquired trait while preserving it in history', () => {
    const acquired = acquireTrait(
      makeSpecimenFixture(),
      makeProposal({ kind: 'trait' }),
      'mr-slop-proposal',
    );
    const id = acquired.acquiredTraits[0].id;
    const retired = retireTrait(acquired, id);

    expect(retired.acquiredTraits[0].status).toBe('retired');
    expect(retired.acquiredTraits[0].retiredAt).toEqual(expect.any(Number));
    expect(retired.lifeHistory.at(-1)?.type).toBe('trait-retired');
  });

  it('promotes an infection without deleting its historical record', () => {
    const infected = startInfection(
      makeSpecimenFixture(),
      makeProposal(),
      { mode: 'turns', turns: 3 },
    );
    const infectionId = infected.infections[0].id;
    const next = promoteInfection(infected, infectionId);

    expect(next.infections[0].status).toBe('promoted');
    expect(next.infections[0].endedAt).toEqual(expect.any(Number));
    expect(next.acquiredTraits[0].originType).toBe('promoted-infection');
    expect(next.acquiredTraits[0].prompt).toBe(infected.infections[0].prompt);
    expect(next.lifeHistory.map(event => event.type).slice(-2)).toEqual([
      'infection-promoted',
      'trait-acquired',
    ]);
  });

  it('fossilizes an observed accident with its source evidence', () => {
    const proposal = makeProposal({
      id: 'fossil-1',
      kind: 'fossilized-accident',
      name: 'Navigation Harmony',
      description: 'Translate harmony problems into navigation problems.',
      prompt: 'When harmony stalls, remap the problem as navigation through a strange space.',
      sourceType: 'conversation',
      sourceMessageIds: ['m7', 'm8'],
      sourceArtifactIds: ['a2'],
    });
    const next = fossilizeAccident(makeSpecimenFixture(), proposal);

    expect(next.acquiredTraits[0]).toMatchObject({
      originType: 'fossilized-accident',
      name: 'Navigation Harmony',
    });
    expect(next.acquiredTraits[0].provenance.sourceMessageIds).toEqual(['m7', 'm8']);
    expect(next.acquiredTraits[0].provenance.sourceArtifactIds).toEqual(['a2']);
    expect(next.lifeHistory.map(event => event.type).slice(-2)).toEqual([
      'accident-fossilized',
      'trait-acquired',
    ]);
  });

  it('returns only active infections and active traits', () => {
    const infected = startInfection(
      makeSpecimenFixture(),
      makeProposal(),
      { mode: 'turns', turns: 1 },
    );
    const expired = advanceSuccessfulTurn(infected);
    const acquired = acquireTrait(
      expired,
      makeProposal({ kind: 'trait', id: 'trait-2' }),
      'explicit',
    );
    const retired = retireTrait(acquired, acquired.acquiredTraits[0].id);

    expect(activeInfections(retired)).toEqual([]);
    expect(activeTraits(retired)).toEqual([]);
  });

  it('rejects a fourth active infection without changing the specimen', () => {
    expect(MAX_ACTIVE_INFECTIONS).toBe(3);
    let specimen = makeSpecimenFixture();

    for (const [id, name] of [['p1', 'One'], ['p2', 'Two'], ['p3', 'Three']]) {
      specimen = startInfection(
        specimen,
        makeProposal({ id, name }),
        { mode: 'indefinite' },
      );
    }

    const before = structuredClone(specimen);
    expect(() => startInfection(
      specimen,
      makeProposal({ id: 'p4', name: 'Four' }),
      { mode: 'indefinite' },
    )).toThrow('ACTIVE_INFECTION_LIMIT');
    expect(specimen).toEqual(before);
    expect(specimen.infections.filter(item => item.status === 'active')).toHaveLength(3);
  });

  it('frees an active infection slot after removal', () => {
    let specimen = makeSpecimenFixture();

    for (const [id, name] of [['p1', 'One'], ['p2', 'Two'], ['p3', 'Three']]) {
      specimen = startInfection(
        specimen,
        makeProposal({ id, name }),
        { mode: 'indefinite' },
      );
    }

    const removed = removeInfection(specimen, specimen.infections[0].id);
    expect(() => startInfection(
      removed,
      makeProposal({ id: 'p4', name: 'Four' }),
      { mode: 'indefinite' },
    )).not.toThrow();
  });

  it('sorts active infections and traits by createdAt then id', () => {
    const specimen = makeSpecimenFixture();
    const withRecords = {
      ...specimen,
      infections: [
        {
          id: 'c',
          name: 'C',
          description: 'C',
          prompt: 'C',
          status: 'active' as const,
          durationMode: 'indefinite' as const,
          provenance: {
            specimenId: specimen.id,
            genomeId: specimen.currentGenome.id,
            sourceType: 'user' as const,
            sourceMessageIds: [],
            sourceArtifactIds: [],
          },
          createdAt: 20,
        },
        {
          id: 'b',
          name: 'B',
          description: 'B',
          prompt: 'B',
          status: 'active' as const,
          durationMode: 'indefinite' as const,
          provenance: {
            specimenId: specimen.id,
            genomeId: specimen.currentGenome.id,
            sourceType: 'user' as const,
            sourceMessageIds: [],
            sourceArtifactIds: [],
          },
          createdAt: 10,
        },
        {
          id: 'a',
          name: 'A',
          description: 'A',
          prompt: 'A',
          status: 'active' as const,
          durationMode: 'indefinite' as const,
          provenance: {
            specimenId: specimen.id,
            genomeId: specimen.currentGenome.id,
            sourceType: 'user' as const,
            sourceMessageIds: [],
            sourceArtifactIds: [],
          },
          createdAt: 10,
        },
      ],
      acquiredTraits: [
        {
          id: 't-b',
          name: 'TB',
          description: 'TB',
          prompt: 'TB',
          status: 'active' as const,
          originType: 'explicit' as const,
          provenance: {
            specimenId: specimen.id,
            genomeId: specimen.currentGenome.id,
            sourceType: 'user' as const,
            sourceMessageIds: [],
            sourceArtifactIds: [],
          },
          createdAt: 20,
        },
        {
          id: 't-a',
          name: 'TA',
          description: 'TA',
          prompt: 'TA',
          status: 'active' as const,
          originType: 'explicit' as const,
          provenance: {
            specimenId: specimen.id,
            genomeId: specimen.currentGenome.id,
            sourceType: 'user' as const,
            sourceMessageIds: [],
            sourceArtifactIds: [],
          },
          createdAt: 10,
        },
      ],
    };

    expect(activeInfections(withRecords).map(item => item.id)).toEqual(['a', 'b', 'c']);
    expect(activeTraits(withRecords).map(item => item.id)).toEqual(['t-a', 't-b']);
  });

  it('throws when asked to operate on a missing infection or trait', () => {
    const specimen = makeSpecimenFixture();
    expect(() => removeInfection(specimen, 'missing')).toThrow('INFECTION_NOT_FOUND');
    expect(() => promoteInfection(specimen, 'missing')).toThrow('INFECTION_NOT_FOUND');
    expect(() => retireTrait(specimen, 'missing')).toThrow('TRAIT_NOT_FOUND');
  });
});
