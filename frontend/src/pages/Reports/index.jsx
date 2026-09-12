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
  Building2,
  MapPin,
  Waves
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
import siteService from '../../services/siteService';
import { useTanks } from '../../context/TankContext';
import { useCrops } from '../../context/CropContext';
import { useSites } from '../../context/SiteContext';

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
  const { tanks: contextTanks = [] } = useTanks() || {};
  const { crops: contextCrops = [] } = useCrops() || {};
  const { sites: contextSites = [] } = useSites() || {};

  // 1. Report Scope Level: 'FARM', 'SITE', or 'TANK'
  const [reportLevel, setReportLevel] = useState('FARM');

  // Sites & Tanks state
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [tanks, setTanks] = useState([]);
  const [selectedTankId, setSelectedTankId] = useState('');

  // Tank-level sub-selection state
  const [reportType, setReportType] = useState('ACTIVE'); // 'ACTIVE' or 'COMPLETED'
  const [completedCrops, setCompletedCrops] = useState([]);
  const [selectedCropId, setSelectedCropId] = useState('');

  // Report data & loading state
  const [reportData, setReportData] = useState(null);
  const [loadingTanks, setLoadingTanks] = useState(true);
  const [loadingSites, setLoadingSites] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [infoMsg, setInfoMsg] = useState('');

  // Display sites list combined with context
  const displaySites = useMemo(() => {
    if (sites && sites.length > 0) return sites;
    if (contextSites && contextSites.length > 0) return contextSites;
    return [];
  }, [sites, contextSites]);

  // Display tanks list combined with context
  const displayTanks = useMemo(() => {
    if (tanks && tanks.length > 0) return tanks;
    if (contextTanks && contextTanks.length > 0) return contextTanks;
    return [];
  }, [tanks, contextTanks]);

  // 1. Fetch Sites & Tanks on mount
  const fetchSitesAndTanks = useCallback(async () => {
    try {
      setLoadingSites(true);
      setLoadingTanks(true);

      const [siteListRes, tankListRes] = await Promise.allSettled([
        siteService.getSites(),
        reportService.getReportTanks()
      ]);

      if (siteListRes.status === 'fulfilled') {
        const rawSites = siteListRes.value?.data || siteListRes.value || [];
        const resolvedSites = Array.isArray(rawSites) && rawSites.length > 0 ? rawSites : contextSites;
        setSites(resolvedSites);
        if (resolvedSites.length > 0) {
          setSelectedSiteId((prev) => prev || String(resolvedSites[0].id));
        }
      } else if (contextSites.length > 0) {
        setSites(contextSites);
        setSelectedSiteId((prev) => prev || String(contextSites[0].id));
      }

      if (tankListRes.status === 'fulfilled') {
        const rawTanks = tankListRes.value?.data || tankListRes.value || [];
        const resolvedTanks = Array.isArray(rawTanks) && rawTanks.length > 0 ? rawTanks : contextTanks;
        setTanks(resolvedTanks);
      } else if (contextTanks.length > 0) {
        setTanks(contextTanks);
      }
    } catch (err) {
      console.error('Error fetching sites/tanks for reports:', err);
    } finally {
      setLoadingSites(false);
      setLoadingTanks(false);
    }
  }, [contextSites, contextTanks]);

  useEffect(() => {
    fetchSitesAndTanks();
  }, [fetchSitesAndTanks]);

  // Synchronize context sites if direct state is empty
  useEffect(() => {
    if ((!sites || sites.length === 0) && contextSites.length > 0) {
      setSites(contextSites);
      setSelectedSiteId((prev) => prev || String(contextSites[0].id));
    }
  }, [contextSites, sites]);

  // Synchronize context tanks if direct state is empty
  useEffect(() => {
    if ((!tanks || tanks.length === 0) && contextTanks.length > 0) {
      setTanks(contextTanks);
    }
  }, [contextTanks, tanks]);

  // Site options for dropdowns
  const siteOptions = useMemo(() => {
    return displaySites.map((siteItem) => ({
      value: String(siteItem.id),
      label: `${siteItem.siteName || 'Site'}${siteItem.location ? ` (${siteItem.location})` : ''}`,
    }));
  }, [displaySites]);

  // Filter tanks belonging ONLY to the selected site for Tank Report mode
  const siteFilteredTanks = useMemo(() => {
    if (!selectedSiteId) return displayTanks;
    const filtered = displayTanks.filter((t) => {
      const tSiteId = String(t.siteId || t.site?.id || '');
      return tSiteId && tSiteId === String(selectedSiteId);
    });
    // Fallback: If no tanks matched siteId but tanks exist and only 1 site configured, return displayTanks
    if (filtered.length === 0 && displayTanks.length > 0 && displaySites.length <= 1) {
      return displayTanks;
    }
    return filtered;
  }, [displayTanks, selectedSiteId, displaySites]);

  // Automatically update selectedTankId when site changes in Tank mode
  useEffect(() => {
    if (reportLevel === 'TANK') {
      if (siteFilteredTanks.length > 0) {
        const currentTankValid = siteFilteredTanks.some((t) => String(t.id) === String(selectedTankId));
        if (!currentTankValid) {
          setSelectedTankId(String(siteFilteredTanks[0].id));
        }
      } else {
        setSelectedTankId('');
      }
    }
  }, [selectedSiteId, siteFilteredTanks, reportLevel, selectedTankId]);

  // Enhanced Tank Options showing batch status right inside dropdown
  const tankOptions = useMemo(() => {
    return siteFilteredTanks.map((tankItem) => {
      const name = tankItem.tankName || tankItem.name || 'Pond';
      const details = tankItem.area ? `${tankItem.area} Acres` : '';
      const cropsForThisTank = (contextCrops || []).filter(
        (c) => String(c.tankId || c.tank?.id) === String(tankItem.id)
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
        value: String(tankItem.id),
        label: `${mainLabel}${statusNote}`,
      };
    });
  }, [siteFilteredTanks, contextCrops]);

  // Identify crops for currently selected tank
  const selectedTankCrops = useMemo(() => {
    if (!selectedTankId) return [];
    return (contextCrops || []).filter(
      (c) => String(c.tankId || c.tank?.id) === String(selectedTankId)
    );
  }, [contextCrops, selectedTankId]);

  const hasActiveBatchForSelectedTank = useMemo(() => {
    return selectedTankCrops.some(
      (c) => c.rawStatus === 'ACTIVE' || c.status === 'Active' || c.status === 'ACTIVE'
    );
  }, [selectedTankCrops]);

  // Fetch Completed Crops List when tank changes
  useEffect(() => {
    let isMounted = true;
    async function fetchCompletedList() {
      if (reportLevel !== 'TANK' || !selectedTankId) {
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

        if (!hasActiveBatchForSelectedTank && effectiveList.length > 0) {
          setReportType('COMPLETED');
          setSelectedCropId(String(effectiveList[0].id));
        } else if (hasActiveBatchForSelectedTank) {
          setReportType('ACTIVE');
          if (effectiveList.length > 0) {
            setSelectedCropId(String(effectiveList[0].id));
          }
        } else if (effectiveList.length > 0) {
          setSelectedCropId(String(effectiveList[0].id));
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
          setSelectedCropId(String(fallbackList[0].id));
        }
      }
    }

    fetchCompletedList();
    return () => {
      isMounted = false;
    };
  }, [reportLevel, selectedTankId, hasActiveBatchForSelectedTank, selectedTankCrops]);

  // Completed Crop options for dropdown
  const completedCropOptions = completedCrops.map((cropItem) => {
    const rawIdentifier = cropItem.cropName || (cropItem.batchNumber ? `Batch #${cropItem.batchNumber}` : cropItem.name);
    const identifier =
      rawIdentifier &&
      typeof rawIdentifier === 'string' &&
      rawIdentifier.trim() !== '' &&
      rawIdentifier.trim().toLowerCase() !== 'null' &&
      rawIdentifier.trim().toLowerCase() !== 'undefined'
        ? rawIdentifier.trim()
        : null;

    let formattedDate = '';
    if (cropItem.stockingDate) {
      const dateObj = new Date(cropItem.stockingDate);
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
      label = `Batch ${cropItem.id?.slice(-4) || ''}`;
    }

    return {
      value: String(cropItem.id),
      label,
    };
  });

  // Main Report Loader based on Report Scope (FARM / SITE / TANK)
  const loadReport = useCallback(async () => {
    try {
      setLoadingReport(true);
      setInfoMsg('');

      if (reportLevel === 'FARM') {
        const res = await reportService.getFarmOverviewReport();
        setReportData(res.data || res);
        return;
      }

      if (reportLevel === 'SITE') {
        if (!selectedSiteId) {
          setReportData(null);
          setInfoMsg('Please select a site to view its report.');
          return;
        }
        const res = await reportService.getSiteOverviewReport(selectedSiteId);
        setReportData(res.data || res);
        return;
      }

      if (reportLevel === 'TANK') {
        if (!selectedTankId) {
          setReportData(null);
          if (siteFilteredTanks.length === 0) {
            setInfoMsg('No tanks available for this site.');
          } else {
            setInfoMsg('Please select a tank to view its report.');
          }
          return;
        }

        if (reportType === 'ACTIVE') {
          try {
            const res = await reportService.getActiveTankReport(selectedTankId);
            setReportData(res.data || res);
          } catch (activeErr) {
            if (completedCrops.length > 0) {
              setReportType('COMPLETED');
              const targetCropId = selectedCropId || completedCrops[0].id;
              setSelectedCropId(String(targetCropId));
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
            setInfoMsg('No completed crop reports available.');
          }
        }
      }
    } catch (err) {
      console.log('Report fetch notice:', err.message);
      setReportData(null);
      if (err.message?.includes('No active crop')) {
        setInfoMsg('No active crop for this tank.');
      } else {
        setInfoMsg(err.message || 'No report data available yet.');
      }
    } finally {
      setLoadingReport(false);
    }
  }, [reportLevel, selectedSiteId, selectedTankId, reportType, selectedCropId, completedCrops, siteFilteredTanks]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const summary = reportData?.summary || {};
  const crop = reportData?.crop || {};
  const tank = reportData?.tank || {};
  const site = reportData?.site || {};
  const expenseBreakdown = reportData?.expenseBreakdown || [];
  const feedHistory = reportData?.feedHistory || [];
  const medicineHistory = reportData?.medicineHistory || [];
  const expenseHistory = reportData?.expenseHistory || [];
  const harvestHistory = reportData?.harvestHistory || [];

  const selectedSiteObject = displaySites.find((s) => String(s.id) === String(selectedSiteId));
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

      {/* 2. THREE REPORTING LEVELS SELECTOR (Farm Report / Site Report / Tank Report) */}
      <div className="bg-surface border border-border/80 rounded-2xl p-3 shadow-2xs space-y-3 print:hidden">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
            Select Report Scope
          </span>
          <span className="text-[11px] text-text-secondary">
            {reportLevel === 'FARM' && 'Farm-Wide Consolidated Analytics'}
            {reportLevel === 'SITE' && 'Site-Wide Consolidated Analytics'}
            {reportLevel === 'TANK' && 'Specific Tank/Batch Analytics'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Option 1: FARM REPORT */}
          <button
            type="button"
            onClick={() => setReportLevel('FARM')}
            className={`flex items-center justify-center gap-2.5 p-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              reportLevel === 'FARM'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-background text-text-secondary border-border/80 hover:border-primary/40 hover:text-text-primary'
            }`}
          >
            <Building2 className="w-4 h-4 shrink-0" />
            <span>Farm Report</span>
          </button>

          {/* Option 2: SITE REPORT */}
          <button
            type="button"
            onClick={() => setReportLevel('SITE')}
            className={`flex items-center justify-center gap-2.5 p-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              reportLevel === 'SITE'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-background text-text-secondary border-border/80 hover:border-primary/40 hover:text-text-primary'
            }`}
          >
            <MapPin className="w-4 h-4 shrink-0" />
            <span>Site Report</span>
          </button>

          {/* Option 3: TANK REPORT */}
          <button
            type="button"
            onClick={() => setReportLevel('TANK')}
            className={`flex items-center justify-center gap-2.5 p-3 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer border ${
              reportLevel === 'TANK'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-background text-text-secondary border-border/80 hover:border-primary/40 hover:text-text-primary'
            }`}
          >
            <Waves className="w-4 h-4 shrink-0" />
            <span>Tank Report</span>
          </button>
        </div>
      </div>

      {/* 3. DYNAMIC LEVEL CONTROLS (Site / Tank / Batch Selectors) */}
      {reportLevel !== 'FARM' && (
        <Card padding="relaxed" className="border-border/80 shadow-2xs print:hidden">
          <div className="flex flex-col md:flex-row items-stretch md:items-end gap-4">
            {/* SITE SELECTOR (Required for SITE & TANK levels) */}
            <div className="flex-1">
              <Select
                label="Select Site"
                placeholder={loadingSites ? "Loading sites..." : "Choose site..."}
                options={siteOptions}
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                disabled={loadingSites || displaySites.length === 0}
              />
            </div>

            {/* TANK REPORT LEVEL CONTROLS */}
            {reportLevel === 'TANK' && (
              <>
                {/* TANK SELECTOR (Filtered by Selected Site) */}
                <div className="flex-1">
                  <Select
                    label="Select Tank"
                    placeholder={
                      loadingTanks
                        ? "Loading tanks..."
                        : siteFilteredTanks.length === 0
                        ? "No tanks in this site"
                        : "Choose tank..."
                    }
                    options={tankOptions}
                    value={selectedTankId}
                    onChange={(e) => setSelectedTankId(e.target.value)}
                    disabled={loadingTanks || siteFilteredTanks.length === 0}
                  />
                </div>

                {/* ACTIVE vs COMPLETED BATCH TOGGLE */}
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

                {/* COMPLETED CROP BATCH SELECTOR */}
                {reportType === 'COMPLETED' && completedCrops.length > 0 && (
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
              </>
            )}
          </div>
        </Card>
      )}

      {/* 4. REPORT DATA DISPLAY OR FRIENDLY EMPTY STATE */}
      {loadingReport ? (
        <div className="py-16 text-center bg-surface border border-border/80 rounded-2xl shadow-2xs">
          <Loader text="Fetching report statistics..." />
        </div>
      ) : reportData ? (
        <div className="space-y-6">
          {/* REPORT METADATA HEADER */}
          <div className="bg-surface border border-border/80 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Badge
                  variant={
                    reportLevel === 'FARM'
                      ? 'accent'
                      : reportLevel === 'SITE'
                      ? 'primary'
                      : (crop.status === 'ACTIVE' ? 'primary' : 'neutral')
                  }
                  size="sm"
                >
                  {reportLevel === 'FARM' && 'Farm Consolidated'}
                  {reportLevel === 'SITE' && 'Site Consolidated'}
                  {reportLevel === 'TANK' && `${crop.status || 'Active'} Batch`}
                </Badge>
                <span className="text-xs text-text-secondary font-medium">
                  {reportLevel === 'FARM' && `${tank.tankName || 'All Ponds'} (${tank.area || 0} Total Acres)`}
                  {reportLevel === 'SITE' && `${site.siteName || selectedSiteObject?.siteName} (${site.area || selectedSiteObject?.area || 0} Acres • ${site.tankCount || 0} Tanks)`}
                  {reportLevel === 'TANK' && `${tank.tankName || selectedTankObject?.tankName} (${tank.area || selectedTankObject?.area} Acres)`}
                </span>
              </div>
              <h2 className="text-xl font-bold text-text-primary">
                {reportLevel === 'FARM' && (crop.cropName || 'Consolidated Farm Analytics')}
                {reportLevel === 'SITE' && (crop.cropName || `${site.siteName || selectedSiteObject?.siteName || 'Site'} Analytics Overview`)}
                {reportLevel === 'TANK' && (crop.cropName || (crop.batchNumber ? `Batch #${crop.batchNumber}` : `${tank.tankName || 'Tank'} Crop Batch`))}
              </h2>
            </div>

            <div className="flex items-center gap-6 text-xs text-text-secondary">
              {reportLevel === 'TANK' ? (
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
              ) : reportLevel === 'SITE' ? (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-primary" />
                  <div>
                    <span className="block text-[10px] uppercase font-semibold text-text-secondary">Analytics Scope</span>
                    <span className="font-bold text-text-primary">{site.siteName || selectedSiteObject?.siteName} Ponds ({site.tankCount || 0} Tanks)</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
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

          {/* PIE CHART SECTION */}
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
                Historical record of all intermediate and final harvest events for this report selection
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
                  No harvest records logged for this report selection yet.
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
              reportLevel === 'SITE' && siteFilteredTanks.length === 0
                ? "No tanks available for this site."
                : (reportLevel === 'TANK' && !hasActiveBatchForSelectedTank && completedCrops.length === 0)
                ? "No active crop for this tank."
                : (infoMsg || "No report data available yet.")
            }
            actionLabel={displayTanks.length === 0 ? "Setup Tanks" : "Go to Crop Management"}
            onAction={() => (window.location.href = displayTanks.length === 0 ? '/tanks' : '/crops')}
          />
        </Card>
      )}
    </div>
  );
}
