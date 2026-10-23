import React, { useState, useEffect, useCallback } from 'react';
import {
  UploadCloud,
  Filter,
  RotateCcw,
  Search,
  Calendar,
  Building,
  FileSpreadsheet,
  Eye,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Info,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Layers,
  X
} from 'lucide-react';
import { PageHeader } from '../../components/PageHeader';
import { Button } from '../../components/Button';
import { Table } from '../../components/Table';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Loader } from '../../components/Loader';
import { HistoricalImportModal } from '../../components/HistoricalImportModal';
import { DeleteImportedRecordsModal } from '../../components/DeleteImportedRecordsModal';
import { historicalRecordService } from '../../services/historicalRecordService';
import { siteService } from '../../services/siteService';

export const HistoricalRecords = () => {
  // State for sites
  const [sites, setSites] = useState([]);
  const [isLoadingSites, setIsLoadingSites] = useState(false);

  // Filter state
  const [selectedSiteId, setSelectedSiteId] = useState('ALL');
  const [dateMode, setDateMode] = useState('range'); // 'specific' | 'range'
  const [specificDate, setSpecificDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  // Pagination & metrics state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [paginationInfo, setPaginationInfo] = useState({
    totalRecords: 0,
    totalPages: 1,
    totalAmount: 0,
    allTimeTotalRecords: 0,
    allTimeTotalAmount: 0
  });

  // Data & loading state
  const [records, setRecords] = useState([]);
  const [isLoadingRecords, setIsLoadingRecords] = useState(false);
  const [error, setError] = useState('');
  const [successNotification, setSuccessNotification] = useState('');

  // Modals state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteBatchModalOpen, setIsDeleteBatchModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [isDeletingRecord, setIsDeletingRecord] = useState(false);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Load user sites on mount
  useEffect(() => {
    const fetchSites = async () => {
      setIsLoadingSites(true);
      try {
        const response = await siteService.getSites();
        if (response?.data) {
          setSites(response.data);
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        setIsLoadingSites(false);
      }
    };
    fetchSites();
  }, []);

  // Fetch historical records based on active filters
  const fetchRecords = useCallback(async () => {
    setIsLoadingRecords(true);
    setError('');

    try {
      const params = {
        page: currentPage,
        limit: pageSize
      };

      if (selectedSiteId && selectedSiteId !== 'ALL') {
        params.siteId = selectedSiteId;
      }

      if (dateMode === 'specific' && specificDate) {
        params.date = specificDate;
      } else if (dateMode === 'range') {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }

      if (debouncedSearch && debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }

      const response = await historicalRecordService.getHistoricalRecords(params);
      if (response?.data) {
        setRecords(response.data);
        if (response.pagination) {
          setPaginationInfo({
            totalRecords: response.pagination.totalRecords,
            totalPages: response.pagination.totalPages,
            totalAmount: response.pagination.totalAmount,
            allTimeTotalRecords: response.pagination.allTimeTotalRecords || response.pagination.totalRecords,
            allTimeTotalAmount: response.pagination.allTimeTotalAmount || response.pagination.totalAmount
          });
        }
      }
    } catch (err) {
      console.error('Failed to fetch historical records:', err);
      setError(err.message || 'Failed to retrieve historical records.');
    } finally {
      setIsLoadingRecords(false);
    }
  }, [currentPage, pageSize, selectedSiteId, dateMode, specificDate, startDate, endDate, debouncedSearch]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Reset filters
  const handleResetFilters = () => {
    setSelectedSiteId('ALL');
    setDateMode('range');
    setSpecificDate('');
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    setDebouncedSearch('');
    setCurrentPage(1);
  };

  const hasActiveFilters =
    selectedSiteId !== 'ALL' ||
    (dateMode === 'specific' && specificDate) ||
    (dateMode === 'range' && (startDate || endDate)) ||
    debouncedSearch.length > 0;

  // Single record delete handler
  const handleConfirmDeleteRecord = async () => {
    if (!recordToDelete) return;

    setIsDeletingRecord(true);
    try {
      const res = await historicalRecordService.deleteHistoricalRecord(recordToDelete.id);
      setSuccessNotification(res.message || 'Record deleted successfully.');
      setRecordToDelete(null);
      await fetchRecords();
    } catch (err) {
      console.error('Failed to delete historical record:', err);
      setError(err.message || 'Failed to delete record.');
    } finally {
      setIsDeletingRecord(false);
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        timeZone: 'UTC'
      });
    } catch {
      return dateStr;
    }
  };

  // Table columns definition
  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (val) => (
        <span className="font-semibold text-text-primary whitespace-nowrap">
          {formatDate(val)}
        </span>
      )
    },
    {
      key: 'site',
      header: 'Site',
      render: (_, row) => (
        <div className="flex flex-col">
          <span className="font-medium text-text-primary">
            {row.site?.siteName || '-'}
          </span>
          {row.site?.location && (
            <span className="text-[11px] text-text-muted">
              {row.site.location}
            </span>
          )}
        </div>
      )
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      render: (val) => (
        <span className="font-bold text-text-primary whitespace-nowrap">
          ₹{Number(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'notes',
      header: 'Notes & Category Details',
      render: (val) => (
        <div className="max-w-md text-xs text-text-secondary truncate" title={val}>
          {val || '-'}
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      render: (_, row) => (
        <div className="flex items-center justify-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setSelectedRecord(row);
            }}
            className="h-8 w-8 p-0 text-text-secondary hover:text-primary hover:bg-primary/10 rounded-lg"
            title="View Details"
          >
            <Eye className="w-4 h-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              setRecordToDelete(row);
            }}
            className="h-8 w-8 p-0 text-text-secondary hover:text-red-500 hover:bg-red-500/10 rounded-lg"
            title="Delete Record"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <PageHeader
        title="Historical Records"
        description="View and search imported historical expense records from spreadsheets"
      >
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={() => setIsDeleteBatchModalOpen(true)}
            className="gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10 hover:border-red-500/50"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Imported Records</span>
          </Button>

          <Button
            onClick={() => setIsImportModalOpen(true)}
            className="gap-2 shadow-sm"
          >
            <UploadCloud className="w-4 h-4" />
            <span>Import Records</span>
          </Button>
        </div>
      </PageHeader>

      {/* Notifications */}
      {successNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">{successNotification}</span>
          </div>
          <button
            onClick={() => setSuccessNotification('')}
            className="text-emerald-400 hover:text-emerald-300 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
          <button
            onClick={() => setError('')}
            className="text-red-400 hover:text-red-300 p-0.5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Metrics / Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Total Filtered Records */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
          <div className="flex items-center justify-between text-text-secondary text-xs">
            <span>Total Filtered Records</span>
            <Layers className="w-4 h-4 text-primary" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-bold text-text-primary">
              {paginationInfo.totalRecords.toLocaleString()}
            </span>
            {hasActiveFilters && (
              <span className="text-xs font-normal text-text-muted">
                of {paginationInfo.allTimeTotalRecords?.toLocaleString() || 0} total
              </span>
            )}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {hasActiveFilters
              ? 'Matching active filters (site, date, or search)'
              : 'All historical records currently stored'}
          </div>
        </div>

        {/* Total Filtered Amount */}
        <div className="p-4 rounded-2xl bg-surface border border-border shadow-xs">
          <div className="flex items-center justify-between text-text-secondary text-xs">
            <span>Total Filtered Amount</span>
            <Receipt className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-500 mt-2">
            ₹{Number(paginationInfo.totalAmount || 0).toLocaleString('en-IN', {
              maximumFractionDigits: 0
            })}
          </div>
          <div className="text-[11px] text-text-muted mt-1">
            {hasActiveFilters
              ? 'Sum of currently filtered expense records'
              : 'Total cumulative historical expenditure'}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-4 rounded-2xl bg-surface border border-border space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
            <Filter className="w-4 h-4 text-primary" />
            <span>Filters</span>
            {hasActiveFilters && (
              <Badge variant="primary" className="text-[10px] ml-1">
                Active
              </Badge>
            )}
          </div>

          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              className="text-xs text-text-secondary hover:text-text-primary gap-1.5 h-8"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Site Filter */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Filter by Site
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => {
                setSelectedSiteId(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full text-xs px-3 py-2 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
            >
              <option value="ALL">All Sites</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.siteName} {site.location ? `(${site.location})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Date Mode Toggle & Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-text-secondary">
                Date Filter
              </label>
              <div className="flex items-center gap-1 text-[11px]">
                <button
                  type="button"
                  onClick={() => {
                    setDateMode('range');
                    setSpecificDate('');
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-0.5 rounded ${
                    dateMode === 'range'
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Range
                </button>
                <span className="text-text-muted">|</span>
                <button
                  type="button"
                  onClick={() => {
                    setDateMode('specific');
                    setStartDate('');
                    setEndDate('');
                    setCurrentPage(1);
                  }}
                  className={`px-1.5 py-0.5 rounded ${
                    dateMode === 'specific'
                      ? 'bg-primary/10 text-primary font-semibold'
                      : 'text-text-muted hover:text-text-secondary'
                  }`}
                >
                  Specific Date
                </button>
              </div>
            </div>

            {dateMode === 'specific' ? (
              <input
                type="date"
                value={specificDate}
                onChange={(e) => {
                  setSpecificDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs px-3 py-2 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  placeholder="From Date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs px-2.5 py-2 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                />
                <input
                  type="date"
                  placeholder="To Date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full text-xs px-2.5 py-2 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                />
              </div>
            )}
          </div>

          {/* Search Notes Filter */}
          <div className="sm:col-span-2 lg:col-span-2">
            <label className="block text-xs font-medium text-text-secondary mb-1">
              Search Details & Notes
            </label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                type="text"
                placeholder="Search category, remarks, or payer in notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:border-primary placeholder:text-text-muted"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Historical Expenses Table */}
      <div className="space-y-4">
        <Table
          columns={columns}
          data={records}
          isLoading={isLoadingRecords}
          emptyMessage="No historical expense records match your filters."
          onRowClick={(row) => setSelectedRecord(row)}
        />

        {/* Pagination Controls */}
        {paginationInfo.totalRecords > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 text-xs text-text-secondary">
            <div>
              Showing{' '}
              <span className="font-semibold text-text-primary">
                {(currentPage - 1) * pageSize + 1}
              </span>{' '}
              to{' '}
              <span className="font-semibold text-text-primary">
                {Math.min(currentPage * pageSize, paginationInfo.totalRecords)}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-text-primary">
                {paginationInfo.totalRecords.toLocaleString()}
              </span>{' '}
              filtered records
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span>Per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2 py-1 rounded-lg bg-surface border border-border text-text-primary focus:outline-none focus:border-primary"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage <= 1 || isLoadingRecords}
                  className="h-8 w-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <span className="px-2 font-medium text-text-primary">
                  {currentPage} / {paginationInfo.totalPages}
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(paginationInfo.totalPages, p + 1))}
                  disabled={currentPage >= paginationInfo.totalPages || isLoadingRecords}
                  className="h-8 w-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* View Record Details Modal */}
      {selectedRecord && (
        <Modal
          isOpen={Boolean(selectedRecord)}
          onClose={() => setSelectedRecord(null)}
          title="Historical Record Details"
          description="Detailed view of preserved historical expense entry"
          size="md"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-surface border border-border space-y-3">
              <div className="flex justify-between items-center text-xs border-b border-border/80 pb-2.5">
                <span className="text-text-secondary">Transaction Date</span>
                <span className="font-semibold text-text-primary">
                  {formatDate(selectedRecord.date)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-border/80 pb-2.5">
                <span className="text-text-secondary">Assigned Site</span>
                <span className="font-semibold text-text-primary">
                  {selectedRecord.site?.siteName || '-'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-border/80 pb-2.5">
                <span className="text-text-secondary">Site Location</span>
                <span className="text-text-primary">
                  {selectedRecord.site?.location || '-'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-border/80 pb-2.5">
                <span className="text-text-secondary">Expense Amount</span>
                <span className="text-base font-bold text-emerald-500">
                  ₹{Number(selectedRecord.amount || 0).toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs border-b border-border/80 pb-2.5">
                <span className="text-text-secondary">Source File</span>
                <span className="font-mono text-text-primary text-[11px]">
                  {selectedRecord.importBatch?.fileName || 'Historical Import'}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-text-secondary">Imported At</span>
                <span className="text-text-muted text-[11px]">
                  {selectedRecord.importBatch?.createdAt
                    ? new Date(selectedRecord.importBatch.createdAt).toLocaleString()
                    : '-'}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5">
                Preserved Expense Notes & Details
              </label>
              <div className="p-3.5 rounded-xl bg-background border border-border text-xs text-text-primary leading-relaxed whitespace-pre-wrap font-mono">
                {selectedRecord.notes || 'No additional notes'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Single Record Delete Confirmation Modal */}
      {recordToDelete && (
        <Modal
          isOpen={Boolean(recordToDelete)}
          onClose={() => setRecordToDelete(null)}
          title="Delete Historical Record"
          description="Confirm permanent deletion of this historical expense"
          size="sm"
          closeOnBackdrop={!isDeletingRecord}
        >
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-surface border border-border space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-text-secondary">Date:</span>
                <span className="font-semibold text-text-primary">{formatDate(recordToDelete.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Site:</span>
                <span className="font-semibold text-text-primary">{recordToDelete.site?.siteName || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Amount:</span>
                <span className="font-bold text-emerald-500">
                  ₹{Number(recordToDelete.amount || 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="pt-2 border-t border-border/60">
                <span className="text-[11px] text-text-muted block truncate" title={recordToDelete.notes}>
                  {recordToDelete.notes || '-'}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Permanent Deletion Warning</p>
                <p className="mt-0.5 text-red-400">
                  This will permanently delete this record from the historical database. Current live expenses and reports are not affected.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setRecordToDelete(null)}
                disabled={isDeletingRecord}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={handleConfirmDeleteRecord}
                isLoading={isDeletingRecord}
                disabled={isDeletingRecord}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Delete Record
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Batch Modal */}
      <DeleteImportedRecordsModal
        isOpen={isDeleteBatchModalOpen}
        onClose={() => setIsDeleteBatchModalOpen(false)}
        onDeleteSuccess={() => {
          setSuccessNotification('Import batch and all its records successfully deleted.');
          fetchRecords();
        }}
      />

      {/* Historical Import Modal */}
      <HistoricalImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        sites={sites}
        onImportSuccess={() => {
          setSuccessNotification('Historical records imported successfully.');
          fetchRecords();
        }}
      />
    </div>
  );
};

export default HistoricalRecords;
