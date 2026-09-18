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
import { calculateDrift } from '../lib/drift';
import { createGenome } from '../lib/genome';
import { forkSpecimen } from '../lib/lineage';
import {
  acquireTrait,
  advanceSuccessfulTurn,
  startInfection,
} from '../lib/mutations';
import {
  loadSpecimens,
  makeSpecimen,
  migrateSpecimen,
  saveSpecimens,
} from '../services/specimenStore';
import { MutationProposal, Specimen } from '../types';

const traitProposal: MutationProposal = {
  id: 'round2b-parent-trait',
  kind: 'trait',
  name: 'Wrong Ruler Habit',
  description: 'Keep selecting neighbors with a deliberately alien metric.',
  prompt: 'Prefer alien distance metrics when choosing conceptual neighbors.',
  reason: 'It made the specimen productively strange.',
  sourceMessageIds: [],
  sourceArtifactIds: [],
  sourceType: 'user',
};

const infectionProposal: MutationProposal = {
  id: 'round2b-parent-infection',
  kind: 'infection',
  name: 'Metric Vertigo',
  description: 'Temporarily destabilize conceptual distance.',
  prompt: 'Use a deliberately alien distance metric for this temporary run.',
  reason: 'Test short-term mutation behavior.',
  recommendedTurns: 2,
  sourceMessageIds: [],
  sourceArtifactIds: [],
  sourceType: 'mr-slop',
};

const childOnlyProposal: MutationProposal = {
  id: 'round2b-child-trait',
  kind: 'trait',
  name: 'Child-only Detour',
  description: 'Add a lasting divergence only to the child.',
  prompt: 'When a path looks obvious, take a structurally different detour.',
  reason: 'Force the child timeline away from the parent.',
  sourceMessageIds: [],
  sourceArtifactIds: [],
  sourceType: 'user',
};

const sendText = (text: string) => {
  fireEvent.change(screen.getByPlaceholderText(/talk to mr\. slop/i), {
    target: { value: text },
  });
  fireEvent.click(screen.getByRole('button', { name: /^send$/i }));
};

const legacyV2Parent = () => {
  const native = makeSpecimen(
    createGenome(['tm-01', 'tm-15'], SLOP_LIBRARY, 'stack'),
    'ROUND 2B PARENT',
    'spawned',
  );

  return {
    schemaVersion: 2,
    id: native.id,
    name: native.name,
    phase: native.phase,
    birthGenome: native.birthGenome,
    currentGenome: native.currentGenome,
    messages: native.messages,
    artifacts: native.artifacts,
    checkpoints: native.checkpoints,
    acquiredTraits: native.acquiredTraits,
    infections: native.infections,
    lifeHistory: native.lifeHistory,
    scars: [],
    trajectory: null,
    controllerState: null,
    metrics: null,
    lineage: null,
    createdAt: native.createdAt,
    lastModified: native.lastModified,
  };
};

describe('Round 2B acceptance', () => {
  beforeEach(() => {
    harness.send.mockReset();
    harness.stored = null;
  });

  it('migrates, scars, forks, diverges, persists, reloads, and preserves explainable drift', async () => {
    const migrated = migrateSpecimen(legacyV2Parent());
    expect(migrated).not.toBeNull();
    if (!migrated) return;

    let parent = acquireTrait(migrated, traitProposal, 'explicit');
    parent = startInfection(parent, infectionProposal, { mode: 'turns', turns: 2 });
    parent = advanceSuccessfulTurn(parent);
    parent = advanceSuccessfulTurn(parent);

    expect(parent.infections[0]).toMatchObject({
      name: 'Metric Vertigo',
      status: 'expired',
      remainingTurns: 0,
    });
    expect(parent.scars.some(scar => scar.kind === 'infection-survived' && scar.origin === 'experienced'))
      .toBe(true);

    const parentDriftBeforeFork = calculateDrift(parent).score;
    let parentAfterFork = parent;
    let child: Specimen | null = null;

    harness.send.mockResolvedValue({
      text: 'Split here.',
      forkAction: {
        type: 'fork-specimen',
        suggestedName: 'ROUND 2B CHILD',
        reason: 'Preserve this parent and let a child timeline diverge.',
      },
    });

    const onChange = vi.fn((next: Specimen) => {
      parent = next;
    });

    const onForkSpecimen = vi.fn(async (suggestedName?: string) => {
      const result = forkSpecimen(parent, suggestedName || 'ROUND 2B CHILD', 5000);
      parentAfterFork = result.parent;
      child = result.child;
      await saveSpecimens([result.parent, result.child]);
      return result.child;
    });

    const onOpenSpecimen = vi.fn();

    render(
      <MrSlopTerminal
        specimen={parent}
        onChange={onChange}
        onForkSpecimen={onForkSpecimen}
        onOpenSpecimen={onOpenSpecimen}
      />,
    );

    sendText('fork this thing');
    fireEvent.click(await screen.findByRole('button', { name: /create child/i }));
    expect(await screen.findByRole('button', { name: /open child/i })).toBeInTheDocument();

    expect(child).not.toBeNull();
    if (!child) return;

    expect(parentAfterFork.id).toBe(parent.id);
    expect(child.lineage.parentSpecimenIds).toEqual([parentAfterFork.id]);
    expect(child.birthBaseline.source).toBe('fork-v4');
    expect(calculateDrift(child).score).toBe(0);
    expect(child.messages).toHaveLength(1);
    expect(child.artifacts).toEqual([]);
    expect(child.checkpoints).toEqual([]);

    const parentActiveTrait = parentAfterFork.acquiredTraits.find(trait => trait.status === 'active');
    expect(parentActiveTrait).toBeDefined();
    expect(child.acquiredTraits).toHaveLength(1);
    expect(child.acquiredTraits[0].id).not.toBe(parentActiveTrait?.id);
    expect(child.acquiredTraits[0].inheritanceSources?.[0]).toMatchObject({
      specimenId: parentAfterFork.id,
      recordId: parentActiveTrait?.id,
    });
    expect(child.scars.every(scar => scar.origin === 'inherited')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /open child/i }));
    expect(onOpenSpecimen).toHaveBeenCalledWith(child);

    const parentDriftBeforeChildChange = calculateDrift(parentAfterFork).score;
    const divergedChild = acquireTrait(child, childOnlyProposal, 'explicit');

    expect(calculateDrift(divergedChild).score).toBeGreaterThan(0);
    expect(calculateDrift(parentAfterFork).score).toBe(parentDriftBeforeChildChange);
    expect(parentDriftBeforeChildChange).toBeGreaterThanOrEqual(parentDriftBeforeFork);

    await saveSpecimens([parentAfterFork, divergedChild]);
    const reloaded = await loadSpecimens();
    const reloadedParent = reloaded.find(specimen => specimen.id === parentAfterFork.id);
    const reloadedChild = reloaded.find(specimen => specimen.id === divergedChild.id);

    expect(reloaded).toHaveLength(2);
    expect(reloadedParent?.lifeHistory.some(event => event.type === 'specimen-forked')).toBe(true);
    expect(reloadedChild?.lineage.parentSpecimenIds).toEqual([parentAfterFork.id]);
    expect(reloadedChild?.birthBaseline).toEqual(divergedChild.birthBaseline);
    expect(reloadedChild?.scars).toEqual(divergedChild.scars);
    expect(reloadedChild && calculateDrift(reloadedChild)).toEqual(calculateDrift(divergedChild));
    expect(reloadedParent && calculateDrift(reloadedParent)).toEqual(calculateDrift(parentAfterFork));

    await waitFor(() => expect(onForkSpecimen).toHaveBeenCalledTimes(1));
  });
});
