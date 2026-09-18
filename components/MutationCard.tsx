import React from 'react';
import { MutationProposal } from '../types';
import './ConversationUI.css';

interface MutationCardProps {
  proposal: MutationProposal;
  preferredTurns?: number;
  onTryTurns: (turns: number) => void;
  onIndefinite: () => void;
  onReviewPersistent: () => void;
  onDismiss: () => void;
}

const MutationCard: React.FC<MutationCardProps> = ({
  proposal,
  preferredTurns,
  onTryTurns,
  onIndefinite,
  onReviewPersistent,
  onDismiss,
}) => {
  const turns = preferredTurns || proposal.recommendedTurns || 5;
  const persistent = proposal.kind !== 'infection';

  return (
    <section className="mutation-card" aria-label={`Mutation proposal: ${proposal.name}`}>
      <span className="mutation-card-kicker">
        {proposal.kind === 'infection' ? 'TEMPORARY INFECTION' : proposal.kind === 'trait' ? 'ACQUIRED TRAIT' : 'FOSSILIZED ACCIDENT'}
      </span>
      <strong>{proposal.name}</strong>
      <p>{proposal.description}</p>
      <small>WHY NOW · {proposal.reason}</small>

      <div className="mutation-card-actions">
        {persistent ? (
          <button type="button" className="mutation-primary" onClick={onReviewPersistent}>
            REVIEW &amp; KEEP
          </button>
        ) : (
          <>
            <button
              type="button"
              className="mutation-primary"
              aria-label={`Try for ${turns} turns`}
              onClick={() => onTryTurns(turns)}
            >
              TRY FOR {turns} TURNS
            </button>
            <button
              type="button"
              aria-label="Keep on until I remove it"
              onClick={onIndefinite}
            >
              KEEP ON UNTIL I REMOVE IT
            </button>
          </>
        )}
        <button type="button" className="mutation-dismiss" onClick={onDismiss}>NOPE</button>
      </div>
    </section>
  );
};

export default MutationCard;
