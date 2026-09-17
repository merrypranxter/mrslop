import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));

vi.mock('../services/geminiService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/geminiService')>();
  return { ...actual, sendMrSlopMessage: mocks.send };
});

import MrSlopTerminal from '../components/MrSlopTerminal';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createGenome } from '../lib/genome';
import { makeSpecimen } from '../services/specimenStore';

describe('MrSlopTerminal transport errors', () => {
  it('shows the useful server error instead of only saying the turn failed', async () => {
    mocks.send.mockRejectedValueOnce(
      new Error('MR_SLOP_SERVER_KEY_MISSING:GEMINI_API_KEY is missing from server-side AI Studio Secrets environment.'),
    );
    const specimen = makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), 'Test Slop');
    render(<MrSlopTerminal specimen={specimen} onChange={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), { target: { value: 'hello' } });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    expect(await screen.findByText(/GEMINI_API_KEY is missing/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
