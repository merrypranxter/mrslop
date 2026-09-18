import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  send: vi.fn(),
}));

vi.mock('../services/geminiService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/geminiService')>();
  return { ...actual, sendMrSlopMessage: modelMocks.send };
});

import MrSlopTerminal from '../components/MrSlopTerminal';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createGenome } from '../lib/genome';
import { acquireTrait, startInfection } from '../lib/mutations';
import { checkpointSpecimen, makeSpecimen } from '../services/specimenStore';
import { MutationProposal, Specimen } from '../types';

const infectionProposal: MutationProposal = {
  id: 'proposal-infection',
  kind: 'infection',
  name: 'Metric Vertigo',
  description: 'Change distance rules temporarily.',
  prompt: 'Treat musical distance as non-Euclidean.',
  reason: 'The current specimen is converging too quickly.',
  recommendedTurns: 5,
  sourceMessageIds: ['m-source'],
  sourceArtifactIds: [],
  sourceType: 'mr-slop',
};

const fossilProposal: MutationProposal = {
  id: 'proposal-fossil',
  kind: 'fossilized-accident',
  name: 'Navigation Harmony',
  description: 'Turn harmony problems into navigation problems.',
  prompt: 'When harmony stalls, remap it as navigation through a strange space.',
  reason: 'That accidental behavior was useful.',
  sourceMessageIds: ['m7'],
  sourceArtifactIds: ['a2'],
  sourceType: 'conversation',
};

const traitProposal: MutationProposal = {
  id: 'proposal-trait',
  kind: 'trait',
  name: 'Wrong Ruler Habit',
  description: 'Keep using an alien metric as a lasting habit.',
  prompt: 'Prefer alien distance metrics when choosing conceptual neighbors.',
  reason: 'It improved the outputs.',
  sourceMessageIds: ['m9'],
  sourceArtifactIds: [],
  sourceType: 'user',
};

const spawnedSpecimen = (): Specimen =>
  makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), 'Mutation Test Slop');

const sendText = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
};

const latestSpecimen = (onChange: ReturnType<typeof vi.fn>): Specimen =>
  onChange.mock.calls.at(-1)?.[0] as Specimen;

describe('Mr. Slop mutation UI and lifecycle', () => {
  beforeEach(() => {
    modelMocks.send.mockReset();
  });

  it('starts a proposed temporary infection without changing birthGenome', async () => {
    modelMocks.send.mockResolvedValue({ text: 'Try this.', mutationProposal: infectionProposal });
    const specimen = spawnedSpecimen();
    const birth = structuredClone(specimen.birthGenome);
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('fuck with yourself');

    const tryButton = await screen.findByRole('button', { name: /try for 5 turns/i });
    fireEvent.click(tryButton);

    await waitFor(() => {
      const next = latestSpecimen(onChange);
      expect(next.infections.some(item => item.status === 'active' && item.remainingTurns === 5)).toBe(true);
      expect(next.birthGenome).toEqual(birth);
    });
  });

  it('can start an indefinite infection from the same mutation card', async () => {
    modelMocks.send.mockResolvedValue({ text: 'Try this.', mutationProposal: infectionProposal });
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={spawnedSpecimen()} onChange={onChange} />);

    sendText('give me a temporary infection');

    fireEvent.click(await screen.findByRole('button', { name: /keep on until i remove it/i }));

    await waitFor(() => {
      expect(latestSpecimen(onChange).infections[0]).toMatchObject({
        status: 'active',
        durationMode: 'indefinite',
      });
    });
  });

  it('does not decrement infection on a failed model turn', async () => {
    modelMocks.send.mockRejectedValue(new Error('boom'));
    const specimen = startInfection(
      spawnedSpecimen(),
      infectionProposal,
      { mode: 'turns', turns: 3 },
    );
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('hello');

    await screen.findByRole('button', { name: /retry/i });
    expect(latestSpecimen(onChange).infections[0].remainingTurns).toBe(3);
  });

  it('decrements exactly once after a successful accepted reply', async () => {
    modelMocks.send.mockResolvedValue({ text: 'done' });
    const specimen = startInfection(
      spawnedSpecimen(),
      infectionProposal,
      { mode: 'turns', turns: 3 },
    );
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('hello');

    await screen.findByText('done');
    await waitFor(() => {
      expect(latestSpecimen(onChange).infections[0].remainingTurns).toBe(2);
    });
  });

  it('expires a one-turn infection only after the successful reply is accepted', async () => {
    modelMocks.send.mockResolvedValue({ text: 'last infected reply' });
    const specimen = startInfection(
      spawnedSpecimen(),
      infectionProposal,
      { mode: 'turns', turns: 1 },
    );
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('use it once');

    await screen.findByText('last infected reply');
    await waitFor(() => {
      const next = latestSpecimen(onChange);
      expect(next.infections[0]).toMatchObject({ status: 'expired', remainingTurns: 0 });
      expect(next.lifeHistory.at(-1)?.type).toBe('infection-expired');
    });
  });

  it('routes fossilization through blocking structural approval and checkpoints on approval', async () => {
    modelMocks.send.mockResolvedValue({
      text: 'That behavior is worth keeping.',
      mutationAction: { type: 'fossilize-accident', proposal: fossilProposal },
    });
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={spawnedSpecimen()} onChange={onChange} />);

    sendText('keep that shit');

    await screen.findByText(/this changes the specimen/i);
    expect(latestSpecimen(onChange).acquiredTraits).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /fossilize it/i }));

    await waitFor(() => {
      const next = latestSpecimen(onChange);
      expect(next.checkpoints).toHaveLength(1);
      expect(next.acquiredTraits[0]).toMatchObject({
        name: 'Navigation Harmony',
        originType: 'fossilized-accident',
      });
    });
  });

  it('manually removes an active infection from the compact mutation status', async () => {
    const specimen = startInfection(
      spawnedSpecimen(),
      infectionProposal,
      { mode: 'turns', turns: 5 },
    );
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /mutation status/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove metric vertigo/i }));

    await waitFor(() => {
      expect(latestSpecimen(onChange).infections[0].status).toBe('removed');
    });
  });

  it('promotes an infection through explicit structural approval', async () => {
    const specimen = startInfection(
      spawnedSpecimen(),
      infectionProposal,
      { mode: 'turns', turns: 5 },
    );
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /mutation status/i }));
    fireEvent.click(screen.getByRole('button', { name: /keep metric vertigo as trait/i }));

    await screen.findByText(/this changes the specimen/i);
    expect(latestSpecimen(onChange).acquiredTraits).toHaveLength(0);
    fireEvent.click(screen.getByRole('button', { name: /keep as trait/i }));

    await waitFor(() => {
      const next = latestSpecimen(onChange);
      expect(next.infections[0].status).toBe('promoted');
      expect(next.acquiredTraits[0].originType).toBe('promoted-infection');
      expect(next.checkpoints).toHaveLength(1);
    });
  });

  it('retires an acquired trait through explicit structural approval', async () => {
    const specimen = acquireTrait(spawnedSpecimen(), traitProposal, 'explicit');
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    fireEvent.click(screen.getByRole('button', { name: /mutation status/i }));
    fireEvent.click(screen.getByRole('button', { name: /retire wrong ruler habit/i }));

    await screen.findByText(/this changes the specimen/i);
    fireEvent.click(screen.getByRole('button', { name: /retire trait/i }));

    await waitFor(() => {
      const next = latestSpecimen(onChange);
      expect(next.acquiredTraits[0].status).toBe('retired');
      expect(next.checkpoints).toHaveLength(1);
    });
  });

  it('restores a named checkpoint through blocking approval', async () => {
    const base = spawnedSpecimen();
    const checkpointed = checkpointSpecimen(base, 'known good');
    const infected = startInfection(
      checkpointed,
      infectionProposal,
      { mode: 'indefinite' },
    );
    const target = checkpointed.checkpoints[0];
    modelMocks.send.mockResolvedValue({
      text: 'I can roll that back.',
      mutationAction: { type: 'restore-checkpoint', targetId: target.id },
    });
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={infected} onChange={onChange} />);

    sendText('undo that shit');

    await screen.findByText(/this changes the specimen/i);
    fireEvent.click(screen.getByRole('button', { name: /restore checkpoint/i }));

    await waitFor(() => {
      const next = latestSpecimen(onChange);
      expect(next.infections).toEqual([]);
      expect(next.lifeHistory.at(-1)?.type).toBe('checkpoint-restored');
      expect(next.checkpoints.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('offers real active infections as choices when undo target is ambiguous', async () => {
    const one = startInfection(
      spawnedSpecimen(),
      { ...infectionProposal, id: 'p1', name: 'Metric Vertigo' },
      { mode: 'indefinite' },
    );
    const two = startInfection(
      one,
      { ...infectionProposal, id: 'p2', name: 'Rhythmic Gravity' },
      { mode: 'indefinite' },
    );
    modelMocks.send.mockResolvedValue({
      text: 'Which infection do you mean?',
      mutationAction: { type: 'remove-infection' },
    });
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={two} onChange={onChange} />);

    sendText('undo that shit');

    expect(await screen.findByRole('button', { name: /remove metric vertigo/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove rhythmic gravity/i })).toBeInTheDocument();
    expect(latestSpecimen(onChange).infections.filter(item => item.status === 'active')).toHaveLength(2);
  });
});
