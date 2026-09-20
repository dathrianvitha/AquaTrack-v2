import React, { useState, useEffect } from 'react';
import { ArrowRightLeft, AlertCircle, Wrench } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';

const CATEGORY_OPTIONS = ['Generators', 'Spare Parts', 'Aerators', 'Motors'];

export function OtherStockTransferModal({
  isOpen,
  onClose,
  onSubmit,
  fromSite,
  availableSites = [],
  siteOtherStockList = [], // Array of all Other Stock records at source site or across farm
  initialCategory = 'Generators',
  isSubmitting = false
}) {
  const [category, setCategory] = useState('Generators');
  const [toSiteId, setToSiteId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Destination sites excluding the source site
  const destinationSites = availableSites.filter(
    (s) => String(s.id) !== String(fromSite?.id)
  );

  // Determine available stock count for the selected category at the source site
  const availableCount = siteOtherStockList
    .filter(
      (item) =>
        (item.siteId && String(item.siteId) === String(fromSite?.id)) ||
        (item.site?.id && String(item.site.id) === String(fromSite?.id))
    )
    .filter((item) => item.category === category)
    .reduce((sum, item) => sum + (parseInt(item.count, 10) || 0), 0);

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setQuantity('');
      setCategory(initialCategory || 'Generators');
      // To Site MUST NOT be automatically selected. Initially empty.
      setToSiteId('');
    }
  }, [isOpen, fromSite?.id, initialCategory]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!toSiteId) {
      setErrorMsg('Please select a destination site.');
      return;
    }

    const numQty = Number(quantity);
    if (!quantity || isNaN(numQty) || !Number.isInteger(numQty) || numQty <= 0) {
      setErrorMsg('Transfer quantity must be a positive whole number (greater than 0).');
      return;
    }

    if (availableCount <= 0) {
      setErrorMsg(`No ${category} stock available to transfer at ${fromSite?.siteName || 'source site'}.`);
      return;
    }

    if (numQty > availableCount) {
      setErrorMsg(
        `Insufficient ${category} stock. Only ${availableCount} items available for transfer.`
      );
      return;
    }

    try {
      await onSubmit({
        fromSiteId: String(fromSite.id),
        toSiteId: String(toSiteId),
        category,
        count: numQty,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete stock transfer.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Other Stock"
      description="Transfer equipment and spare parts inventory between sites."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3 bg-danger-light text-danger rounded-xl text-xs font-medium border border-danger/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. TRANSFER CATEGORY SELECTOR */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary tracking-wide block select-none">
            Category <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {CATEGORY_OPTIONS.map((cat) => {
              const isSelected = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setCategory(cat);
                    setErrorMsg('');
                  }}
                  className={`
                    p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-xs font-bold transition-all cursor-pointer text-center
                    ${isSelected
                      ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-2xs ring-1 ring-teal-500/20'
                      : 'bg-surface border-border text-text-secondary hover:border-text-secondary/40'
                    }
                  `}
                >
                  <Wrench className={`w-3.5 h-3.5 ${isSelected ? 'text-teal-600' : 'text-text-secondary'}`} />
                  <span className="truncate w-full text-[11px]">{cat}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. FROM SITE (READ-ONLY) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary tracking-wide block select-none">
            From Site <span className="text-danger">*</span>
          </label>
          <input
            type="text"
            readOnly
            disabled
            value={fromSite?.siteName || ''}
            className="w-full bg-background text-text-primary text-sm rounded-lg border border-border/70 px-3.5 py-2.5 font-medium cursor-not-allowed opacity-80"
          />
        </div>

        {/* 3. TO SITE DROPDOWN */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary tracking-wide block select-none">
            To Site <span className="text-danger">*</span>
          </label>
          {destinationSites.length === 0 ? (
            <div className="p-3 bg-amber-50 text-amber-900 rounded-lg border border-amber-200 text-xs font-medium">
              No other sites available to transfer stock to. You need at least 2 sites.
            </div>
          ) : (
            <select
              value={toSiteId}
              onChange={(e) => {
                setToSiteId(e.target.value);
                setErrorMsg('');
              }}
              required
              className="w-full bg-surface text-text-primary text-sm rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-3.5 py-2.5 font-medium transition-all focus:outline-none"
            >
              <option value="">Select destination site...</option>
              {destinationSites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.siteName} {site.location ? `(${site.location})` : ''}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* 4. AVAILABLE STOCK DISPLAY */}
        <div className="p-3 rounded-xl bg-primary-light/30 border border-primary/20 flex items-center justify-between text-xs">
          <span className="font-semibold text-text-secondary uppercase text-[10px]">
            Available {category}:
          </span>
          <span className={`font-extrabold text-sm ${availableCount > 0 ? 'text-emerald-700' : 'text-danger'}`}>
            {availableCount > 0
              ? `${availableCount} items`
              : `No ${category} available at source site.`
            }
          </span>
        </div>

        {/* 5. TRANSFER QUANTITY INPUT */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary tracking-wide block select-none">
            Transfer Quantity <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            min="1"
            max={availableCount > 0 ? availableCount : undefined}
            step="1"
            required
            disabled={availableCount <= 0 || destinationSites.length === 0}
            placeholder="Enter quantity"
            value={quantity}
            onChange={(e) => {
              const val = e.target.value;
              if (!val.includes('.')) {
                setQuantity(val);
                setErrorMsg('');
              }
            }}
            className="w-full bg-surface text-text-primary placeholder:text-text-secondary/60 text-sm rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 px-3.5 py-2.5 transition-all focus:outline-none disabled:bg-background disabled:opacity-60 disabled:cursor-not-allowed"
          />
          <span className="text-[10px] text-text-secondary block">
            Must be a positive whole number (e.g. 1, 5, 10).
          </span>
        </div>

        {/* 6. MODAL ACTIONS */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
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
            icon={<ArrowRightLeft className="w-4 h-4" />}
            disabled={isSubmitting || availableCount <= 0 || destinationSites.length === 0}
            className="font-semibold shadow-xs"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default OtherStockTransferModal;
