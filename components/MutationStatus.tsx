import React, { useMemo, useState } from 'react';
import { AcquiredTrait, Infection } from '../types';
import './ConversationUI.css';

interface MutationStatusProps {
  infections: Infection[];
  traits: AcquiredTrait[];
  onRemoveInfection: (infectionId: string) => void;
  onPromoteInfection: (infectionId: string) => void;
  onRetireTrait: (traitId: string) => void;
}

const MutationStatus: React.FC<MutationStatusProps> = ({
  infections,
  traits,
  onRemoveInfection,
  onPromoteInfection,
  onRetireTrait,
}) => {
  const [open, setOpen] = useState(false);
  const activeInfections = useMemo(
    () => infections.filter(infection => infection.status === 'active'),
    [infections],
  );
  const activeTraits = useMemo(
    () => traits.filter(trait => trait.status === 'active'),
    [traits],
  );

  if (activeInfections.length === 0 && activeTraits.length === 0) return null;

  return (
    <aside className="mutation-status">
      <button
        type="button"
        className="mutation-status-toggle"
        aria-expanded={open}
        aria-label={`Mutation status: ${activeInfections.length} infections, ${activeTraits.length} traits`}
        onClick={() => setOpen(value => !value)}
      >
        <span>{activeInfections.length} INFECTION{activeInfections.length === 1 ? '' : 'S'}</span>
        <span>·</span>
        <span>{activeTraits.length} TRAIT{activeTraits.length === 1 ? '' : 'S'}</span>
      </button>

      {open && (
        <div className="mutation-status-panel">
          {activeInfections.map(infection => (
            <div className="mutation-status-row" key={infection.id}>
              <div>
                <strong>{infection.name}</strong>
                <small>
                  {infection.durationMode === 'indefinite'
                    ? 'INDEFINITE'
                    : `${infection.remainingTurns ?? 0} TURNS LEFT`}
                </small>
              </div>
              <div className="mutation-status-actions">
                <button
                  type="button"
                  aria-label={`Keep ${infection.name} as trait`}
                  onClick={() => onPromoteInfection(infection.id)}
                >
                  KEEP
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${infection.name}`}
                  onClick={() => onRemoveInfection(infection.id)}
                >
                  REMOVE
                </button>
              </div>
            </div>
          ))}

          {activeTraits.map(trait => (
            <div className="mutation-status-row trait-row" key={trait.id}>
              <div>
                <strong>{trait.name}</strong>
                <small>ACQUIRED TRAIT</small>
              </div>
              <div className="mutation-status-actions">
                <button
                  type="button"
                  aria-label={`Retire ${trait.name}`}
                  onClick={() => onRetireTrait(trait.id)}
                >
                  RETIRE
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
};

export default MutationStatus;
