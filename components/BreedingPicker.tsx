import React, { useEffect, useMemo, useState } from 'react';
import type { Specimen } from '../types';

interface BreedingPickerProps {
  specimens: Specimen[];
  initialParentAId?: string;
  onPreview: (parentA: Specimen, parentB: Specimen) => void;
  onCancel: () => void;
}

const enabledCount = (specimen: Specimen): number =>
  specimen.currentGenome.components.filter(component => component.enabled).length;

const activeTraitCount = (specimen: Specimen): number =>
  specimen.acquiredTraits.filter(trait => trait.status === 'active').length;

const sharedComponentCount = (a: Specimen, b: Specimen): number => {
  const bIds = new Set(
    b.currentGenome.components
      .filter(component => component.enabled)
      .map(component => component.id),
  );
  return new Set(
    a.currentGenome.components
      .filter(component => component.enabled && bIds.has(component.id))
      .map(component => component.id),
  ).size;
};

const BreedingPicker: React.FC<BreedingPickerProps> = ({
  specimens,
  initialParentAId,
  onPreview,
  onCancel,
}) => {
  const eligible = useMemo(
    () => specimens.filter(specimen => specimen.phase === 'spawned'),
    [specimens],
  );

  const initialA = eligible.some(specimen => specimen.id === initialParentAId)
    ? initialParentAId!
    : eligible[0]?.id ?? '';
  const initialB = eligible.find(specimen => specimen.id !== initialA)?.id ?? '';

  const [parentAId, setParentAId] = useState(initialA);
  const [parentBId, setParentBId] = useState(initialB);

  useEffect(() => {
    if (!eligible.some(specimen => specimen.id === parentAId)) {
      const nextA = eligible[0]?.id ?? '';
      setParentAId(nextA);
      setParentBId(eligible.find(specimen => specimen.id !== nextA)?.id ?? '');
      return;
    }
    if (!eligible.some(specimen => specimen.id === parentBId)) {
      setParentBId(eligible.find(specimen => specimen.id !== parentAId)?.id ?? '');
    }
  }, [eligible, parentAId, parentBId]);

  const parentA = eligible.find(specimen => specimen.id === parentAId);
  const parentB = eligible.find(specimen => specimen.id === parentBId);
  const validPair = Boolean(parentA && parentB && parentA.id !== parentB.id);

  return (
    <div className="breeding-modal-backdrop">
      <section
        className="breeding-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Breed specimens"
      >
        <span className="breeding-kicker">CONTROLLED FREAK GENETICS</span>
        <h2>BREED TWO SPECIMENS</h2>
        <p className="breeding-copy">
          Pick the two lived specimens. This is factual comparison only; Mr. Slop does not rank mates.
        </p>

        <div className="breeding-parent-grid">
          <label>
            <span>PARENT A</span>
            <select
              aria-label="Parent A"
              value={parentAId}
              onChange={event => setParentAId(event.target.value)}
            >
              {eligible.map(specimen => (
                <option key={specimen.id} value={specimen.id}>
                  {specimen.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>PARENT B</span>
            <select
              aria-label="Parent B"
              value={parentBId}
              onChange={event => setParentBId(event.target.value)}
            >
              {eligible.map(specimen => (
                <option key={specimen.id} value={specimen.id}>
                  {specimen.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {parentA && parentB && (
          <div className="breeding-facts">
            <p>
              Generation A {parentA.lineage.generation} / B {parentB.lineage.generation}
              {' · '}Enabled components A {enabledCount(parentA)} / B {enabledCount(parentB)}
              {' · '}Active traits A {activeTraitCount(parentA)} / B {activeTraitCount(parentB)}
              {' · '}Shared component IDs {sharedComponentCount(parentA, parentB)}
            </p>
          </div>
        )}

        {eligible.length < 2 && (
          <div className="breeding-error">You need two spawned specimens before breeding.</div>
        )}
        {parentAId && parentAId === parentBId && (
          <div className="breeding-error">A specimen cannot breed with itself in Round 2C.</div>
        )}

        <div className="breeding-actions">
          <button
            type="button"
            className="breeding-primary"
            disabled={!validPair}
            onClick={() => parentA && parentB && onPreview(parentA, parentB)}
          >
            PREVIEW OFFSPRING
          </button>
          <button type="button" onClick={onCancel}>CANCEL</button>
        </div>
      </section>
    </div>
  );
};

export default BreedingPicker;
