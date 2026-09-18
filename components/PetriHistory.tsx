import React from 'react';
import type { PetriTrial } from '../types';

interface PetriHistoryProps {
  trials: PetriTrial[];
  onOpen: (trial: PetriTrial) => void;
  onClose: () => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

const PetriHistory: React.FC<PetriHistoryProps> = ({
  trials,
  onOpen,
  onClose,
}) => (
  <div className="breeding-modal-backdrop">
    <section
      className="breeding-modal petri-history-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Petri history"
    >
      <span className="breeding-kicker">SAVED PHENOTYPE TRIALS</span>
      <h2>PETRI HISTORY</h2>
      <p className="breeding-copy">
        Historical trials reopen exactly as stored. Opening one does not regenerate its outputs.
      </p>

      <div className="petri-history-list">
        {trials.length === 0 && (
          <div className="specimen-list-empty">No Petri trials yet.</div>
        )}

        {[...trials]
          .sort((a, b) => b.lastModified - a.lastModified)
          .map(trial => (
            <article className="petri-history-row" key={trial.id}>
              <div>
                <strong>{trial.challenge.slice(0, 120) || '[EMPTY CHALLENGE]'}</strong>
                <span>
                  {trial.entrants.length} ENTRANTS · {trial.status.toUpperCase()}
                  {' · '}{trial.selection?.selectedEntrantSnapshotIds.length ?? 0} SELECTED
                </span>
                <small>{formatTime(trial.completedAt ?? trial.lastModified ?? trial.createdAt)}</small>
              </div>
              <button
                type="button"
                aria-label="Open Petri trial"
                onClick={() => onOpen(structuredClone(trial))}
              >
                OPEN
              </button>
            </article>
          ))}
      </div>

      <div className="breeding-actions">
        <button type="button" onClick={onClose}>CLOSE</button>
      </div>
    </section>
  </div>
);

export default PetriHistory;
