import React from 'react';
import { ChoiceCardEvent, ChoiceCardOption } from '../types';
import './ConversationUI.css';

interface ChoiceCardProps {
  event: ChoiceCardEvent;
  onSelect: (option: ChoiceCardOption) => void;
}

const ChoiceCard: React.FC<ChoiceCardProps> = ({ event, onSelect }) => (
  <section className="choice-card" aria-label={event.title}>
    <div className="choice-card-kicker">MR. SLOP HAS OPTIONS</div>
    <strong>{event.title}</strong>
    {event.reason && <p>{event.reason}</p>}
    <div className="choice-card-options">
      {event.options.map(option => (
        <button key={option.id} type="button" onClick={() => onSelect(option)}>
          <span>{option.label}</span>
          <small>{option.description}</small>
        </button>
      ))}
    </div>
  </section>
);

export default ChoiceCard;
