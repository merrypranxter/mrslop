import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({
  send: vi.fn(),
  fuse: vi.fn(),
}));

vi.mock('../services/geminiService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/geminiService')>();
  return { ...actual, sendMrSlopMessage: modelMocks.send };
});

vi.mock('../services/kernelCompiler', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/kernelCompiler')>();
  return { ...actual, compileFuseGenome: modelMocks.fuse };
});

import MrSlopTerminal from '../components/MrSlopTerminal';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createGenome } from '../lib/genome';
import { makeSpecimen } from '../services/specimenStore';
import { Specimen } from '../types';

const spawnedSpecimen = (): Specimen =>
  makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), 'Test Slop');

const sendText = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
};

describe('MrSlopTerminal', () => {
  beforeEach(() => {
    modelMocks.send.mockReset();
    modelMocks.fuse.mockReset();
  });

  it('uses exactly one model call for an ordinary conversational turn', async () => {
    modelMocks.send.mockResolvedValue({ text: 'Yep. I have a gross little idea.' });
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={spawnedSpecimen()} onChange={onChange} />);

    sendText('make it weirder');

    await screen.findByText('Yep. I have a gross little idea.');
    expect(modelMocks.send).toHaveBeenCalledTimes(1);
  });

  it('renders a returned choice card without changing the genome', async () => {
    modelMocks.send.mockResolvedValue({
      text: 'Three directions.',
      uiEvent: {
        type: 'choice-card',
        id: 'choice-1',
        title: 'PICK A DOOR',
        options: [
          { id: 'door-a', label: 'ALIEN RULER', description: 'Change conceptual distance.' },
        ],
      },
    });
    const specimen = spawnedSpecimen();
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('give me options');

    await screen.findByRole('button', { name: /alien ruler/i });
    const lastUpdate = onChange.mock.calls.at(-1)?.[0] as Specimen;
    expect(lastUpdate.currentGenome.id).toBe(specimen.currentGenome.id);
    expect(lastUpdate.currentGenome.components.map(component => component.id)).toEqual(['tm-01']);
  });

  it('opens a structural decision and waits without mutating', async () => {
    modelMocks.send.mockResolvedValue({
      text: 'This would change the specimen.',
      uiEvent: {
        type: 'structural-decision',
        id: 'decision-1',
        title: 'MUTATION OPPORTUNITY',
        reason: 'Adding Alien Distance Metrics changes the active genome.',
        recommendation: 'Add it.',
        options: [
          {
            id: 'add-metric',
            label: 'ADD ALIEN METRIC',
            description: 'Install the metric mind.',
            componentIds: ['tm-01', 'tm-15'],
            mode: 'stack',
          },
        ],
      },
    });
    const specimen = spawnedSpecimen();
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('what can we mutate?');

    await screen.findByText(/why this opened/i);
    const lastBeforeApproval = onChange.mock.calls.at(-1)?.[0] as Specimen;
    expect(lastBeforeApproval.currentGenome.components.map(component => component.id)).toEqual(['tm-01']);
  });

  it('checkpoints before applying an approved structural change', async () => {
    modelMocks.send.mockResolvedValue({
      text: 'Mutation available.',
      uiEvent: {
        type: 'structural-decision',
        id: 'decision-1',
        title: 'MUTATION OPPORTUNITY',
        reason: 'This changes the genome.',
        options: [
          {
            id: 'apply',
            label: 'ADD ALIEN METRIC',
            description: 'Install it.',
            componentIds: ['tm-01', 'tm-15'],
            mode: 'stack',
          },
        ],
      },
    });
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={spawnedSpecimen()} onChange={onChange} />);

    sendText('mutate');
    const apply = await screen.findByRole('button', { name: /add alien metric/i });
    fireEvent.click(apply);

    await waitFor(() => {
      const lastUpdate = onChange.mock.calls.at(-1)?.[0] as Specimen;
      expect(lastUpdate.checkpoints).toHaveLength(1);
      expect(lastUpdate.currentGenome.components.map(component => component.id)).toEqual(['tm-01', 'tm-15']);
    });
  });

  it('keeps a failed user turn visible and offers retry without corrupting the genome', async () => {
    modelMocks.send.mockRejectedValueOnce(new Error('network exploded'));
    const specimen = spawnedSpecimen();
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    sendText('do the thing');

    expect(await screen.findByText('do the thing')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    const lastUpdate = onChange.mock.calls.at(-1)?.[0] as Specimen;
    expect(lastUpdate.currentGenome.id).toBe(specimen.currentGenome.id);
    expect(lastUpdate.currentGenome.components.map(component => component.id)).toEqual(['tm-01']);
  });

  it('lets a building specimen explicitly accept a proposed genome before spawning', async () => {
    modelMocks.send.mockResolvedValue({
      text: 'I would build myself like this.',
      proposedGenome: { componentIds: ['tm-15', 'separated-jurisdictions'], mode: 'stack' },
    });
    const empty = makeSpecimen({ id: 'empty', mode: 'stack', components: [] }, 'Unformed', 'building');
    const onChange = vi.fn();
    render(<MrSlopTerminal specimen={empty} onChange={onChange} />);

    sendText('I want musical systems arguing over different jobs');

    const build = await screen.findByRole('button', { name: /build this/i });
    let beforeClick = onChange.mock.calls.at(-1)?.[0] as Specimen;
    expect(beforeClick.phase).toBe('building');

    fireEvent.click(build);

    await waitFor(() => {
      const lastUpdate = onChange.mock.calls.at(-1)?.[0] as Specimen;
      expect(lastUpdate.phase).toBe('spawned');
      expect(lastUpdate.currentGenome.components.map(component => component.id)).toEqual([
        'tm-15',
        'separated-jurisdictions',
      ]);
    });
  });
});
