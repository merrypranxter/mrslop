import React, { useMemo, useState } from 'react';
import { calculateDrift } from '../lib/drift';
import type { Specimen } from '../types';

interface PetriDishSetupProps {
  specimens: Specimen[];
  initialSpecimenId?: string;
  onRun: (specimens: Specimen[], challenge: string) => void;
  onOpenHistory?: () => void;
  onCancel: () => void;
}

const activeTraitCount = (specimen: Specimen) =>
  specimen.acquiredTraits.filter(item => item.status === 'active').length;

const activeInfectionCount = (specimen: Specimen) =>
  specimen.infections.filter(item => item.status === 'active').length;

const PetriDishSetup: React.FC<PetriDishSetupProps> = ({
  specimens,
  initialSpecimenId,
  onRun,
  onOpenHistory,
  onCancel,
}) => {
  const eligible = useMemo(
    () => specimens.filter(item => item.phase === 'spawned'),
    [specimens],
  );

  const initialIds = useMemo(() => {
    if (eligible.length === 0) return [] as string[];
    const first = eligible.find(item => item.id === initialSpecimenId) ?? eligible[0];
    const second = eligible.find(item => item.id !== first.id);
    return second ? [first.id, second.id] : [first.id];
  }, [eligible, initialSpecimenId]);

  const [selectedIds, setSelectedIds] = useState<string[]>(initialIds);
  const [challenge, setChallenge] = useState('');

  const selected = eligible.filter(item => selectedIds.includes(item.id));
  const brokenFuse = selected.find(item =>
    item.currentGenome.mode === 'fuse' && !item.currentGenome.compiledKernel?.trim());

  const selectionError = selected.length < 2
    ? 'Select at least 2 specimens.'
    : selected.length > 8
      ? 'A Petri Dish can hold at most 8 specimens.'
      : null;

  const canRun = !selectionError && !brokenFuse && challenge.trim().length > 0;

  const toggle = (id: string) => {
    setSelectedIds(current => {
      if (current.includes(id)) return current.filter(item => item !== id);
      if (current.length >= 8) return current;
      return [...current, id];
    });
  };

  return (
    <div className="breeding-modal-backdrop">
      <section
        className="breeding-modal petri-setup-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Petri Dish"
      >
        <span className="breeding-kicker">MULTI-SPECIMEN PHENOTYPE TRIAL</span>
        <h2>PETRI DISH</h2>
        <p className="breeding-copy">
          Give several lived specimens the exact same pressure. This is observation, not automatic fitness scoring.
        </p>

        <label className="petri-challenge-field">
          <span>SHARED CHALLENGE</span>
          <textarea
            aria-label="Shared challenge"
            value={challenge}
            onChange={event => setChallenge(event.target.value)}
            rows={4}
            placeholder="Every selected specimen gets this exact text."
          />
        </label>

        <div className="petri-call-count" role="status">
          <strong>{selected.length} specimens = {selected.length} generation calls</strong>
          <span>No hidden judge or critique calls.</span>
        </div>

        <div className="petri-entrant-list">
          {eligible.map(specimen => {
            const checked = selectedIds.includes(specimen.id);
            const drift = calculateDrift(specimen);
            const enabledParts = specimen.currentGenome.components
              .filter(component => component.enabled).length;
            const fuseBroken = specimen.currentGenome.mode === 'fuse' &&
              !specimen.currentGenome.compiledKernel?.trim();

            return (
              <label className="petri-entrant-row" key={specimen.id}>
                <input
                  type="checkbox"
                  aria-label={specimen.name}
                  checked={checked}
                  disabled={!checked && selectedIds.length >= 8}
                  onChange={() => toggle(specimen.id)}
                />
                <span className="petri-entrant-name">{specimen.name}</span>
                <small>
                  GEN {specimen.lineage.generation} · {drift.band} DRIFT · {specimen.currentGenome.mode.toUpperCase()}
                  {' · '}{enabledParts} PARTS · {activeTraitCount(specimen)} TRAITS
                  {' · '}{activeInfectionCount(specimen)} INFECTIONS
                </small>
                {fuseBroken && <small className="breeding-error">MISSING COMPILED FUSE KERNEL</small>}
              </label>
            );
          })}
        </div>

        {eligible.length < 2 && (
          <div className="breeding-error">You need at least 2 spawned specimens for a Petri Dish.</div>
        )}
        {selectionError && eligible.length >= 2 && (
          <div className="breeding-error">{selectionError}</div>
        )}
        {brokenFuse && (
          <div className="breeding-error">
            {brokenFuse.name} is missing its compiled FUSE kernel. Repair or switch it before running this trial.
          </div>
        )}

        <div className="breeding-actions">
          <button
            type="button"
            className="breeding-primary"
            disabled={!canRun}
            onClick={() => canRun && onRun(selected, challenge)}
          >
            RUN PETRI DISH
          </button>
          {onOpenHistory && (
            <button type="button" onClick={onOpenHistory}>TRIAL HISTORY</button>
          )}
          <button type="button" onClick={onCancel}>CANCEL</button>
        </div>
      </section>
    </div>
  );
};

export default PetriDishSetup;
