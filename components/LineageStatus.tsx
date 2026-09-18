import React, { useState } from 'react';
import { calculateDrift } from '../lib/drift';
import { Specimen } from '../types';
import './ConversationUI.css';

interface LineageStatusProps {
  specimen: Specimen;
  specimenNames?: Record<string, string>;
}

const LineageStatus: React.FC<LineageStatusProps> = ({
  specimen,
  specimenNames = {},
}) => {
  const [open, setOpen] = useState(false);
  const report = calculateDrift(specimen);
  const experiencedScars = specimen.scars.filter(scar => scar.origin === 'experienced').length;
  const inheritedScars = specimen.scars.filter(scar => scar.origin === 'inherited').length;
  const inheritedTraits = specimen.acquiredTraits.filter(
    trait => trait.status === 'active' && (trait.inheritanceSources?.length ?? 0) > 0,
  ).length;
  const inheritedInfections = specimen.infections.filter(
    infection => infection.status === 'active' && (infection.inheritanceSources?.length ?? 0) > 0,
  ).length;

  const parentNames = specimen.lineage.parentSpecimenIds.map(
    id => specimenNames[id] || id,
  );
  const rootNames = specimen.lineage.rootSpecimenIds.map(
    id => specimenNames[id] || id,
  );

  return (
    <div className="lineage-status">
      <button
        type="button"
        className="lineage-status-toggle"
        aria-label="Lineage status"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        GEN {specimen.lineage.generation} · {specimen.scars.length} SCARS · DRIFT: {report.band}
      </button>

      {open && (
        <div className="lineage-status-panel">
          <strong>
            {parentNames.length === 0
              ? 'PARENT: ROOT'
              : \`\${parentNames.length === 1 ? 'PARENT' : 'PARENTS'}: \${parentNames.join(' × ')}\`}
          </strong>
          <span>{rootNames.length === 1 ? 'ROOT' : 'ROOTS'}: {rootNames.join(' · ')}</span>
          <span>GENERATION: {specimen.lineage.generation}</span>
          <p>{report.explanation}</p>
          <small>{experiencedScars} experienced scars · {inheritedScars} inherited scars</small>
          <small>{inheritedTraits} active inherited traits · {inheritedInfections} active inherited infections</small>
        </div>
      )}
    </div>
  );
};

export default LineageStatus;
