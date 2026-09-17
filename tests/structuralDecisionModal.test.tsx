import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StructuralDecisionModal from '../components/StructuralDecisionModal';
import { StructuralDecisionEvent } from '../types';

const event: StructuralDecisionEvent = {
  type: 'structural-decision',
  id: 'decision-1',
  title: 'COLLISION DETECTED',
  reason: 'Two installed mechanisms want authority over the same structural choice.',
  recommendation: 'Keep both and separate their jurisdictions.',
  options: [
    {
      id: 'separate',
      label: 'SEPARATE JURISDICTIONS',
      description: 'Give each mechanism a different job.',
      componentIds: ['tm-01', 'separated-jurisdictions'],
      mode: 'stack',
    },
  ],
};

describe('StructuralDecisionModal', () => {
  afterEach(() => vi.useRealTimers());

  it('explains why it opened and never auto-approves', () => {
    vi.useFakeTimers();
    const onApprove = vi.fn();
    render(
      <StructuralDecisionModal
        event={event}
        onApprove={onApprove}
        onCancel={vi.fn()}
        onAnswerInChat={vi.fn()}
      />,
    );

    expect(screen.getByText(/why this opened/i)).toBeInTheDocument();
    expect(screen.getByText(event.reason)).toBeInTheDocument();
    expect(screen.getByText(event.recommendation!)).toBeInTheDocument();
    expect(onApprove).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(60_000));
    expect(onApprove).not.toHaveBeenCalled();
  });

  it('only applies after an explicit option click', () => {
    const onApprove = vi.fn();
    render(
      <StructuralDecisionModal
        event={event}
        onApprove={onApprove}
        onCancel={vi.fn()}
        onAnswerInChat={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /separate jurisdictions/i }));
    expect(onApprove).toHaveBeenCalledWith(event.options[0]);
  });

  it('cancel and answer-in-chat never apply a structural option', () => {
    const onApprove = vi.fn();
    const onCancel = vi.fn();
    const onAnswerInChat = vi.fn();
    render(
      <StructuralDecisionModal
        event={event}
        onApprove={onApprove}
        onCancel={onCancel}
        onAnswerInChat={onAnswerInChat}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /not now/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();

    const { unmount } = render(
      <StructuralDecisionModal
        event={event}
        onApprove={onApprove}
        onCancel={onCancel}
        onAnswerInChat={onAnswerInChat}
      />,
    );
    fireEvent.click(screen.getAllByRole('button', { name: /answer with words/i }).at(-1)!);
    expect(onAnswerInChat).toHaveBeenCalledTimes(1);
    expect(onApprove).not.toHaveBeenCalled();
    unmount();
  });
});
