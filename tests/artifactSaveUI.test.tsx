import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const modelMocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../services/geminiService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/geminiService')>();
  return { ...actual, sendMrSlopMessage: modelMocks.send };
});

import MrSlopTerminal from '../components/MrSlopTerminal';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createGenome } from '../lib/genome';
import { makeSpecimen } from '../services/specimenStore';
import { Specimen } from '../types';

describe('SAVE ARTIFACT', () => {
  beforeEach(() => modelMocks.send.mockReset());

  it('saves a Mr. Slop reply with its message and genome provenance', async () => {
    modelMocks.send.mockResolvedValue({ text: 'Make rhythm and harmony disagree about distance.' });
    const specimen = makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), 'Artifact Test');
    const onChange = vi.fn();

    render(<MrSlopTerminal specimen={specimen} onChange={onChange} />);

    fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), { target: { value: 'give me a thing' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await screen.findByText('Make rhythm and harmony disagree about distance.');
    const save = screen.getByRole('button', { name: /save artifact/i });
    fireEvent.click(save);

    await waitFor(() => {
      const next = onChange.mock.calls.at(-1)?.[0] as Specimen;
      expect(next.artifacts).toHaveLength(1);
      expect(next.artifacts[0].content).toBe('Make rhythm and harmony disagree about distance.');
      expect(next.artifacts[0].messageId).toBeTruthy();
      expect(next.artifacts[0].componentIds).toEqual(['tm-01']);
    });
  });
});
