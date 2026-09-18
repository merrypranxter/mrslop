import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import LineageStatus from '../components/LineageStatus';
import SpecimenSidebar from '../components/SpecimenSidebar';
import { createGenome } from '../lib/genome';
import { calculateDrift } from '../lib/drift';
import { SLOP_LIBRARY } from '../data/slopLibrary';
import { makeSpecimen } from '../services/specimenStore';
import type { Specimen } from '../types';

const root = (id: string, name: string): Specimen => {
  const specimen = makeSpecimen(
    createGenome(['tm-01'], SLOP_LIBRARY, 'stack'),
    name,
    'spawned',
  );
  return {
    ...specimen,
    id,
    lineage: {
      kind: 'root',
      parentSpecimenIds: [],
      rootSpecimenIds: [id],
      generation: 0,
      source: 'native-v4',
    },
  };
};

const bred = (): { child: Specimen; a: Specimen; b: Specimen } => {
  const a = root('parent-a', 'PARENT A');
  const b = root('parent-b', 'PARENT B');
  const childBase = root('child', 'BRED CHILD');
  const child: Specimen = {
    ...childBase,
    lineage: {
      kind: 'bred',
      parentSpecimenIds: [a.id, b.id],
      rootSpecimenIds: [a.id, b.id],
      generation: 4,
      bredAt: 1000,
      geneticsReceiptId: 'receipt-1',
      source: 'bred-v4',
    },
    birthBaseline: {
      ...childBase.birthBaseline,
      source: 'bred-v4',
    },
  };
  return { child, a, b };
};

describe('Round 2C lineage and drift display', () => {
  it('renders both parents and all roots factually for a bred child', () => {
    const { child, a, b } = bred();

    render(
      <LineageStatus
        specimen={child}
        specimenNames={{
          [a.id]: a.name,
          [b.id]: b.name,
        }}
      />,
    );

    const toggle = screen.getByRole('button', { name: /lineage status/i });
    expect(toggle).toHaveTextContent('GEN 4');
    fireEvent.click(toggle);

    expect(screen.getByText(/PARENTS: PARENT A × PARENT B/i)).toBeInTheDocument();
    expect(screen.getByText(/ROOTS: PARENT A · PARENT B/i)).toBeInTheDocument();
    expect(screen.getByText(/GENERATION: 4/i)).toBeInTheDocument();
  });

  it('keeps root and fork lineage labels correct beside bred lineage', () => {
    const rootSpecimen = root('root', 'ROOT');
    const fork: Specimen = {
      ...root('fork', 'FORK'),
      lineage: {
        kind: 'fork',
        parentSpecimenIds: [rootSpecimen.id],
        rootSpecimenIds: [rootSpecimen.id],
        generation: 1,
        source: 'fork-v4',
      },
    };

    const { unmount } = render(
      <LineageStatus
        specimen={rootSpecimen}
        specimenNames={{ [rootSpecimen.id]: rootSpecimen.name }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /lineage status/i }));
    expect(screen.getByText(/PARENT: ROOT/i)).toBeInTheDocument();
    unmount();

    render(
      <LineageStatus
        specimen={fork}
        specimenNames={{ [rootSpecimen.id]: rootSpecimen.name }}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /lineage status/i }));
    expect(screen.getByText(/PARENT: ROOT/i)).toBeInTheDocument();
    expect(screen.getByText(/ROOT: ROOT/i)).toBeInTheDocument();
  });

  it('does not count generation itself as lifetime drift', () => {
    const { child } = bred();
    const report = calculateDrift(child);

    expect(report.dimensions.generation).toBe(4);
    expect(report.score).toBe(0);
    expect(report.band).toBe('LOW');
  });

  it('marks bred specimens factually in the saved-specimen sidebar without ranking language', () => {
    const { child, a, b } = bred();

    render(
      <SpecimenSidebar
        specimens={[a, b, child]}
        activeSpecimenId={child.id}
        onOpen={vi.fn()}
        onNew={vi.fn()}
        onDelete={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    const sidebar = screen.getByRole('complementary', { name: /saved specimens/i });
    const childLabel = within(sidebar).getByText('BRED CHILD');
    const row = childLabel.closest('.specimen-row')!;

    expect(row).toHaveTextContent('BRED · 2 PARENTS');
    expect(row).not.toHaveTextContent(/best/i);
    expect(row).not.toHaveTextContent(/compatibility/i);
    expect(row).not.toHaveTextContent(/recommended/i);
  });
});
