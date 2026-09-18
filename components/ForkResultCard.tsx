import React from 'react';
import { Specimen } from '../types';
import './ConversationUI.css';

interface ForkResultCardProps {
  child: Specimen;
  onOpenChild: () => void;
  onStay: () => void;
}

const ForkResultCard: React.FC<ForkResultCardProps> = ({
  child,
  onOpenChild,
  onStay,
}) => (
  <div className="fork-result-card">
    <span>FORK SAVED</span>
    <strong>{child.name}</strong>
    <p>The child is saved as a separate specimen with a fresh conversation.</p>
    <div className="fork-result-actions">
      <button type="button" onClick={onOpenChild}>OPEN CHILD</button>
      <button type="button" onClick={onStay}>STAY WITH PARENT</button>
    </div>
  </div>
);

export default ForkResultCard;
