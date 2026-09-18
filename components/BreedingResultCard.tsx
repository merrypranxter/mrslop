import React from 'react';
import type { Specimen } from '../types';

interface BreedingResultCardProps {
  child: Specimen;
  onOpenChild: () => void;
  onStay: () => void;
}

const BreedingResultCard: React.FC<BreedingResultCardProps> = ({
  child,
  onOpenChild,
  onStay,
}) => (
  <div className="breeding-result-card" role="status">
    <span>OFFSPRING SAVED</span>
    <strong>{child.name}</strong>
    <p>
      GEN {child.lineage.generation} · STACK · {child.currentGenome.components.length} components
      {' · '}{child.acquiredTraits.length} inherited traits
    </p>
    <div className="breeding-result-actions">
      <button type="button" onClick={onOpenChild}>OPEN CHILD</button>
      <button type="button" onClick={onStay}>STAY HERE</button>
    </div>
  </div>
);

export default BreedingResultCard;
