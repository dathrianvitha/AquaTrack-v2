import React, { useState, useEffect } from 'react';
import { UtensilsCrossed, Stethoscope, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';

export function StockTransferModal({
  isOpen,
  onClose,
  onSubmit,
  fromSite,
  availableSites = [],
  siteStockInfo, // { feedRemaining, medicineRemaining, feedUnit, medicineUnit }
  isSubmitting = false
}) {
  const [category, setCategory] = useState('FEED');
  const [toSiteId, setToSiteId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Other sites excluding the source site
  const destinationSites = availableSites.filter(
    (s) => String(s.id) !== String(fromSite?.id)
  );

  // Determine available remaining stock for selected category at source site
  const availableQty = category === 'FEED'
    ? (siteStockInfo?.feedRemaining ?? 0)
    : (siteStockInfo?.medicineRemaining ?? 0);

  const unit = category === 'MEDICINE' ? 'L' : 'kg';

  // Reset modal state when opened
  useEffect(() => {
    if (isOpen) {
      setErrorMsg('');
      setQuantity('');

      // Default category preference: if FEED has stock, default FEED; else if MEDICINE has stock, MEDICINE
      if ((siteStockInfo?.feedRemaining ?? 0) > 0) {
        setCategory('FEED');
      } else if ((siteStockInfo?.medicineRemaining ?? 0) > 0) {
        setCategory('MEDICINE');
      } else {
        setCategory('FEED');
      }

      // Reset destination site selection to empty so user must explicitly choose
      setToSiteId('');
    }
  }, [isOpen, fromSite?.id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!toSiteId) {
      setErrorMsg('Please select a destination site.');
      return;
    }

    const numQty = parseFloat(quantity);
    if (isNaN(numQty) || numQty <= 0) {
      setErrorMsg('Transfer quantity must be greater than 0.');
      return;
    }

    if (availableQty <= 0) {
      setErrorMsg(`No ${category === 'FEED' ? 'Feed' : 'Medicine'} stock available to transfer.`);
      return;
    }

    if (numQty > availableQty) {
      setErrorMsg(
        `Insufficient ${category === 'FEED' ? 'Feed' : 'Medicine'} stock. Only ${availableQty} ${unit} is available for transfer.`
      );
      return;
    }

    try {
      await onSubmit({
        fromSiteId: String(fromSite.id),
        toSiteId: String(toSiteId),
        category,
        quantity: numQty,
      });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete stock transfer.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Transfer Stock"
      description="Transfer Feed or Medicine inventory between sites."
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3 bg-danger-light text-danger rounded-xl text-xs font-medium border border-danger/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 1. TRANSFER TYPE SELECTOR */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary tracking-wide block select-none">
            Transfer Type <span className="text-danger">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setCategory('FEED');
                setErrorMsg('');
              }}
              className={`
                p-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-bold transition-all cursor-pointer
                ${category === 'FEED'
                  ? 'bg-teal-50 border-teal-600 text-teal-900 shadow-2xs ring-1 ring-teal-500/20'
                  : 'bg-surface border-border text-text-secondary hover:border-text-secondary/40'
                }
              `}
            >
              <UtensilsCrossed className="w-4 h-4 text-teal-600" />
              <span>Feed Stock</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setCategory('MEDICINE');
                setErrorMsg('');
              }}
              className={`
                p-3 rounded-xl border flex items-center justify-center gap-2.5 text-xs font-bold transition-all cursor-pointer
                ${category === 'MEDICINE'
                  ? 'bg-cyan-50 border-cyan-600 text-cyan-900 shadow-2xs ring-1 ring-cyan-500/20'
                  : 'bg-surface border-border text-text-secondary hover:border-text-secondary/40'
                }
              `}
            >
              <Stethoscope className="w-4 h-4 text-cyan-600" />
              <span>Medicine Stock</span>
            </button>
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
            Available {category === 'FEED' ? 'Feed' : 'Medicine'} Stock:
          </span>
          <span className={`font-extrabold text-sm ${availableQty > 0 ? 'text-emerald-700' : 'text-danger'}`}>
            {availableQty > 0
              ? `${availableQty} ${unit}`
              : `No ${category === 'FEED' ? 'Feed' : 'Medicine'} stock available to transfer.`
            }
          </span>
        </div>

        {/* 5. TRANSFER QUANTITY INPUT */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-text-primary tracking-wide block select-none">
            Transfer Quantity ({unit}) <span className="text-danger">*</span>
          </label>
          <div className="relative flex items-center">
            <input
              type="number"
              min="0.01"
              max={availableQty > 0 ? availableQty : undefined}
              step="any"
              required
              disabled={availableQty <= 0 || destinationSites.length === 0}
              placeholder={`Enter quantity in ${unit}`}
              value={quantity}
              onChange={(e) => {
                setQuantity(e.target.value);
                setErrorMsg('');
              }}
              className="w-full bg-surface text-text-primary placeholder:text-text-secondary/60 text-sm rounded-lg border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 pl-3.5 pr-12 py-2.5 transition-all focus:outline-none disabled:bg-background disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <span className="absolute right-3 text-xs font-bold text-text-secondary pointer-events-none uppercase">
              {unit}
            </span>
          </div>
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
            disabled={isSubmitting || availableQty <= 0 || destinationSites.length === 0}
            className="font-semibold shadow-xs"
          >
            {isSubmitting ? 'Transferring...' : 'Transfer Stock'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default StockTransferModal;
