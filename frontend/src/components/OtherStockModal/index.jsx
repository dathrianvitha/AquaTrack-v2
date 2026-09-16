import React, { useState, useEffect } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';

const CATEGORY_OPTIONS = [
  { value: 'Motors', label: 'Motors' },
  { value: 'Aerators', label: 'Aerators' },
  { value: 'Spare Parts', label: 'Spare Parts' },
  { value: 'Generators', label: 'Generators' },
];

/**
 * OtherStockModal component for adding/editing farm-level equipment/parts inventory.
 * Contains ONLY Category and Count fields. No site/tank/crop/batch/unit fields.
 */
export const OtherStockModal = ({
  isOpen = false,
  onClose,
  onSubmit,
  initialData = null,
  isSubmitting = false
}) => {
  const [category, setCategory] = useState('Motors');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setCategory(initialData.category || 'Motors');
        setCount(String(initialData.count ?? ''));
        setNotes(initialData.notes || '');
      } else {
        setCategory('Motors');
        setCount('');
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, initialData]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!category) {
      setError('Please select a category.');
      return;
    }

    const numericCount = Number(count);
    if (!count || isNaN(numericCount) || !Number.isInteger(numericCount) || numericCount <= 0) {
      setError('Count must be a positive whole number (greater than 0).');
      return;
    }

    setError('');
    try {
      await onSubmit({
        category,
        count: numericCount,
        notes: notes.trim()
      });
    } catch (err) {
      setError(err?.message || 'Failed to save Other Stock.');
    }
  };

  const isEdit = Boolean(initialData);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Other Stock' : 'Add Other Stock'}
      description="Farm-level equipment and spare parts inventory."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 bg-danger-light text-danger rounded-lg text-xs font-medium border border-danger/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <Select
          label="Category"
          required
          options={CATEGORY_OPTIONS}
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={isSubmitting}
        />

        <Input
          label="Count"
          type="number"
          min="1"
          step="1"
          required
          placeholder="e.g. 5"
          value={count}
          onChange={(e) => {
            const val = e.target.value;
            // Reject decimal points explicitly if typed
            if (!val.includes('.')) {
              setCount(val);
            }
          }}
          disabled={isSubmitting}
          helperText="Number of physical items (positive whole numbers only)."
        />

        <Input
          label="Notes"
          type="text"
          placeholder="e.g. Brand, specs, location, or serial number (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={isSubmitting}
          helperText="Optional details or comments."
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting}
            isLoading={isSubmitting}
          >
            {isEdit ? 'Update Stock' : 'Add Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default OtherStockModal;
