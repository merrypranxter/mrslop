import React from 'react';
import { AlertTriangle, MessageSquareText, X } from 'lucide-react';
import { ChoiceCardOption, StructuralDecisionEvent } from '../types';
import './ConversationUI.css';

interface StructuralDecisionModalProps {
  event: StructuralDecisionEvent;
  busy?: boolean;
  error?: string | null;
  onApprove: (option: ChoiceCardOption) => void;
  onCancel: () => void;
  onAnswerInChat: () => void;
}

const StructuralDecisionModal: React.FC<StructuralDecisionModalProps> = ({
  event,
  busy = false,
  error,
  onApprove,
  onCancel,
  onAnswerInChat,
}) => (
  <div className="structural-modal-backdrop" role="presentation">
    <section className="structural-modal" role="dialog" aria-modal="true" aria-label={event.title}>
      <div className="structural-modal-topline">
        <span><AlertTriangle size={15} /> THIS CHANGES THE SPECIMEN</span>
        <button type="button" onClick={onCancel} disabled={busy} aria-label="Not now">
          <X size={17} />
        </button>
      </div>

      <h2>{event.title}</h2>

      <div className="structural-why">
        <strong>WHY THIS OPENED</strong>
        <p>{event.reason}</p>
      </div>

      {event.recommendation && (
        <div className="structural-recommendation">
          <strong>MR. SLOP'S PICK</strong>
          <p>{event.recommendation}</p>
        </div>
      )}

      {error && <div className="structural-error" role="alert">{error}</div>}

      <div className="structural-options">
        {event.options.map(option => (
          <button
            type="button"
            key={option.id}
            onClick={() => onApprove(option)}
            disabled={busy}
          >
            <strong>{option.label}</strong>
            <small>{option.description}</small>
          </button>
        ))}
      </div>

      <div className="structural-footer">
        <button type="button" className="answer-in-chat" onClick={onAnswerInChat} disabled={busy}>
          <MessageSquareText size={14} /> ANSWER WITH WORDS
        </button>
        <button type="button" className="not-now" onClick={onCancel} disabled={busy}>
          NOT NOW
        </button>
      </div>
    </section>
  </div>
);

export default StructuralDecisionModal;
