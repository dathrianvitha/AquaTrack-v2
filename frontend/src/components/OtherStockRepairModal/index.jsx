import React, { useState, useEffect } from 'react';
import { Wrench, RotateCcw, AlertCircle } from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Input } from '../Input';
import { Textarea } from '../Textarea';

export function OtherStockRepairModal({
  isOpen,
  onClose,
  onSubmit,
  mode = 'SEND', // 'SEND' (Move to Repair) or 'RETURN' (Return from Repair)
  item = null, // Selected OtherStock item
  isSubmitting = false
}) {
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const isSend = mode === 'SEND';

  useEffect(() => {
    if (isOpen) {
      setQuantity('');
      setNotes(item?.notes || '');
      setErrorMsg('');
    }
  }, [isOpen, item, mode]);

  const availableQty = item ? parseInt(item.count, 10) || 0 : 0;
  const underRepairQty = item ? parseInt(item.underRepair, 10) || 0 : 0;
  const category = item?.category || 'Item';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const numQty = Number(quantity);
    if (!quantity || isNaN(numQty) || !Number.isInteger(numQty) || numQty <= 0) {
      setErrorMsg('Quantity must be a positive whole number (greater than 0).');
      return;
    }

    if (isSend) {
      if (numQty > availableQty) {
        setErrorMsg(
          `Cannot send ${numQty} ${category} for repair. Only ${availableQty} currently available.`
        );
        return;
      }
    } else {
      if (numQty > underRepairQty) {
        setErrorMsg(
          `Cannot return ${numQty} ${category} from repair. Only ${underRepairQty} currently under repair.`
        );
        return;
      }
    }

    try {
      await onSubmit({ quantity: numQty, notes });
    } catch (err) {
      setErrorMsg(err.message || 'Action failed. Please try again.');
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isSend ? 'Move to Repair' : 'Return from Repair'}
      description={
        isSend
          ? `Send available ${category} items for repair.`
          : `Mark repaired ${category} items as returned to available stock.`
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {errorMsg && (
          <div className="p-3 bg-danger-light text-danger rounded-xl text-xs font-medium border border-danger/20 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="space-y-3">
          <div className="p-3 bg-background rounded-xl border border-border/60 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-text-secondary font-semibold">Category:</span>
              <span className="font-bold text-text-primary text-sm">{category}</span>
            </div>

            {isSend ? (
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-semibold">Available Quantity:</span>
                <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  {availableQty}
                </span>
              </div>
            ) : (
              <div className="flex justify-between items-center">
                <span className="text-text-secondary font-semibold">Under Repair Quantity:</span>
                <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {underRepairQty}
                </span>
              </div>
            )}
          </div>

          <Input
            label={isSend ? 'Quantity to Send for Repair *' : 'Quantity Returned *'}
            type="number"
            min="1"
            max={isSend ? availableQty : underRepairQty}
            step="1"
            required
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={isSend ? `Max ${availableQty}` : `Max ${underRepairQty}`}
          />

          <Textarea
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={
              isSend
                ? 'Describe the repair issue, motor condition, problem, etc.'
                : 'Describe the repair completed, condition after repair, etc.'
            }
            rows={3}
          />
        </div>

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
            disabled={isSubmitting}
            icon={isSend ? <Wrench className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
          >
            {isSubmitting
              ? isSend ? 'Sending...' : 'Updating...'
              : isSend ? 'Send to Repair' : 'Mark as Repaired'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
