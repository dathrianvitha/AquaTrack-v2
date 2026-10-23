import React, { useState, useEffect } from 'react';
import { Package, AlertCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { Input } from '../Input';
import { Select } from '../Select';
import { Button } from '../Button';
import {
  OTHER_STOCK_CATEGORY_OPTIONS,
  OTHER_STOCK_SUBCATEGORIES,
  normalizeOtherStockCategory
} from '../../constants/otherStockCategories';

/**
 * OtherStockModal component for adding/editing farm-level equipment/parts inventory.
 * Supports dynamic Subcategories for Water Pumping Motor, Aerators, Generators, Rig Bore, and Small Bore.
 * Preserves Notes for all categories.
 */
export const OtherStockModal = ({
  isOpen = false,
  onClose,
  onSubmit,
  initialData = null,
  sites = [],
  isSubmitting = false
}) => {
  const [category, setCategory] = useState('Water Pumping Motor');
  const [subcategory, setSubcategory] = useState('');
  const [siteId, setSiteId] = useState('');
  const [count, setCount] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const isEdit = Boolean(initialData);

  // Subcategory options for currently selected category
  const subcategoryList = OTHER_STOCK_SUBCATEGORIES[category] || [];
  const subcategoryOptions = subcategoryList.map((sub) => ({
    value: sub,
    label: sub
  }));
  const hasSubcategories = subcategoryOptions.length > 0;

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        const normCat = normalizeOtherStockCategory(initialData.category || 'Water Pumping Motor');
        setCategory(normCat);
        setSubcategory(initialData.subcategory || '');
        setSiteId(initialData.siteId || initialData.site?.id || (sites.length > 0 ? String(sites[0].id) : ''));
        setCount(String(initialData.count ?? ''));
        setNotes(initialData.notes || '');
      } else {
        setCategory('Water Pumping Motor');
        setSubcategory('');
        setSiteId(sites.length > 0 ? String(sites[0].id) : '');
        setCount('');
        setNotes('');
      }
      setError('');
    }
  }, [isOpen, initialData, sites]);

  const handleCategoryChange = (e) => {
    const newCategory = e.target.value;
    setCategory(newCategory);
    // Requirement: Clear previous subcategory when main category changes
    setSubcategory('');
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!category) {
      setError('Please select a category.');
      return;
    }

    if (hasSubcategories && !subcategory) {
      setError(`Please select a Subcategory for ${category}.`);
      return;
    }

    const numericCount = Number(count);
    if (!count || isNaN(numericCount) || !Number.isInteger(numericCount) || numericCount <= 0) {
      setError('Count must be a positive whole number (greater than 0).');
      return;
    }

    setError('');
    try {
      const trimmedNotes = notes.trim();
      // Requirement: Preserve notes during edits if user did not change them; do not accidentally wipe out
      const finalNotes = trimmedNotes ? trimmedNotes : (isEdit ? (initialData?.notes || null) : null);

      await onSubmit({
        category,
        subcategory: hasSubcategories ? subcategory : null,
        siteId: siteId || null,
        count: numericCount,
        notes: finalNotes
      });
    } catch (err) {
      setError(err?.message || 'Failed to save Other Stock.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Other Stock' : 'Add Other Stock'}
      description="Farm and site-level equipment and spare parts inventory."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {error && (
          <div className="p-3 bg-danger-light text-danger rounded-lg text-xs font-medium border border-danger/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {sites.length > 0 && (
          <Select
            label="Site"
            options={sites.map((s) => ({ value: String(s.id), label: s.siteName }))}
            value={siteId}
            onChange={(e) => setSiteId(e.target.value)}
            disabled={isSubmitting}
          />
        )}

        <Select
          label="Category"
          required
          options={OTHER_STOCK_CATEGORY_OPTIONS}
          value={category}
          onChange={handleCategoryChange}
          disabled={isSubmitting}
        />

        {/* Dynamic Subcategory Dropdown: Visible ONLY for Water Pumping Motor, Aerators, Generators */}
        {hasSubcategories && (
          <Select
            label="Subcategory"
            required
            placeholder={`Select ${category} subcategory...`}
            options={subcategoryOptions}
            value={subcategory}
            onChange={(e) => {
              setSubcategory(e.target.value);
              setError('');
            }}
            disabled={isSubmitting}
          />
        )}

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

        {/* Notes field: Available for ALL five categories */}
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
