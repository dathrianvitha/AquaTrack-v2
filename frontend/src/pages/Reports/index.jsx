import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PieChart as PieChartIcon,
  Utensils,
  Stethoscope,
  Receipt,
  DollarSign,
  Download,
  RefreshCw,
  Calendar,
  Landmark,
  Wheat,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend
} from 'recharts';

import { PageHeader } from '../../components/PageHeader';
import { Card, CardHeader, CardTitle, CardDescription, CardBody } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/EmptyState';
import { Loader } from '../../components/Loader';
import { getHarvestLevelLabel } from '../../components/HarvestCard';

import reportService from '../../services/reportService';
import { useTanks } from '../../context/TankContext';
import { useCrops } from '../../context/CropContext';

const CHART_COLORS = [
  '#0F766E', // Teal
  '#06B6D4', // Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#6366F1', // Indigo
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#3B82F6'  // Blue
];

export default function Reports() {
  const { tanks: contextTanks = [], loading: contextTanksLoading } = useTanks() || {};
  const { crops: contextCrops = [] } = useCrops() || {};

  const [tanks, setTanks] = useState([]);
  const [selectedTankId, setSelectedTankId] = useState('');
  const [reportType, setReportType] = useState('ACTIVE'); // 'ACTIVE' or 'COMPLETED'
  const [completedCrops, setCompletedCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState('');

  const [reportData, setReportData] = useState(null);
  const [loadingTanks, setLoadingTanks] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  // Combine context tanks with direct API tanks to guarantee dropdown never blanks
  const displayTanks = useMemo(() => {
    if (tanks && tanks.length > 0) return tanks;
    if (contextTanks && contextTanks.length > 0) return contextTanks;
    return [];
  }, [tanks, contextTanks]);

  // 1. Fetch Tanks list on initial mount and pick optimal starting tank
  const fetchTanks = useCallback(async () => {
    try {
      setLoadingTanks(true);
      setInfoMsg('');
      const tankList = await reportService.getReportTanks();
      const resolvedList = Array.isArray(tankList) && tankList.length > 0 ? tankList : contextTanks;
      setTanks(resolvedList);

      if (resolvedList && resolvedList.length > 0) {
        setSelectedTankId((prev) => {
          if (prev) return prev;
          return 'ALL';
        });
      }
    } catch (err) {
      console.error('Error fetching tanks for reports:', err);
      if (contextTanks && contextTanks.length > 0) {
        setTanks(contextTanks);
        setSelectedTankId((prev) => prev || 'ALL');
      } else {
        setTanks([]);
        setInfoMsg('Please create your farm profile and setup tanks to view reports.');
      }
    } finally {
      setLoadingTanks(false);
    }
  }, [contextTanks, contextCrops]);

  useEffect(() => {
    fetchTanks();
  }, [fetchTanks]);

  // Synchronize context tanks if direct tanks are not loaded yet
  useEffect(() => {
    if ((!tanks || tanks.length === 0) && contextTanks.length > 0) {
      setTanks(contextTanks);
      setSelectedTankId((prev) => prev || 'ALL');
    }
  }, [contextTanks, tanks]);

  // Identify crops for currently selected tank
  const selectedTankCrops = useMemo(() => {
    if (!selectedTankId || selectedTankId === 'ALL') return [];
    return (contextCrops || []).filter(
      (c) => String(c.tankId || c.tank?.id) === String(selectedTankId)
    );
  }, [contextCrops, selectedTankId]);

  const hasActiveBatchForSelectedTank = useMemo(() => {
    return selectedTankCrops.some(
      (c) => c.rawStatus === 'ACTIVE' || c.status === 'Active' || c.status === 'ACTIVE'
    );
  }, [selectedTankCrops]);

  // 2. Fetch Completed Crops List when tank changes
  useEffect(() => {
    let isMounted = true;
    async function fetchCompletedList() {
      if (!selectedTankId || selectedTankId === 'ALL') {
        setCompletedCrops([]);
        return;
      }
      try {
        const list = await reportService.getCompletedCrops(selectedTankId);
        if (!isMounted) return;

        const effectiveList = Array.isArray(list) && list.length > 0
          ? list
          : selectedTankCrops.filter(
              (c) => c.rawStatus === 'COMPLETED' || c.status === 'Completed' || c.status === 'COMPLETED'
            );

        setCompletedCrops(effectiveList);

        // Smart Mode Auto-Switching:
        // If tank has NO active crop batch, but HAS completed crops (like Tank A1), auto-select COMPLETED!
        if (!hasActiveBatchForSelectedTank && effectiveList.length > 0) {
          setReportType('COMPLETED');
          setSelectedCropId(effectiveList[0].id);
        } else if (hasActiveBatchForSelectedTank) {
          setReportType('ACTIVE');
          if (effectiveList.length > 0) {
            setSelectedCropId(effectiveList[0].id);
          }
        } else if (effectiveList.length > 0) {
          setSelectedCropId(effectiveList[0].id);
        } else {
          setSelectedCropId('');
        }
      } catch (err) {
        if (!isMounted) return;
        const fallbackList = selectedTankCrops.filter(
          (c) => c.rawStatus === 'COMPLETED' || c.status === 'Completed' || c.status === 'COMPLETED'
        );
        setCompletedCrops(fallbackList);
        if (!hasActiveBatchForSelectedTank && fallbackList.length > 0) {
          setReportType('COMPLETED');
          setSelectedCropId(fallbackList[0].id);
        }
      }
    }

    fetchCompletedList();
    return () => {
      isMounted = false;
    };
  }, [selectedTankId, hasActiveBatchForSelectedTank, selectedTankCrops]);

  // 3. Fetch Report Data for Selected Tank & Batch Type
  const loadReport = useCallback(async () => {
    if (!selectedTankId) {
      setReportData(null);
      return;
    }

    try {
      setLoadingReport(true);
      setInfoMsg('');

      if (selectedTankId === 'ALL') {
        const res = await reportService.getFarmOverviewReport();
        setReportData(res.data || res);
        return;
      }

      if (reportType === 'ACTIVE') {
        try {
          const res = await reportService.getActiveTankReport(selectedTankId);
          setReportData(res.data || res);
        } catch (activeErr) {
          // If active report returns "No active crop" but completed batch exists, auto-fallback to completed!
          if (completedCrops.length > 0) {
            setReportType('COMPLETED');
            const targetCropId = selectedCropId || completedCrops[0].id;
            setSelectedCropId(targetCropId);
            const compRes = await reportService.getCompletedCropReport(targetCropId);
            setReportData(compRes.data || compRes);
            return;
          }
          throw activeErr;
        }
      } else if (reportType === 'COMPLETED') {
        const targetCropId = selectedCropId || (completedCrops.length > 0 ? completedCrops[0].id : null);
        if (targetCropId) {
          const res = await reportService.getCompletedCropReport(targetCropId);
          setReportData(res.data || res);
        } else {
          setReportData(null);
          setInfoMsg('No completed batch found for this tank.');
        }
      }
    } catch (err) {
      console.log('Report fetch notice:', err.message);
      setReportData(null);
      setInfoMsg(err.message || 'No report data available for this selection.');
    } finally {
      setLoadingReport(false);
    }
  }, [selectedTankId, reportType, selectedCropId, completedCrops]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  // Enhanced Tank Options showing batch status right inside dropdown
  const tankOptions = useMemo(() => {
    const allOption = {
      value: 'ALL',
      label: '🌟 All Ponds (Farm Total Analytics)',
    };

    const options = displayTanks.map((tank) => {
      const name = tank.tankName || tank.name || 'Pond';
      const details = tank.area ? `${tank.area} Acres` : '';
      const cropsForThisTank = (contextCrops || []).filter(
        (c) => String(c.tankId || c.tank?.id) === String(tank.id)
      );
      const active = cropsForThisTank.find(
        (c) => c.rawStatus === 'ACTIVE' || c.status === 'Active' || c.status === 'ACTIVE'
      );
      const completed = cropsForThisTank.filter(
        (c) => c.rawStatus === 'COMPLETED' || c.status === 'Completed' || c.status === 'COMPLETED'
      );

      let statusNote = '';
      if (active) {
        const bNum = active.batchNumber ? `#${active.batchNumber}` : '';
        statusNote = ` • Active ${bNum}`.trim();
      } else if (completed.length > 0) {
        statusNote = ` • ${completed.length} Completed Batch${completed.length > 1 ? 'es' : ''}`;
      } else {
        statusNote = ` • No Batches`;
      }

      const mainLabel = details ? `${name} (${details})` : name;
      return {
        value: String(tank.id),
        label: `${mainLabel}${statusNote}`,
      };
    });

    return [allOption, ...options];
  }, [displayTanks, contextCrops]);

  const completedCropOptions = completedCrops.map((crop) => {
    const rawIdentifier = crop.cropName || (crop.batchNumber ? `Batch #${crop.batchNumber}` : crop.name);
    const identifier =
      rawIdentifier &&
      typeof rawIdentifier === 'string' &&
      rawIdentifier.trim() !== '' &&
      rawIdentifier.trim().toLowerCase() !== 'null' &&
      rawIdentifier.trim().toLowerCase() !== 'undefined'
        ? rawIdentifier.trim()
        : null;

    let formattedDate = '';
    if (crop.stockingDate) {
      const dateObj = new Date(crop.stockingDate);
      if (!isNaN(dateObj.getTime())) {
        formattedDate = dateObj.toLocaleDateString();
      }
    }

    let label = '';
    if (identifier && formattedDate) {
      label = `${identifier} (${formattedDate})`;
    } else if (identifier) {
      label = identifier;
    } else if (formattedDate) {
      label = formattedDate;
    } else {
      label = `Batch ${crop.id?.slice(-4) || ''}`;
    }

    return {
      value: String(crop.id),
      label,
    };
  });

  const summary = reportData?.summary || {};
  const crop = reportData?.crop || {};
  const tank = reportData?.tank || {};
  const expenseBreakdown = reportData?.expenseBreakdown || [];
  const feedHistory = reportData?.feedHistory || [];
  const medicineHistory = reportData?.medicineHistory || [];
  const expenseHistory = reportData?.expenseHistory || [];
  const harvestHistory = reportData?.harvestHistory || [];

  const selectedTankObject = displayTanks.find((t) => String(t.id) === String(selectedTankId));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Farm Analytics & Reports"
        subtitle="Comprehensive operational reports, cost breakdowns, feed usage logs, and financial metrics."
        actions={
          <div className="flex items-center gap-2 print:hidden">
            <Button
              variant="outline"
              size="sm"
              onClick={loadReport}
              icon={<RefreshCw className="w-4 h-4" />}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => window.print()}
              icon={<Download className="w-4 h-4" />}
              className="font-semibold shadow-xs"
            >
              Export Report
            </Button>
          </div>
        }
      />

      {/* 2. REPORT CONTROLS (Tank & Batch Selection) */}
      <Card padding="relaxed" className="border-border/80 shadow-2xs print:hidden">
        <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
          {/* Tank Selector */}
          <div className="flex-1">
            <Select
              label="Select Pond / Tank"
              placeholder={loadingTanks ? "Loading tanks..." : "Choose pond/tank..."}
              options={tankOptions}
              value={selectedTankId}
              onChange={(e) => {
                const newTankId = e.target.value;
                setSelectedTankId(newTankId);
              }}
              disabled={loadingTanks || displayTanks.length === 0}
            />
          </div>

          {/* Report Mode Switcher (Active vs Completed) */}
          {selectedTankId === 'ALL' ? (
            <div className="flex items-center gap-2 bg-primary/10 border border-primary/20 px-3.5 py-2 rounded-xl text-primary text-xs font-semibold shrink-0">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Consolidated Farm Overview (All Batches)
            </div>
          ) : (
            <div className="flex items-center gap-2 bg-background p-1.5 rounded-xl border border-border shrink-0">
              <button
                type="button"
                disabled={!hasActiveBatchForSelectedTank}
                onClick={() => setReportType('ACTIVE')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  reportType === 'ACTIVE'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary disabled:opacity-40'
                }`}
              >
                Active Crop Batch {hasActiveBatchForSelectedTank ? '' : '(0)'}
              </button>
              <button
                type="button"
                disabled={completedCrops.length === 0}
                onClick={() => setReportType('COMPLETED')}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  reportType === 'COMPLETED'
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-secondary hover:text-text-primary disabled:opacity-40 cursor-pointer'
                }`}
              >
                Completed Batches ({completedCrops.length})
              </button>
            </div>
          )}

          {/* Completed Crop Selector (if mode is COMPLETED and not ALL) */}
          {selectedTankId !== 'ALL' && reportType === 'COMPLETED' && completedCrops.length > 0 && (
            <div className="flex-1">
              <Select
                label="Select Completed Batch"
                placeholder="Choose batch..."
                options={completedCropOptions}
                value={selectedCropId}
                onChange={(e) => setSelectedCropId(e.target.value)}
              />
            </div>
          )}
        </div>
      </Card>

      {/* 3. REPORT DATA DISPLAY OR FRIENDLY EMPTY STATE */}
      {loadingReport ? (
        <div className="py-16 text-center bg-surface border border-border/80 rounded-2xl shadow-2xs">
          <Loader text="Fetching report statistics..." />
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* CROP & TANK METADATA HEADER */}
          <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge variant={selectedTankId === 'ALL' ? 'accent' : (crop.status === 'ACTIVE' ? 'primary' : 'neutral')} size="sm">
                  {selectedTankId === 'ALL' ? 'Farm Consolidated' : `${crop.status || 'Active'} Batch`}
                </Badge>
                <span className="text-xs text-text-secondary font-medium">
                  {selectedTankId === 'ALL'
                    ? `${tank.tankName || 'All Ponds'} (${tank.area || 0} Total Acres)`
                    : `${tank.tankName || selectedTankObject?.tankName} (${tank.area || selectedTankObject?.area} Acres)`}
                </span>
              </div>
              <h2 className="text-xl font-bold text-text-primary">
                {selectedTankId === 'ALL'
                  ? (crop.cropName || 'Consolidated Farm Analytics')
                  : (crop.cropName || (crop.batchNumber ? `Batch #${crop.batchNumber}` : `${tank.tankName || 'Tank'} Crop Batch`))}
              </h2>
            </div>

            <div className="flex items-center gap-6 text-xs text-text-secondary">
              {selectedTankId !== 'ALL' ? (
                <>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-text-secondary">Stocked</span>
                      <span className="font-bold text-text-primary">{crop.stockingDate ? new Date(crop.stockingDate).toLocaleDateString() : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-accent" />
                    <div>
                      <span className="block text-[10px] uppercase font-semibold text-text-secondary">Day of Culture</span>
                      <span className="font-bold text-text-primary">Day {crop.currentDay ?? 'N/A'} / {crop.cropDuration || 120}</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-text-secondary">Analytics Scope</span>
                    <span className="font-bold text-text-primary">All Farm Ponds & Crops</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 5 LIVE SUMMARY CARDS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card padding="compact" className="border-border/80 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Utensils className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-text-secondary tracking-wider block">Total Feed Cost</span>
                  <h3 className="text-lg font-extrabold text-text-primary mt-0.5">₹{(summary.totalFeedCost || 0).toLocaleString()}</h3>
                </div>
              </div>
            </Card>

            <Card padding="compact" className="border-border/80 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-text-secondary tracking-wider block">Total Medicine Cost</span>
                  <h3 className="text-lg font-extrabold text-text-primary mt-0.5">₹{(summary.totalMedicineCost || 0).toLocaleString()}</h3>
                </div>
              </div>
            </Card>

            <Card padding="compact" className="border-border/80 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-text-secondary tracking-wider block">Pond Lease Cost</span>
                  <h3 className="text-lg font-extrabold text-text-primary mt-0.5">₹{(summary.totalPondLeaseCost || 0).toLocaleString()}</h3>
                </div>
              </div>
            </Card>

            <Card padding="compact" className="border-border/80 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Receipt className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-text-secondary tracking-wider block">Other Expenses</span>
                  <h3 className="text-lg font-extrabold text-text-primary mt-0.5">₹{(summary.totalExpenseCost || 0).toLocaleString()}</h3>
                </div>
              </div>
            </Card>

            <Card padding="compact" className="border-border/80 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-semibold uppercase text-text-secondary tracking-wider block">Total Expenditure</span>
                  <h3 className="text-lg font-extrabold text-primary mt-0.5">₹{(summary.totalExpenses || 0).toLocaleString()}</h3>
                </div>
              </div>
            </Card>
          </div>

          {/* REAL PIE CHART SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card padding="normal" className="lg:col-span-1 border-border/80 shadow-2xs">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChartIcon className="w-4 h-4 text-primary" /> Expense Category Breakdown
                </CardTitle>
                <CardDescription>Visual distribution of feed, medicine, and farm expenses</CardDescription>
              </CardHeader>
              <CardBody className="h-72 w-full pt-2 flex items-center justify-center">
                {expenseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        dataKey="amount"
                        nameKey="category"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={45}
                        paddingAngle={3}
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [`₹${Number(value).toLocaleString()}`, 'Amount']}
                        contentStyle={{ backgroundColor: '#FFFFFF', borderRadius: '8px', border: '1px solid #E5E7EB', fontSize: '12px' }}
                      />
                      <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center text-xs text-text-secondary">No expense breakdown data recorded.</div>
                )}
              </CardBody>
            </Card>

            {/* EXPENSE BREAKDOWN LIST TABLE */}
            <Card padding="normal" className="lg:col-span-2 border-border/80 shadow-2xs">
              <CardHeader>
                <CardTitle>Expense Category Totals</CardTitle>
                <CardDescription>Detailed aggregated totals returned by the backend</CardDescription>
              </CardHeader>
              <CardBody>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-background text-text-secondary uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="p-3">Category</th>
                        <th className="p-3">Total Amount (₹)</th>
                        <th className="p-3">% of Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {expenseBreakdown.map((item, idx) => {
                        const total = summary.totalExpenses || 1;
                        const percentage = ((item.amount / total) * 100).toFixed(1);
                        return (
                          <tr key={idx} className="hover:bg-background/40">
                            <td className="p-3 font-semibold text-text-primary flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full shrink-0"
                                style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                              />
                              {item.category}
                            </td>
                            <td className="p-3 font-bold text-text-primary">₹{item.amount.toLocaleString()}</td>
                            <td className="p-3 text-text-secondary font-medium">{percentage}%</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardBody>
            </Card>
          </div>

          {/* HISTORICAL DETAILED LOGS (Feed, Medicine, Expense) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Feed History */}
            <Card padding="normal" className="border-border/80 shadow-2xs">
              <CardHeader>
                <CardTitle className="text-sm">Feed History Logs ({feedHistory.length})</CardTitle>
              </CardHeader>
              <CardBody className="max-h-64 overflow-y-auto aqua-scrollbar print:max-h-none print:overflow-visible">
                {feedHistory.length > 0 ? (
                  <div className="space-y-2">
                    {feedHistory.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-background border border-border/60 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-bold text-text-primary block">{item.feedType} ({item.feedBrand})</span>
                          <span className="text-[10px] text-text-secondary">{new Date(item.date).toLocaleDateString()} - {item.quantity} kg</span>
                        </div>
                        <span className="font-bold text-primary">₹{item.totalCost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary py-4 text-center">No feed entries logged.</div>
                )}
              </CardBody>
            </Card>

            {/* Medicine History */}
            <Card padding="normal" className="border-border/80 shadow-2xs">
              <CardHeader>
                <CardTitle className="text-sm">Medicine Records ({medicineHistory.length})</CardTitle>
              </CardHeader>
              <CardBody className="max-h-64 overflow-y-auto aqua-scrollbar print:max-h-none print:overflow-visible">
                {medicineHistory.length > 0 ? (
                  <div className="space-y-2">
                    {medicineHistory.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-background border border-border/60 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-bold text-text-primary block">{item.medicineName}</span>
                          <span className="text-[10px] text-text-secondary">{new Date(item.date).toLocaleDateString()} - {item.purpose}</span>
                        </div>
                        <span className="font-bold text-indigo-700">₹{item.cost.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary py-4 text-center">No medicine records logged.</div>
                )}
              </CardBody>
            </Card>

            {/* Expense History */}
            <Card padding="normal" className="border-border/80 shadow-2xs">
              <CardHeader>
                <CardTitle className="text-sm">Expense Log ({expenseHistory.length})</CardTitle>
              </CardHeader>
              <CardBody className="max-h-64 overflow-y-auto aqua-scrollbar print:max-h-none print:overflow-visible">
                {expenseHistory.length > 0 ? (
                  <div className="space-y-2">
                    {expenseHistory.map((item) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-background border border-border/60 text-xs flex justify-between items-center">
                        <div>
                          <span className="font-bold text-text-primary block">{item.category}</span>
                          <span className="text-[10px] text-text-secondary">{new Date(item.date).toLocaleDateString()} - {item.paymentMode}</span>
                        </div>
                        <span className="font-bold text-amber-700">₹{item.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-text-secondary py-4 text-center">No general expenses logged.</div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* HARVEST YIELD & SALES LOG TABLE */}
          <Card padding="normal" className="border-border/80 shadow-2xs">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base font-bold text-text-primary">
                <Wheat className="w-4 h-4 text-primary" /> Harvest Yield & Sales Log ({harvestHistory.length})
              </CardTitle>
              <CardDescription>
                Historical record of all intermediate and final harvest events for this crop batch
              </CardDescription>
            </CardHeader>
            <CardBody>
              {harvestHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-background text-text-secondary uppercase font-semibold border-b border-border">
                      <tr>
                        <th className="p-3">#</th>
                        <th className="p-3">Harvest Level</th>
                        <th className="p-3">Date</th>
                        <th className="p-3">Harvest Weight</th>
                        <th className="p-3">Shrimp Count</th>
                        <th className="p-3">Price (₹/kg)</th>
                        <th className="p-3">Revenue (₹)</th>
                        <th className="p-3">Expense (₹)</th>
                        <th className="p-3">Buyer</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {harvestHistory.map((item, idx) => {
                        const weight = item.harvestWeight || item.production || 0;
                        const levelLabel = getHarvestLevelLabel(item.harvestNumber || (idx + 1), item.harvestType);
                        const isFinal = item.harvestType === 'FINAL';

                        return (
                          <tr key={item.id || idx} className="hover:bg-background/40">
                            <td className="p-3 font-semibold text-text-secondary">{item.harvestNumber || (idx + 1)}</td>
                            <td className="p-3">
                              <Badge variant={isFinal ? 'warning' : 'primary'} size="sm" className="font-semibold">
                                {levelLabel}
                              </Badge>
                            </td>
                            <td className="p-3 text-text-primary font-medium">
                              {item.harvestDate ? new Date(item.harvestDate).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="p-3 font-extrabold text-primary">{weight} kg</td>
                            <td className="p-3 text-text-primary font-medium">{item.shrimpCount || 'N/A'}</td>
                            <td className="p-3 text-teal-700 font-semibold">₹{item.sellingPrice}</td>
                            <td className="p-3 font-extrabold text-emerald-700">₹{(item.revenue || 0).toLocaleString()}</td>
                            <td className="p-3 text-amber-700 font-semibold">₹{(item.harvestExpense || 0).toLocaleString()}</td>
                            <td className="p-3 font-bold text-text-primary">{item.buyerName || 'N/A'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-primary-light/20 font-extrabold text-xs border-t-2 border-primary/30">
                      <tr>
                        <td colSpan={3} className="p-3 uppercase tracking-wider text-text-primary">Total Harvest Summary</td>
                        <td className="p-3 text-primary font-black text-sm">
                          {(summary.totalHarvestWeight || harvestHistory.reduce((s, h) => s + (h.harvestWeight || h.production || 0), 0)).toLocaleString()} kg
                        </td>
                        <td className="p-3"></td>
                        <td className="p-3"></td>
                        <td className="p-3 text-emerald-800 text-sm">
                          ₹{(summary.totalHarvestRevenue || harvestHistory.reduce((s, h) => s + (h.revenue || 0), 0)).toLocaleString()}
                        </td>
                        <td className="p-3 text-amber-800">
                          ₹{harvestHistory.reduce((s, h) => s + (h.harvestExpense || 0), 0).toLocaleString()}
                        </td>
                        <td className="p-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ) : (
                <div className="text-xs text-text-secondary py-6 text-center">
                  No harvest records logged for this crop batch yet.
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      ) : (
        <Card padding="relaxed" className="border-border/80 shadow-2xs">
          <EmptyState
            title="No Report Data Available"
            description={
              displayTanks.length === 0
                ? "You haven't configured any tanks or farm ponds yet. Add your tanks first to view reports."
                : (infoMsg.includes('active crop')
                    ? `No active crop batch found for ${selectedTankObject?.tankName || 'this tank'}. Switch to Completed Batches above or register a new crop in Crop Management.`
                    : infoMsg || `Select a tank above with active or completed crops to generate analytics reports.`)
            }
            actionLabel={displayTanks.length === 0 ? "Setup Tanks" : "Go to Crop Management"}
            onAction={() => (window.location.href = displayTanks.length === 0 ? '/tanks' : '/crops')}
          />
        </Card>
      )}
    </div>
  );
}
