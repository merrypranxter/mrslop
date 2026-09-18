import React, { useMemo, useState } from 'react';
import type { BreedingPreview } from '../lib/breeding';
import { renderGeneticsReceipt } from '../lib/geneticsReceipt';

interface BreedingPreviewCardProps {
  preview: BreedingPreview;
  specimenNames?: Record<string, string>;
  onApprove: () => void;
  onCancel: () => void;
  error?: string | null;
  isSaving?: boolean;
}

const BreedingPreviewCard: React.FC<BreedingPreviewCardProps> = ({
  preview,
  specimenNames = {},
  onApprove,
  onCancel,
  error,
  isSaving = false,
}) => {
  const [showReceipt, setShowReceipt] = useState(false);
  const receiptText = useMemo(
    () => renderGeneticsReceipt(preview.receipt, specimenNames),
    [preview.receipt, specimenNames],
  );
  const parentA = specimenNames[preview.receipt.parentAId] ?? preview.receipt.parentAId;
  const parentB = specimenNames[preview.receipt.parentBId] ?? preview.receipt.parentBId;
  const mutation = preview.receipt.mutation.triggered
    ? preview.receipt.mutation.outcome
    : 'none';

  return (
    <div className="breeding-modal-backdrop">
      <section
        className="breeding-modal breeding-preview"
        role="dialog"
        aria-modal="true"
        aria-label="This creates offspring"
      >
        <span className="breeding-kicker">THIS CREATES OFFSPRING</span>
        <h2>{preview.child.name}</h2>
        <p className="breeding-copy">
          {parentA} × {parentB}. The child will be born STACK from the exact preview below.
        </p>

        <div className="breeding-preview-grid">
          <div>
            <strong>GENOME</strong>
            <span>{preview.child.currentGenome.components.length} components · STACK</span>
          </div>
          <div>
            <strong>TRAITS</strong>
            <span>{preview.child.acquiredTraits.length} inherited active</span>
          </div>
          <div>
            <strong>MUTATION</strong>
            <span>{mutation}</span>
          </div>
          <div>
            <strong>GENERATION</strong>
            <span>{preview.child.lineage.generation}</span>
          </div>
        </div>

        <button
          type="button"
          className="receipt-toggle"
          aria-label="Genetics receipt"
          aria-expanded={showReceipt}
          onClick={() => setShowReceipt(value => !value)}
        >
          {showReceipt ? 'HIDE RECEIPT' : 'SHOW RECEIPT'}
        </button>

        {showReceipt && (
          <pre className="genetics-receipt-view">{receiptText}</pre>
        )}

        {error && (
          <div className="breeding-error" role="alert">{error}</div>
        )}

        <div className="breeding-actions">
          <button
            type="button"
            className="breeding-primary"
            disabled={isSaving}
            onClick={onApprove}
          >
            {isSaving ? 'SAVING OFFSPRING…' : 'CREATE OFFSPRING'}
          </button>
          <button type="button" disabled={isSaving} onClick={onCancel}>CANCEL</button>
        </div>
      </section>
    </div>
  );
};

export default BreedingPreviewCard;
