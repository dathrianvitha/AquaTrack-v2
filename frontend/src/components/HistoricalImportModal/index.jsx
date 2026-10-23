import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Info,
  ArrowRight,
  RefreshCw,
  X,
  Building,
  Download,
  ListFilter,
  Search,
  EyeOff,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Modal } from '../Modal';
import { Button } from '../Button';
import { Badge } from '../Badge';
import { Loader } from '../Loader';
import { historicalRecordService } from '../../services/historicalRecordService';

export const HistoricalImportModal = ({
  isOpen,
  onClose,
  onImportSuccess,
  sites = []
}) => {
  const [file, setFile] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [areaMappings, setAreaMappings] = useState({});
  const [userNotes, setUserNotes] = useState('');
  const [error, setError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  // Skipped rows inspection state
  const [showSkippedView, setShowSkippedView] = useState(false);
  const [skippedFilterQuery, setSkippedFilterQuery] = useState('');

  const fileInputRef = useRef(null);

  const resetState = () => {
    setFile(null);
    setIsAnalyzing(false);
    setPreviewData(null);
    setAreaMappings({});
    setUserNotes('');
    setError('');
    setIsImporting(false);
    setImportResult(null);
    setShowSkippedView(false);
    setSkippedFilterQuery('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleFileSelect = async (selectedFile) => {
    if (!selectedFile) return;

    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
      setError('Invalid file type. Please upload an Excel (.xlsx, .xls) or CSV (.csv) file.');
      return;
    }

    setFile(selectedFile);
    setError('');
    setIsAnalyzing(true);
    setPreviewData(null);
    setAreaMappings({});
    setImportResult(null);
    setShowSkippedView(false);

    try {
      const response = await historicalRecordService.previewHistoricalFile(selectedFile);
      if (response?.data) {
        setPreviewData(response.data);

        // Pre-fill default mappings for any unmapped areas that have clean suggestions
        const initialMappings = {};
        if (response.data.unmappedAreas) {
          response.data.unmappedAreas.forEach(({ areaName }) => {
            const matched = sites.find(
              (s) => s.siteName.toLowerCase().trim() === areaName.toLowerCase().trim()
            );
            if (matched) {
              initialMappings[areaName] = matched.id;
            }
          });
        }
        setAreaMappings(initialMappings);
      } else {
        setError('Failed to analyze file preview.');
      }
    } catch (err) {
      console.error('File preview error:', err);
      setError(err.message || 'Error parsing the workbook. Please check the file structure.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleMappingChange = (areaName, targetSiteId) => {
    setAreaMappings((prev) => ({
      ...prev,
      [areaName]: targetSiteId
    }));
  };

  const handleConfirmImport = async () => {
    if (!file) return;

    // Verify all unmapped areas are addressed (either mapped to a site or set to skip)
    if (previewData?.unmappedAreas && previewData.unmappedAreas.length > 0) {
      const unassigned = previewData.unmappedAreas.filter(
        ({ areaName }) => !areaMappings[areaName]
      );
      if (unassigned.length > 0) {
        setError(
          `Please resolve all unmapped areas before importing. Assign them to a site or choose "Skip". (${unassigned.length} remaining)`
        );
        return;
      }
    }

    setIsImporting(true);
    setError('');

    try {
      const result = await historicalRecordService.importHistoricalRecords(
        file,
        areaMappings,
        userNotes
      );

      setImportResult(result.data);
      if (onImportSuccess) {
        onImportSuccess(result.data);
      }
    } catch (err) {
      console.error('Import error:', err);
      setError(err.message || 'Failed to save imported records. Please try again.');
    } finally {
      setIsImporting(false);
    }
  };

  // Helper to download skipped rows as a CSV file
  const downloadSkippedRowsCSV = (skippedList, baseFileName = 'skipped_rows') => {
    if (!skippedList || skippedList.length === 0) return;

    const headers = [
      'Row Number',
      'Skip Reason',
      'Date',
      'Area',
      'Category / Expense',
      'Amt Paid',
      'Credit',
      'Remarks'
    ];

    const csvLines = [
      headers.map((h) => `"${h}"`).join(','),
      ...skippedList.map((r) =>
        [
          r.rowNumber || '',
          `"${String(r.reason || '').replace(/"/g, '""')}"`,
          `"${String(r.rawDate || '').replace(/"/g, '""')}"`,
          `"${String(r.area || '').replace(/"/g, '""')}"`,
          `"${String(r.category || '').replace(/"/g, '""')}"`,
          r.amtPaid || 0,
          r.credit || 0,
          `"${String(r.remarks || '').replace(/"/g, '""')}"`
        ].join(',')
      )
    ];

    const blob = new Blob([csvLines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const cleanName = (baseFileName || 'historical_import').replace(/\.[^/.]+$/, '');
    link.download = `${cleanName}_skipped_rows.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Active list of skipped rows to display
  const activeSkippedRows = importResult?.skippedRows || previewData?.skippedRows || [];
  const filteredSkippedRows = activeSkippedRows.filter((r) => {
    if (!skippedFilterQuery) return true;
    const q = skippedFilterQuery.toLowerCase();
    return (
      String(r.rowNumber).includes(q) ||
      String(r.reason || '').toLowerCase().includes(q) ||
      String(r.area || '').toLowerCase().includes(q) ||
      String(r.category || '').toLowerCase().includes(q)
    );
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Historical Records"
      description="Import, map, and inspect historical expense records from Excel or CSV files"
      size="full"
      closeOnBackdrop={!isImporting}
    >
      <div className="space-y-6">
        {/* Error Alert */}
        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold">Import Issue</p>
              <p className="mt-0.5 text-xs text-red-400">{error}</p>
            </div>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Step 1: Upload Dropzone */}
        {!file && (
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200
              ${
                isDragging
                  ? 'border-primary bg-primary/5 scale-[0.99]'
                  : 'border-border hover:border-primary/50 hover:bg-surface/50'
              }
            `}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => handleFileSelect(e.target.files[0])}
            />
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 shadow-inner">
              <UploadCloud className="w-8 h-8" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">
              Choose an Excel or CSV file to import
            </h3>
            <p className="text-xs text-text-secondary mt-1.5 max-w-sm mx-auto">
              Drag and drop your spreadsheet (.xlsx, .csv) here or click to browse from your device.
            </p>
          </div>
        )}

        {/* Analyzing Spinner */}
        {isAnalyzing && (
          <div className="py-12 text-center space-y-4">
            <div className="w-12 h-12 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto" />
            <div>
              <p className="text-sm font-medium text-text-primary">Analyzing Workbook...</p>
              <p className="text-xs text-text-secondary mt-1">
                Reading expenditure sheets, validating dates, and matching sites...
              </p>
            </div>
          </div>
        )}

        {/* Step 2: Preview & Configuration */}
        {previewData && !importResult && !isAnalyzing && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* File Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl bg-surface border border-border">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-text-primary text-sm">{previewData.fileName}</span>
                    <Badge variant="outline" className="text-[10px]">
                      Sheet: {previewData.sheetName}
                    </Badge>
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5">
                    Total rows detected in sheet: {previewData.totalRows.toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={resetState}
                className="text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                Select Another File
              </Button>
            </div>

            {/* Duplicate File Warning */}
            {previewData.isDuplicate && (
              <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm">Duplicate File Detected</p>
                  <p className="mt-0.5 text-amber-400">
                    This file has the exact same content hash as a previously imported batch (
                    <span className="font-medium text-amber-300">
                      {previewData.previousImport?.recordCount} records imported on{' '}
                      {new Date(previewData.previousImport?.createdAt).toLocaleDateString()}
                    </span>
                    ). Re-importing will create duplicate expense entries unless previous records are deleted.
                  </p>
                </div>
              </div>
            )}

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-xs text-text-secondary">Total Detected Rows</div>
                <div className="text-2xl font-bold text-text-primary mt-1">
                  {previewData.totalRows.toLocaleString()}
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  All worksheet rows scanned
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-xs text-text-secondary">Valid Expense Records</div>
                <div className="text-2xl font-bold text-primary mt-1">
                  {previewData.validRecordCount.toLocaleString()}
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  Ready to store as individual expenses
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-xs text-text-secondary">Total Expense Amount</div>
                <div className="text-2xl font-bold text-emerald-500 mt-1">
                  ₹{Number(previewData.totalAmount || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[11px] text-text-muted mt-1">
                  Sum of valid historical amounts
                </div>
              </div>

              <div className="p-4 rounded-xl bg-surface border border-border">
                <div className="text-xs text-text-secondary">Skipped Rows</div>
                <div className="text-2xl font-bold text-amber-500 mt-1">
                  {previewData.skippedRowCount.toLocaleString()}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowSkippedView(!showSkippedView)}
                    className="text-[11px] text-primary hover:underline font-medium flex items-center gap-0.5"
                  >
                    <span>{showSkippedView ? 'Hide details' : 'Inspect reasons'}</span>
                    {showSkippedView ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>
              </div>
            </div>

            {/* Inspect Skipped Rows Section */}
            {showSkippedView && (
              <div className="p-4 rounded-2xl bg-surface border border-amber-500/30 space-y-3 animate-in fade-in duration-150">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <ListFilter className="w-4 h-4 text-amber-500" />
                      <span>Skipped Rows Breakdown ({activeSkippedRows.length} rows)</span>
                    </h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Review the actual validation reasons why each row was not included as an expense.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadSkippedRowsCSV(activeSkippedRows, previewData.fileName)}
                      className="text-xs gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download Skipped Rows CSV</span>
                    </Button>
                  </div>
                </div>

                {/* Filter search in skipped rows */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                  <input
                    type="text"
                    placeholder="Filter skipped rows by reason, row number, or area..."
                    value={skippedFilterQuery}
                    onChange={(e) => setSkippedFilterQuery(e.target.value)}
                    className="w-full text-xs pl-8 pr-3 py-1.5 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                  />
                </div>

                <div className="max-h-56 overflow-y-auto rounded-xl border border-border bg-background aqua-scrollbar">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface/80 border-b border-border text-text-secondary sticky top-0">
                        <th className="px-3 py-2 w-16">Row #</th>
                        <th className="px-3 py-2">Validation / Skip Reason</th>
                        <th className="px-3 py-2">Area</th>
                        <th className="px-3 py-2">Category / Notes</th>
                        <th className="px-3 py-2 text-right">Amt / Credit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredSkippedRows.slice(0, 100).map((row, idx) => (
                        <tr key={idx} className="hover:bg-surface/50">
                          <td className="px-3 py-2 font-mono font-semibold text-text-secondary">
                            #{row.rowNumber}
                          </td>
                          <td className="px-3 py-2">
                            <span className="text-[11px] font-medium text-amber-500">
                              {row.reason}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-text-secondary font-mono text-[11px]">
                            {row.area || '-'}
                          </td>
                          <td className="px-3 py-2 text-text-muted truncate max-w-xs" title={row.category}>
                            {row.category || '-'}
                          </td>
                          <td className="px-3 py-2 text-right whitespace-nowrap text-text-secondary">
                            {row.credit > 0 ? (
                              <span className="text-emerald-500 font-medium">Credit ₹{row.credit}</span>
                            ) : row.amtPaid > 0 ? (
                              `₹${row.amtPaid}`
                            ) : (
                              '₹0'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredSkippedRows.length > 100 && (
                    <div className="p-2 text-center text-[11px] text-text-muted bg-surface/50 border-t border-border">
                      Showing first 100 of {filteredSkippedRows.length} skipped rows. Download CSV to inspect all rows.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Unmapped Areas Resolver */}
            {previewData.unmappedAreas && previewData.unmappedAreas.length > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/5 border border-amber-500/30 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                    <Building className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-text-primary">
                      Site Mapping Required ({previewData.unmappedAreas.length} Unmatched Areas)
                    </h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      The following areas in the workbook cannot be confidently auto-assigned to an existing site.
                      Please map each area to an active AquaTrack site, or choose to skip it.
                    </p>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  {previewData.unmappedAreas.map(({ areaName, count }) => (
                    <div
                      key={areaName}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-surface border border-border/80"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-background border border-border text-text-primary">
                          {areaName}
                        </span>
                        <span className="text-xs text-text-secondary">
                          ({count} {count === 1 ? 'transaction' : 'transactions'})
                        </span>
                      </div>

                      <div className="flex items-center gap-2 sm:w-72">
                        <select
                          value={areaMappings[areaName] || ''}
                          onChange={(e) => handleMappingChange(areaName, e.target.value)}
                          className="w-full text-xs px-3 py-2 rounded-lg bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
                        >
                          <option value="">-- Select Target Site --</option>
                          <option value="skip" className="text-amber-500 font-medium">
                            Skip this area (do not import)
                          </option>
                          <optgroup label="AquaTrack Sites">
                            {sites.map((site) => (
                              <option key={site.id} value={site.id}>
                                {site.siteName} {site.location ? `(${site.location})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sample Parsed Records Table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs text-text-secondary px-1">
                <span className="font-semibold text-text-primary">Sample Parsed Transactions (First 10)</span>
                <span>Values mapped from source sheet</span>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border bg-surface">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-background/80 border-b border-border text-text-secondary">
                      <th className="px-3 py-2.5">Date</th>
                      <th className="px-3 py-2.5">Source Area</th>
                      <th className="px-3 py-2.5">Assigned Site</th>
                      <th className="px-3 py-2.5 text-right">Amount</th>
                      <th className="px-3 py-2.5">Preserved Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {previewData.sampleRecords?.slice(0, 10).map((record, idx) => {
                      const isUnmapped = !record.isMapped && !areaMappings[record.rawArea];
                      return (
                        <tr key={idx} className="hover:bg-primary-light/20">
                          <td className="px-3 py-2 whitespace-nowrap font-medium text-text-primary">
                            {record.date}
                          </td>
                          <td className="px-3 py-2 font-mono text-[11px] text-text-secondary">
                            {record.rawArea || '-'}
                          </td>
                          <td className="px-3 py-2">
                            {isUnmapped ? (
                              <span className="text-amber-500 font-medium">Action Required</span>
                            ) : (
                              <span className="text-text-primary font-medium">
                                {record.siteName !== 'Unmapped'
                                  ? record.siteName
                                  : sites.find((s) => s.id === areaMappings[record.rawArea])?.siteName ||
                                    'Skipped'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-text-primary whitespace-nowrap">
                            ₹{Number(record.amount).toLocaleString('en-IN')}
                          </td>
                          <td className="px-3 py-2 text-text-muted truncate max-w-xs" title={record.notes}>
                            {record.notes}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Optional Batch Notes */}
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">
                Import Batch Notes (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Historical expenses import"
                value={userNotes}
                onChange={(e) => setUserNotes(e.target.value)}
                className="w-full text-xs px-3.5 py-2 rounded-xl bg-background border border-border text-text-primary focus:outline-none focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* Step 3: Success Screen */}
        {importResult && (
          <div className="py-6 text-center space-y-6 animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-text-primary">Historical Records Imported!</h3>
              <p className="text-xs text-text-secondary mt-1">
                Your historical expense transactions have been saved to the database.
              </p>
            </div>

            {/* Import Summary Grid */}
            <div className="max-w-xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3 text-left">
              <div className="p-3.5 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-text-secondary">Imported Expenses</div>
                <div className="text-xl font-bold text-emerald-500 mt-0.5">
                  {importResult.importedCount?.toLocaleString()} records
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">Stored as individual records</div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-text-secondary">Total Amount</div>
                <div className="text-xl font-bold text-text-primary mt-0.5">
                  ₹{Number(importResult.totalAmount || 0).toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">Recorded historical sum</div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface border border-border">
                <div className="text-[11px] text-text-secondary">Skipped Rows</div>
                <div className="text-xl font-bold text-amber-500 mt-0.5">
                  {importResult.skippedCount?.toLocaleString()} rows
                </div>
                <div className="text-[10px] text-text-muted mt-0.5">Income/lookup/unmapped</div>
              </div>
            </div>

            {/* Post-Import Skipped Rows Controls */}
            {importResult.skippedRows && importResult.skippedRows.length > 0 && (
              <div className="max-w-xl mx-auto p-4 rounded-xl bg-surface border border-border text-left space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-semibold text-text-primary">
                      Inspect Skipped Rows ({importResult.skippedRows.length})
                    </h5>
                    <p className="text-[11px] text-text-secondary mt-0.5">
                      Review or export rows that were not imported as expenses.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => downloadSkippedRowsCSV(importResult.skippedRows, importResult.fileName)}
                    className="text-xs gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download Skipped CSV</span>
                  </Button>
                </div>

                <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-background p-2 aqua-scrollbar text-xs">
                  {importResult.skippedRows.slice(0, 20).map((r, i) => (
                    <div key={i} className="py-1 border-b border-border/40 last:border-0 flex items-center justify-between">
                      <span className="font-mono text-text-secondary">Row #{r.rowNumber}</span>
                      <span className="text-[11px] text-amber-500 font-medium truncate max-w-xs">{r.reason}</span>
                    </div>
                  ))}
                  {importResult.skippedRows.length > 20 && (
                    <div className="pt-2 text-center text-[10px] text-text-muted">
                      And {importResult.skippedRows.length - 20} more. Download CSV to inspect all.
                    </div>
                  )}
                </div>
              </div>
            )}

            <Button onClick={handleClose} className="px-8">
              View Historical Records
            </Button>
          </div>
        )}
      </div>

      {/* Modal Actions Footer */}
      {!importResult && previewData && !isAnalyzing && (
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={handleClose} disabled={isImporting}>
            Cancel
          </Button>
          <div className="flex items-center gap-3">
            <Button
              onClick={handleConfirmImport}
              isLoading={isImporting}
              disabled={isImporting}
              className="gap-2"
            >
              <span>Confirm & Import Records</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};

export default HistoricalImportModal;
