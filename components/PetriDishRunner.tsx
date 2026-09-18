import React from 'react';
import { petriEntrantDisplayLabel } from '../lib/petriSelection';
import type { PetriTrial } from '../types';

interface PetriDishRunnerProps {
  trial: PetriTrial;
  blind: boolean;
  busy: boolean;
  readOnly?: boolean;
  onToggleBlind: () => void;
  onRetry: (entrantSnapshotId: string) => void;
  onAbort: () => void;
  onSelectionChange: (entrantSnapshotIds: string[]) => void;
  onOpenEntrant?: (entrantSnapshotId: string) => void;
  onForkEntrant?: (entrantSnapshotId: string) => void;
  onBreedSelected?: (entrantSnapshotIds: string[]) => void;
  onClose: () => void;
}

const PetriDishRunner: React.FC<PetriDishRunnerProps> = ({
  trial,
  blind,
  busy,
  readOnly = false,
  onToggleBlind,
  onRetry,
  onAbort,
  onSelectionChange,
  onOpenEntrant,
  onForkEntrant,
  onBreedSelected,
  onClose,
}) => {
  const selected = new Set(trial.selection?.selectedEntrantSnapshotIds ?? []);

  const toggleSelection = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    const ordered = trial.entrantOrder.filter(item => next.has(item));
    onSelectionChange(ordered);
  };

  return (
    <div className="breeding-modal-backdrop">
      <section
        className="breeding-modal petri-results-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Petri Dish results"
      >
        <span className="breeding-kicker">PHENOTYPE OBSERVATIONS</span>
        <h2>PETRI DISH</h2>
        <p className="breeding-copy">{trial.challenge}</p>

        <div className="petri-result-toolbar">
          <span>{trial.status.toUpperCase()} · {trial.entrants.length} ENTRANTS</span>
          <button type="button" onClick={onToggleBlind}>
            {blind ? 'REVEAL IDENTITIES' : 'BLIND VIEW'}
          </button>
          {!readOnly && busy && trial.status === 'running' && (
            <button type="button" onClick={onAbort}>ABORT PETRI DISH</button>
          )}
        </div>

        <div className="petri-result-grid">
          {trial.entrantOrder.map(entrantId => {
            const entrant = trial.entrants.find(item => item.id === entrantId);
            const result = trial.results.find(item => item.entrantSnapshotId === entrantId);
            if (!entrant || !result) return null;
            const label = petriEntrantDisplayLabel(trial, entrantId, blind);
            const selectable = result.status === 'succeeded';

            return (
              <article className="petri-result-card" key={entrantId}>
                <header>
                  <strong>{label}</strong>
                  <span>{result.status.toUpperCase()}</span>
                </header>
                <small>
                  GEN {entrant.generation} · {entrant.driftBand} DRIFT · {entrant.genome.mode.toUpperCase()}
                  {' · '}{entrant.genome.components.filter(item => item.enabled).length} PARTS
                </small>

                {result.status === 'succeeded' ? (
                  <div className="petri-output">{result.outputText || '[EMPTY OUTPUT]'}</div>
                ) : result.status === 'failed' ? (
                  <div className="breeding-error">
                    {result.errorMessage || result.errorCode || 'Generation failed.'}
                  </div>
                ) : result.status === 'aborted' ? (
                  <div className="breeding-error">ABORTED</div>
                ) : (
                  <div className="slop-thinking">
                    {result.status === 'running' ? 'RUNNING…' : 'WAITING…'}
                  </div>
                )}

                <div className="petri-result-actions">
                  {!readOnly && result.status === 'failed' && !busy && (
                    <button
                      type="button"
                      aria-label={`Retry ${label}`}
                      onClick={() => onRetry(entrantId)}
                    >
                      RETRY
                    </button>
                  )}
                  {selectable && (
                    <label>
                      <input
                        type="checkbox"
                        aria-label={`Select ${label}`}
                        checked={selected.has(entrantId)}
                        onChange={() => toggleSelection(entrantId)}
                      />
                      SELECT
                    </label>
                  )}
                  {selected.has(entrantId) && onOpenEntrant && (
                    <button
                      type="button"
                      aria-label={`Open selected ${label}`}
                      onClick={() => onOpenEntrant(entrantId)}
                    >
                      OPEN
                    </button>
                  )}
                  {selected.has(entrantId) && onForkEntrant && (
                    <button
                      type="button"
                      aria-label={`Fork selected ${label}`}
                      onClick={() => onForkEntrant(entrantId)}
                    >
                      FORK
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <div className="breeding-actions">
          {selected.size === 2 && onBreedSelected && (
            <button
              type="button"
              className="breeding-primary"
              disabled={busy}
              onClick={() => onBreedSelected(
                trial.entrantOrder.filter(id => selected.has(id)),
              )}
            >
              BREED SELECTED
            </button>
          )}
          <button type="button" disabled={busy} onClick={onClose}>CLOSE</button>
        </div>
      </section>
    </div>
  );
};

export default PetriDishRunner;
