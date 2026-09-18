import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  send: vi.fn(),
  stored: null as unknown,
}));

vi.mock('localforage', () => ({
  default: {
    getItem: vi.fn(async () => harness.stored),
    setItem: vi.fn(async (_key: string, value: unknown) => {
      harness.stored = structuredClone(value);
      return value;
    }),
  },
}));

vi.mock('../services/geminiService', async importOriginal => {
  const actual = await importOriginal<typeof import('../services/geminiService')>();
  return { ...actual, sendMrSlopMessage: harness.send };
});

import MrSlopTerminal from '../components/MrSlopTerminal';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { createGenome } from '../lib/genome';
import { loadSpecimens, makeSpecimen, saveSpecimens } from '../services/specimenStore';
import { MutationProposal, Role, Specimen } from '../types';

const infectionProposal: MutationProposal = {
  id: 'acceptance-infection',
  kind: 'infection',
  name: 'Metric Vertigo',
  description: 'Temporarily replace ordinary conceptual distance.',
  prompt: 'Use a deliberately alien distance metric when selecting conceptual neighbors.',
  reason: 'The specimen is settling into the same nearby ideas.',
  recommendedTurns: 2,
  sourceMessageIds: ['source-infection-message'],
  sourceArtifactIds: [],
  sourceType: 'mr-slop',
};

const fossilProposal: MutationProposal = {
  id: 'acceptance-fossil',
  kind: 'fossilized-accident',
  name: 'Navigation Harmony',
  description: 'Translate harmony problems into navigation problems.',
  prompt: 'When harmony stalls, remap the problem as navigation through a strange space.',
  reason: 'The behavior emerged repeatedly and produced useful results.',
  sourceMessageIds: ['source-fossil-message', 'invented-message-id'],
  sourceArtifactIds: ['source-artifact', 'invented-artifact-id'],
  sourceType: 'conversation',
};

const specimenFixture = (): Specimen => {
  const specimen = makeSpecimen(createGenome(['tm-01'], SLOP_LIBRARY, 'stack'), 'Acceptance Slop');
  return {
    ...specimen,
    messages: [{
      id: 'source-fossil-message',
      role: Role.MODEL,
      content: 'Earlier, harmony unexpectedly behaved like navigation through a strange space.',
      timestamp: 1,
    }],
    artifacts: [{
      id: 'source-artifact',
      specimenId: specimen.id,
      messageId: 'source-fossil-message',
      kind: 'note',
      title: 'Navigation accident',
      content: 'Harmony remapped into navigation.',
      genomeId: specimen.currentGenome.id,
      componentIds: specimen.currentGenome.components.map(component => component.id),
      createdAt: 2,
    }],
  };
};

const sendText = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
};

describe('Round 2A mutation acceptance', () => {
  beforeEach(() => {
    harness.send.mockReset();
    harness.stored = null;
  });

  it('survives the full infection → expiry → fossilize → reload → restore lifecycle', async () => {
    let latest = specimenFixture();
    const onChange = vi.fn((next: Specimen) => {
      latest = next;
    });

    harness.send.mockResolvedValueOnce({
      text: 'Try Metric Vertigo for two turns.',
      mutationProposal: infectionProposal,
    });

    render(<MrSlopTerminal specimen={latest} onChange={onChange} />);

    sendText('fuck with yourself');
    fireEvent.click(await screen.findByRole('button', { name: /try for 2 turns/i }));

    await waitFor(() => {
      expect(latest.infections[0]).toMatchObject({
        status: 'active',
        remainingTurns: 2,
      });
    });

    harness.send.mockResolvedValueOnce({ text: 'infected reply one' });
    sendText('first infected turn');
    await screen.findByText('infected reply one');

    await waitFor(() => {
      expect(latest.infections[0].remainingTurns).toBe(1);
      expect(latest.infections[0].status).toBe('active');
    });

    harness.send.mockRejectedValueOnce(new Error('temporary network failure'));
    sendText('failed infected turn');
    await screen.findByRole('button', { name: /retry/i });

    expect(latest.infections[0].remainingTurns).toBe(1);
    expect(latest.infections[0].status).toBe('active');

    harness.send.mockResolvedValueOnce({ text: 'infected reply two' });
    sendText('second successful infected turn');
    await screen.findByText('infected reply two');

    await waitFor(() => {
      expect(latest.infections[0]).toMatchObject({
        status: 'expired',
        remainingTurns: 0,
      });
      expect(latest.lifeHistory.some(event => event.type === 'infection-expired')).toBe(true);
    });

    harness.send.mockResolvedValueOnce({
      text: 'That navigation behavior is worth keeping.',
      mutationAction: {
        type: 'fossilize-accident',
        proposal: fossilProposal,
      },
    });
    sendText('keep that shit');

    await screen.findByText(/this changes the specimen/i);
    expect(latest.acquiredTraits).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: /fossilize it/i }));

    await waitFor(() => {
      expect(latest.acquiredTraits).toHaveLength(1);
    });

    const trait = latest.acquiredTraits[0];
    expect(trait).toMatchObject({
      name: 'Navigation Harmony',
      originType: 'fossilized-accident',
      provenance: {
        specimenId: latest.id,
        genomeId: latest.currentGenome.id,
        sourceMessageIds: ['source-fossil-message'],
        sourceArtifactIds: ['source-artifact'],
      },
    });

    const fossilCheckpoint = latest.checkpoints.at(-1);
    expect(fossilCheckpoint).toBeDefined();
    expect(fossilCheckpoint?.acquiredTraits).toHaveLength(0);

    const fossilReply = latest.messages.find(message =>
      message.content === 'That navigation behavior is worth keeping.');
    expect(fossilReply).toBeDefined();

    const saveButtons = screen.getAllByRole('button', { name: /save artifact/i });
    fireEvent.click(saveButtons.at(-1)!);

    await waitFor(() => {
      expect(latest.artifacts.some(artifact => artifact.messageId === fossilReply?.id)).toBe(true);
    });

    const messageCountBeforeReload = latest.messages.length;
    const artifactCountBeforeReload = latest.artifacts.length;
    const historyCountBeforeReload = latest.lifeHistory.length;

    await saveSpecimens([latest]);
    const [reloaded] = await loadSpecimens();

    expect(reloaded.acquiredTraits[0]).toMatchObject({
      name: 'Navigation Harmony',
      status: 'active',
    });
    expect(reloaded.infections[0]).toMatchObject({
      name: 'Metric Vertigo',
      status: 'expired',
    });
    expect(reloaded.messages).toHaveLength(messageCountBeforeReload);
    expect(reloaded.artifacts).toHaveLength(artifactCountBeforeReload);

    const restoreId = reloaded.checkpoints.at(-1)?.id;
    expect(restoreId).toBeTruthy();

    harness.send.mockResolvedValueOnce({
      text: 'I can restore the pre-fossil checkpoint.',
      mutationAction: {
        type: 'restore-checkpoint',
        targetId: restoreId,
      },
    });

    fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), {
      target: { value: 'undo that shit' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^send$/i }));

    await screen.findByText(/this changes the specimen/i);
    fireEvent.click(screen.getByRole('button', { name: /restore checkpoint/i }));

    await waitFor(() => {
      expect(latest.acquiredTraits).toHaveLength(0);
      expect(latest.lifeHistory.at(-1)?.type).toBe('checkpoint-restored');
    });

    expect(latest.messages.length).toBeGreaterThan(messageCountBeforeReload);
    expect(latest.artifacts).toHaveLength(artifactCountBeforeReload);
    expect(latest.lifeHistory.length).toBeGreaterThan(historyCountBeforeReload);
    expect(latest.lifeHistory.some(event => event.type === 'accident-fossilized')).toBe(true);
  });
});
