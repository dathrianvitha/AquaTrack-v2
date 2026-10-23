import React, { useState, useEffect } from 'react';
import {
  Trash2,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
  Building,
  CheckCircle2,
  RefreshCw,
  X,
  Layers
} from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Loader } from '../Loader';
import { historicalRecordService } from '../../services/historicalRecordService';

export const DeleteImportedRecordsModal = ({
  isOpen,
  onClose,
  onDeleteSuccess
}) => {
  const [batches, setBatches] = useState([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState(false);
  const [selectedBatchId, setSelectedBatchId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Fetch batches when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchBatches();
      setSelectedBatchId(null);
      setError('');
      setSuccessMessage('');
    }
  }, [isOpen]);

  const fetchBatches = async () => {
    setIsLoadingBatches(true);
    setError('');
    try {
      const response = await historicalRecordService.getHistoricalBatches();
      if (response?.data) {
        setBatches(response.data);
      }
    } catch (err) {
      console.error('Failed to load batches:', err);
      setError(err.message || 'Failed to retrieve imported batches.');
    } finally {
      setIsLoadingBatches(false);
    }
  };

  const selectedBatch = batches.find((b) => b.id === selectedBatchId);

  const handleDelete = async () => {
    if (!selectedBatchId || !selectedBatch) return;

    setIsDeleting(true);
    setError('');

    try {
      const result = await historicalRecordService.deleteHistoricalBatch(selectedBatchId);
      setSuccessMessage(
        result.message ||
          `Successfully removed batch "${selectedBatch.fileName}" and all associated records.`
      );
      if (onDeleteSuccess) {
        onDeleteSuccess();
      }
      // Re-fetch batches list
      await fetchBatches();
      setSelectedBatchId(null);
    } catch (err) {
      console.error('Failed to delete batch:', err);
      setError(err.message || 'Failed to delete import batch. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Imported Records"
      description="Select and permanently remove an entire historical file import batch"
      size="lg"
      closeOnBackdrop={!isDeleting}
    >
      <div className="space-y-5">
        {/* Error Alert */}
        {error && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Deletion Error</p>
              <p className="mt-0.5 text-red-400">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Success Alert */}
        {successMessage && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <p className="font-medium">{successMessage}</p>
          </div>
        )}

        {/* Informative Guidance */}
        <div className="p-3.5 rounded-xl bg-surface border border-border text-xs text-text-secondary leading-relaxed">
          <p>
            Each file import is tracked as an isolated batch. Deleting a batch removes{' '}
            <strong className="text-text-primary">only the historical records created by that file</strong>.
            Other historical imports and current live expenses remain completely untouched.
          </p>
        </div>

        {/* Batches List */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-text-primary">
              Select Import Batch ({batches.length})
            </label>
            <Button
              variant="ghost"
              size="sm"
              onClick={fetchBatches}
              disabled={isLoadingBatches}
              className="h-7 text-xs text-text-secondary hover:text-text-primary gap-1"
            >
              <RefreshCw className={`w-3 h-3 ${isLoadingBatches ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </Button>
          </div>

          {isLoadingBatches ? (
            <div className="py-12 text-center">
              <Loader text="Loading import history..." />
            </div>
          ) : batches.length === 0 ? (
            <div className="p-8 text-center rounded-xl bg-surface border border-border/80">
              <FileSpreadsheet className="w-8 h-8 text-text-muted mx-auto mb-2" />
              <p className="text-xs font-medium text-text-primary">No imported batches found</p>
              <p className="text-[11px] text-text-secondary mt-0.5">
                Import historical expenses using the "Import Records" button.
              </p>
            </div>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-2.5 aqua-scrollbar pr-1">
              {batches.map((batch) => {
                const isSelected = selectedBatchId === batch.id;
                return (
                  <div
                    key={batch.id}
                    onClick={() => setSelectedBatchId(batch.id)}
                    className={`
                      p-3.5 rounded-xl border cursor-pointer transition-all duration-150
                      ${
                        isSelected
                          ? 'bg-red-500/5 border-red-500/40 shadow-xs'
                          : 'bg-surface border-border hover:border-border/80 hover:bg-surface/80'
                      }
                    `}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5">
                        <input
                          type="radio"
                          name="batchSelect"
                          checked={isSelected}
                          onChange={() => setSelectedBatchId(batch.id)}
                          className="mt-0.5 accent-red-500 cursor-pointer"
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-text-primary">
                              {batch.fileName}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {batch.currentRecordCount} records
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted mt-1">
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {formatDate(batch.importedAt)}
                            </span>
                            <span>•</span>
                            <span className="font-medium text-emerald-500">
                              ₹{Number(batch.totalAmount || 0).toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Sites covered */}
                    {batch.sitesCovered && batch.sitesCovered.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-border/60 flex flex-wrap items-center gap-1.5">
                        <span className="text-[10px] text-text-muted">Sites:</span>
                        {batch.sitesCovered.slice(0, 5).map((s, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] px-2 py-0.5 rounded-md bg-background border border-border text-text-secondary"
                          >
                            {s}
                          </span>
                        ))}
                        {batch.sitesCovered.length > 5 && (
                          <span className="text-[10px] text-text-muted">
                            +{batch.sitesCovered.length - 5} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Batch Deletion Warning */}
        {selectedBatch && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 space-y-2 animate-in fade-in duration-150">
            <div className="flex items-center gap-2 font-semibold text-xs text-red-400">
              <AlertTriangle className="w-4 h-4" />
              <span>Confirm Batch Deletion</span>
            </div>
            <p className="text-xs text-red-300 leading-relaxed">
              You have selected to delete <strong>{selectedBatch.fileName}</strong> containing{' '}
              <strong>{selectedBatch.currentRecordCount} records</strong> (₹
              {Number(selectedBatch.totalAmount || 0).toLocaleString('en-IN')}).
            </p>
            <p className="text-[11px] text-red-400 font-medium">
              ⚠️ This will permanently remove these records from the historical database. This cannot be undone.
            </p>
          </div>
        )}
      </div>

      {/* Modal Actions Footer */}
      <div className="flex items-center justify-between w-full pt-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isDeleting}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="sm"
          onClick={handleDelete}
          disabled={!selectedBatchId || isDeleting}
          isLoading={isDeleting}
          className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Permanently Delete Batch</span>
        </Button>
      </div>
    </Modal>
  );
};

export default DeleteImportedRecordsModal;
