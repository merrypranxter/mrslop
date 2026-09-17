import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import PartPicker from '../components/PartPicker';
import { GenomeComponent } from '../types';

const makeComponent = (
  id: string,
  name: string,
  kind: GenomeComponent['kind'],
  description: string,
  charWeight = 100,
): GenomeComponent => ({
  id,
  name,
  kind,
  version: 'test',
  sourceRepo: 'merrypranxter/ai_slop',
  sourcePath: `source/${id}.md`,
  sourceSha: 'abc123',
  description,
  prompt: 'x'.repeat(charWeight),
  tags: [kind, 'weird'],
  roleHints: ['structure'],
  enabled: true,
  order: 0,
  charWeight,
});

const library: GenomeComponent[] = [
  makeComponent('tm-01', 'Property Unbundling', 'mind', 'Move a property to a new owner.'),
  makeComponent('separated-jurisdictions', 'Separated Jurisdictions', 'operator', 'Give different systems different jobs.'),
  makeComponent('eccentric-kineticist', 'The Eccentric Kineticist', 'seed', 'Push into distant operational lenses.'),
];

describe('PartPicker', () => {
  it('searches the catalog and filters by kind', () => {
    render(
      <PartPicker
        library={library}
        selectedIds={[]}
        onChange={vi.fn()}
        onSpawn={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'different jobs' } });
    expect(screen.getByText('Separated Jurisdictions')).toBeInTheDocument();
    expect(screen.queryByText('Property Unbundling')).not.toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: /^seed$/i }));
    expect(screen.getByText('The Eccentric Kineticist')).toBeInTheDocument();
    expect(screen.queryByText('Separated Jurisdictions')).not.toBeInTheDocument();
  });

  it('toggles multiple selections without an arbitrary cap', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <PartPicker
        library={library}
        selectedIds={[]}
        onChange={onChange}
        onSpawn={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /property unbundling/i }));
    expect(onChange).toHaveBeenLastCalledWith(['tm-01']);

    rerender(
      <PartPicker
        library={library}
        selectedIds={['tm-01']}
        onChange={onChange}
        onSpawn={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /separated jurisdictions/i }));
    expect(onChange).toHaveBeenLastCalledWith(['tm-01', 'separated-jurisdictions']);
  });

  it('offers STACK and FUSE spawn actions', () => {
    const onSpawn = vi.fn();
    render(
      <PartPicker
        library={library}
        selectedIds={['tm-01']}
        onChange={vi.fn()}
        onSpawn={onSpawn}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /spawn stack/i }));
    expect(onSpawn).toHaveBeenCalledWith('stack');
    fireEvent.click(screen.getByRole('button', { name: /fuse.*spawn/i }));
    expect(onSpawn).toHaveBeenCalledWith('fuse');
  });

  it('warns when selected prompt weight exceeds 40,000 characters', () => {
    const heavy = [
      makeComponent('heavy-a', 'Heavy A', 'mind', 'heavy', 21_000),
      makeComponent('heavy-b', 'Heavy B', 'operator', 'heavy', 21_000),
    ];
    render(
      <PartPicker
        library={heavy}
        selectedIds={['heavy-a', 'heavy-b']}
        onChange={vi.fn()}
        onSpawn={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/42,000 chars/i)).toBeInTheDocument();
    expect(screen.getByText(/large kernel/i)).toBeInTheDocument();
  });
});
