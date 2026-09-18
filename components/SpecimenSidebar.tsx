import React from 'react';
import { Beaker, Plus, Trash2, X } from 'lucide-react';
import { calculateDrift } from '../lib/drift';
import { Specimen } from '../types';
import './ConversationUI.css';

interface SpecimenSidebarProps {
  specimens: Specimen[];
  activeSpecimenId?: string | null;
  onOpen: (specimen: Specimen) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const formatTime = (timestamp: number) =>
  new Date(timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' });

const SpecimenSidebar: React.FC<SpecimenSidebarProps> = ({
  specimens,
  activeSpecimenId,
  onOpen,
  onNew,
  onDelete,
  onClose,
}) => (
  <div className="specimen-sidebar-backdrop" role="presentation">
    <aside className="specimen-sidebar" aria-label="Saved specimens">
      <header>
        <div>
          <span className="sidebar-kicker"><Beaker size={13} /> MY CREATURES</span>
          <strong>SAVED SPECIMENS</strong>
        </div>
        <button type="button" onClick={onClose} aria-label="Close specimens"><X size={18} /></button>
      </header>

      <button type="button" className="new-specimen-button" onClick={onNew}>
        <Plus size={15} /> BUILD ANOTHER MR. SLOP
      </button>

      <div className="specimen-list">
        {specimens.length === 0 && (
          <div className="specimen-list-empty">No specimens yet. Make a little freak first.</div>
        )}
        {[...specimens]
          .sort((a, b) => b.lastModified - a.lastModified)
          .map(specimen => (
            <div
              className={`specimen-row ${specimen.id === activeSpecimenId ? 'active' : ''}`}
              key={specimen.id}
            >
              <button type="button" className="specimen-open" onClick={() => onOpen(specimen)}>
                <strong>{specimen.name}</strong>
                <span>
                  {specimen.phase.toUpperCase()} · {specimen.currentGenome.mode.toUpperCase()} · {specimen.currentGenome.components.length} PARTS
                </span>
                <small>
                  GEN {specimen.lineage.generation} · {calculateDrift(specimen).band} DRIFT
                </small>
                <small>{formatTime(specimen.lastModified)}</small>
              </button>
              <button
                type="button"
                className="specimen-delete"
                aria-label={`Delete ${specimen.name}`}
                onClick={() => onDelete(specimen.id)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
      </div>
    </aside>
  </div>
);

export default SpecimenSidebar;
