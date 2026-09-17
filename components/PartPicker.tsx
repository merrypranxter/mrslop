import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, Sparkles } from 'lucide-react';
import { GenomeComponent, GenomeMode } from '../types';
import './PartPicker.css';

interface PartPickerProps {
  library: GenomeComponent[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onSpawn: (mode: GenomeMode) => void;
  onCancel: () => void;
}

const KIND_LABELS: Array<{ id: 'all' | GenomeComponent['kind']; label: string }> = [
  { id: 'all', label: 'ALL' },
  { id: 'mind', label: 'MIND' },
  { id: 'operator', label: 'OPERATOR' },
  { id: 'regulator', label: 'REGULATOR' },
  { id: 'seed', label: 'SEED' },
  { id: 'media', label: 'MEDIA' },
  { id: 'custom', label: 'CUSTOM' },
];

const PartPicker: React.FC<PartPickerProps> = ({
  library,
  selectedIds,
  onChange,
  onSpawn,
  onCancel,
}) => {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<'all' | GenomeComponent['kind']>('all');

  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const normalizedQuery = query.trim().toLowerCase();

  const visible = useMemo(() => library.filter(component => {
    if (kind !== 'all' && component.kind !== kind) return false;
    if (!normalizedQuery) return true;
    const haystack = [
      component.name,
      component.description,
      component.kind,
      component.tags.join(' '),
      component.roleHints.join(' '),
    ].join(' ').toLowerCase();
    return haystack.includes(normalizedQuery);
  }), [kind, library, normalizedQuery]);

  const selectedComponents = library.filter(component => selected.has(component.id));
  const totalWeight = selectedComponents.reduce((sum, component) => sum + component.charWeight, 0);
  const isHeavy = totalWeight > 40_000;

  const toggle = (id: string) => {
    if (selected.has(id)) {
      onChange(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <section className="part-picker" aria-label="Mr. Slop parts picker">
      <div className="part-picker-shell">
        <header className="part-picker-header">
          <button type="button" className="picker-back" onClick={onCancel} aria-label="Back to Build Me">
            <ArrowLeft size={17} />
          </button>
          <div>
            <div className="brand-kicker"><Sparkles size={13} /> GENOME SHELF</div>
            <h1>PICK THE PARTS</h1>
            <p>Choose as much weird machinery as you want. Nothing gets silently dropped.</p>
          </div>
        </header>

        <div className="picker-tools">
          <label className="picker-search">
            <Search size={16} aria-hidden="true" />
            <input
              type="search"
              placeholder="Search minds, operators, roles, tags..."
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </label>

          <div className="picker-filters" aria-label="Filter by kind">
            {KIND_LABELS.map(filter => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setKind(filter.id)}
                className={kind === filter.id ? 'active' : ''}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        <div className="picker-summary" aria-live="polite">
          <span><strong>{selectedIds.length}</strong> selected</span>
          <span className={isHeavy ? 'picker-weight warning' : 'picker-weight'}>
            <strong>{totalWeight.toLocaleString()}</strong> chars
          </span>
          {isHeavy && <em>LARGE KERNEL — FUSE may be easier on context.</em>}
        </div>

        <div className="part-grid">
          {visible.map(component => {
            const active = selected.has(component.id);
            return (
              <button
                type="button"
                key={component.id}
                aria-pressed={active}
                onClick={() => toggle(component.id)}
                className={`part-card part-kind-${component.kind} ${active ? 'part-selected' : ''}`}
              >
                <span className="part-card-topline">
                  <span>{component.kind.toUpperCase()}</span>
                  <span>{component.id}</span>
                </span>
                <strong>{component.name}</strong>
                <small>{component.description}</small>
                <span className="part-source">{component.sourcePath || component.sourceRepo || 'custom source'}</span>
                <span className="part-weight">{component.charWeight.toLocaleString()} chars</span>
              </button>
            );
          })}
          {visible.length === 0 && (
            <div className="picker-empty">Nothing on this shelf matches that.</div>
          )}
        </div>

        <footer className="picker-actions">
          <div>
            <strong>{selectedIds.length ? 'READY TO BUILD' : 'PICK AT LEAST ONE PART'}</strong>
            <small>STACK keeps the mechanisms separate. FUSE compiles them into one hybrid kernel.</small>
          </div>
          <div className="picker-spawn-buttons">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              className="spawn-stack"
              onClick={() => onSpawn('stack')}
            >
              SPAWN STACK
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              className="spawn-fuse"
              onClick={() => onSpawn('fuse')}
            >
              FUSE &amp; SPAWN
            </button>
          </div>
        </footer>
      </div>
    </section>
  );
};

export default PartPicker;
