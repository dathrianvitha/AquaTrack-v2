import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  UtensilsCrossed,
  Stethoscope,
  MapPin,
  Boxes,
  AlertCircle,
  Pencil,
  Trash2,
  Calendar,
  Eye,
  Wrench,
  ArrowRightLeft,
  CheckCircle2,
  RotateCcw,
  History,
  FileText,
  ArrowRight
} from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Loader } from '../../components/Loader';
import { Input } from '../../components/Input';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PasswordConfirmationModal } from '../../components/PasswordConfirmationModal';
import { AddStockForm } from '../../components/AddStockModal';
import { OtherStockModal } from '../../components/OtherStockModal';
import { StockTransferModal } from '../../components/StockTransferModal';
import { OtherStockTransferModal } from '../../components/OtherStockTransferModal';
import { OtherStockRepairModal } from '../../components/OtherStockRepairModal';


import { useStocking } from '../../context/StockingContext';
import { useSites } from '../../context/SiteContext';
import { useTanks } from '../../context/TankContext';
import { useFeed } from '../../context/FeedContext';
import { useMedicine } from '../../context/MedicineContext';
import { subscribeToSyncBus } from '../../utils/syncBus';
import { stockingService } from '../../services/stockingService';
import { otherStockService } from '../../services/otherStockService';

export default function Stocking() {
  const {
    stockings = [],
    loading,
    error,
    fetchStockings,
    addStock,
    updateStock,
    deleteStock,
    transferStock
  } = useStocking();
  const { sites = [], loading: sitesLoading } = useSites();
  const { tanks = [] } = useTanks();
  const { feedLogs = [] } = useFeed();
  const { medicineRecords = [] } = useMedicine();

  // Stock Transfer States
  const [transferSource, setTransferSource] = useState(null);
  const [isTransferSubmitting, setIsTransferSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Refetch stock inventory on mount / navigation and on real-time syncBus events
  useEffect(() => {
    if (typeof fetchStockings === 'function') {
      fetchStockings();
    }

    const unsubscribe = subscribeToSyncBus((detail) => {
      if (['SITE', 'TANK', 'CROP', 'STOCKING', 'FEED', 'MEDICINE'].includes(detail.entityType)) {
        if (typeof fetchStockings === 'function') {
          fetchStockings(true);
        }
      }
    });

    return unsubscribe;
  }, [fetchStockings]);

  // Modal & Action states
  const [isAddStockOpen, setIsAddStockOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit/Delete Stock States
  const [editingStock, setEditingStock] = useState(null);
  const [editingStockQuantity, setEditingStockQuantity] = useState('');
  const [editingStockingDate, setEditingStockingDate] = useState('');
  const [deletingStockId, setDeletingStockId] = useState(null);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [viewingStock, setViewingStock] = useState(null);

  // Other Stock States
  const [otherStocks, setOtherStocks] = useState([]);
  const [loadingOtherStock, setLoadingOtherStock] = useState(false);
  const [isOtherStockModalOpen, setIsOtherStockModalOpen] = useState(false);
  const [editingOtherStock, setEditingOtherStock] = useState(null);
  const [viewingOtherStock, setViewingOtherStock] = useState(null);
  const [deletingOtherStockId, setDeletingOtherStockId] = useState(null);
  const [isOtherStockPasswordOpen, setIsOtherStockPasswordOpen] = useState(false);
  const [isOtherStockSubmitting, setIsOtherStockSubmitting] = useState(false);
  const [otherStockTransferSource, setOtherStockTransferSource] = useState(null);
  const [isOtherStockTransferSubmitting, setIsOtherStockTransferSubmitting] = useState(false);

  // Transfer Log Modal States
  const [isTransferLogOpen, setIsTransferLogOpen] = useState(false);
  const [transferLogs, setTransferLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const fetchTransferLogs = async () => {
    setLoadingLogs(true);
    try {
      const [stRes, ostRes] = await Promise.all([
        stockingService.getTransferLogs().catch(() => ({ data: [] })),
        otherStockService.getTransferLogs().catch(() => ({ data: [] }))
      ]);

      const stData = Array.isArray(stRes.data) ? stRes.data : [];
      const ostData = Array.isArray(ostRes.data) ? ostRes.data : [];

      const normalizedSt = stData.map((s) => ({
        id: `st_${s.id}`,
        rawId: s.id,
        type: 'STOCK',
        category: s.category,
        quantity: s.quantity,
        unit: s.unit || (s.category === 'MEDICINE' ? 'L' : 'kg'),
        fromSiteName: s.fromSite?.siteName || 'Source Site',
        toSiteName: s.toSite?.siteName || 'Destination Site',
        createdAt: s.createdAt
      }));

      const normalizedOst = ostData.map((o) => ({
        id: `ost_${o.id}`,
        rawId: o.id,
        type: 'OTHER',
        category: o.category,
        quantity: o.quantity,
        unit: '',
        fromSiteName: o.fromSite?.siteName || 'Source Site',
        toSiteName: o.toSite?.siteName || 'Destination Site',
        createdAt: o.createdAt
      }));

      const combined = [...normalizedSt, ...normalizedOst].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

      setTransferLogs(combined);
    } catch (err) {
      console.error('Failed to fetch transfer logs', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleOpenTransferLog = () => {
    setIsTransferLogOpen(true);
    fetchTransferLogs();
  };


  // Other Stock Repair States
  const [repairModalState, setRepairModalState] = useState({
    isOpen: false,
    mode: 'SEND', // 'SEND' or 'RETURN'
    item: null
  });
  const [isRepairSubmitting, setIsRepairSubmitting] = useState(false);
  const [deletingRepairLogId, setDeletingRepairLogId] = useState(null);

  const handleOpenRepairModal = (item, mode = 'SEND') => {
    setRepairModalState({
      isOpen: true,
      mode,
      item
    });
  };

  const handleRepairSubmit = async ({ quantity, notes }) => {
    const { mode, item } = repairModalState;
    if (!item) return;

    setIsRepairSubmitting(true);
    try {
      let res;
      if (mode === 'SEND') {
        res = await otherStockService.sendToRepair(item.id, quantity, notes);
      } else {
        res = await otherStockService.returnFromRepair(item.id, quantity, notes);
      }
      setRepairModalState({ isOpen: false, mode: 'SEND', item: null });
      setSuccessMessage(res?.message || 'Stock repair status updated successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
      await fetchOtherStocks();
    } catch (err) {
      throw err;
    } finally {
      setIsRepairSubmitting(false);
    }
  };

  const handleDeleteRepairLogSubmit = async () => {
    if (!deletingRepairLogId) return;

    try {
      const res = await otherStockService.deleteRepairLog(deletingRepairLogId);
      setDeletingRepairLogId(null);
      setSuccessMessage(res?.message || 'Repair log entry deleted successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);

      const updatedList = await fetchOtherStocks();
      if (viewingOtherStock) {
        const updatedItem = (updatedList || []).find((s) => String(s.id) === String(viewingOtherStock.id)) || res?.data;
        setViewingOtherStock(updatedItem || null);
      }
    } catch (err) {
      setDeletingRepairLogId(null);
    }
  };




  // Fetch Other Stock records
  const fetchOtherStocks = async () => {
    setLoadingOtherStock(true);
    try {
      const res = await otherStockService.getOtherStocks();
      if (res?.success && Array.isArray(res.data)) {
        setOtherStocks(res.data);
        return res.data;
      }
    } catch (err) {
      console.error('Failed to fetch other stock records', err);
    } finally {
      setLoadingOtherStock(false);
    }
  };


  useEffect(() => {
    fetchOtherStocks();
  }, []);

  const handleSaveOtherStock = async (formData) => {
    setIsOtherStockSubmitting(true);
    try {
      if (editingOtherStock) {
        await otherStockService.updateOtherStock(editingOtherStock.id, formData);
      } else {
        await otherStockService.createOtherStock(formData);
      }
      setIsOtherStockModalOpen(false);
      setEditingOtherStock(null);
      await fetchOtherStocks();
    } finally {
      setIsOtherStockSubmitting(false);
    }
  };

  const handleOtherStockTransferSubmit = async (transferData) => {
    setIsOtherStockTransferSubmitting(true);
    try {
      const res = await otherStockService.transferOtherStock(transferData);
      setOtherStockTransferSource(null);
      setSuccessMessage(res?.message || 'Other stock transferred successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
      await fetchOtherStocks();
    } catch (err) {
      throw err;
    } finally {
      setIsOtherStockTransferSubmitting(false);
    }
  };

  const handleConfirmDeleteOtherStockWithPassword = async (password) => {
    if (deletingOtherStockId) {
      try {
        const res = await otherStockService.deleteOtherStock(deletingOtherStockId, password);
        setIsOtherStockPasswordOpen(false);
        setDeletingOtherStockId(null);
        setSuccessMessage(res?.message || 'Other stock record deleted successfully.');
        setTimeout(() => setSuccessMessage(''), 6000);
        await fetchOtherStocks();
      } catch (err) {
        setIsOtherStockPasswordOpen(false);
        setDeletingOtherStockId(null);
      }
    }
  };

  // Map Tank ID to Site ID for fast live usage resolution
  const tankSiteMap = useMemo(() => {
    const map = {};
    tanks.forEach((t) => {
      const tId = String(t.id);
      const sId = String(t.siteId || t.site?.id || '');
      if (tId && sId) {
        map[tId] = sId;
      }
    });
    return map;
  }, [tanks]);

  // Group Stock Inventory by Site and Category (FEED & MEDICINE) with Instant Dynamic Sync
  const siteWiseStockList = useMemo(() => {
    return sites.map((site) => {
      const siteIdStr = String(site.id);

      // Live Feed usage sum directly from FeedContext for 0ms instant frontend reflection
      const liveFeedUsed = feedLogs.reduce((sum, f) => {
        const logTankId = String(f.tankId || f.crop?.tankId || f.crop?.tank?.id || '');
        const logSiteId = tankSiteMap[logTankId] || String(f.siteId || f.crop?.tank?.siteId || '');
        if (logSiteId === siteIdStr) {
          return sum + (parseFloat(f.quantityKg ?? f.quantity) || 0);
        }
        return sum;
      }, 0);

      // Live Medicine usage sum directly from MedicineContext for 0ms instant frontend reflection
      const liveMedicineUsed = medicineRecords.reduce((sum, m) => {
        const recTankId = String(m.tankId || m.tank?.id || '');
        const recSiteId = tankSiteMap[recTankId] || String(m.siteId || m.tank?.siteId || '');
        if (recSiteId === siteIdStr) {
          return sum + (parseFloat(m.quantity) || 0);
        }
        return sum;
      }, 0);

      // Feed Stock Metrics for this Site
      let feedAdded = 0;
      let backendFeedUsed = 0;
      let feedUnit = 'kg';
      let feedStockId = null;
      let feedStockingDate = null;
      const feedItems = [];

      // Medicine Stock Metrics for this Site
      let medicineAdded = 0;
      let backendMedicineUsed = 0;
      let medicineUnit = 'L';
      let medicineStockId = null;
      let medicineStockingDate = null;
      const medicineItems = [];

      stockings.forEach((s) => {
        const cat = s.category?.toUpperCase();
        const matchesSite = (s.siteId && String(s.siteId) === siteIdStr) || (s.site?.id && String(s.site.id) === siteIdStr);

        if (matchesSite) {
          const qty = parseFloat(s.totalQuantity) || 0;
          if (cat === 'FEED') {
            feedAdded += qty;
            backendFeedUsed = Math.max(backendFeedUsed, parseFloat(s.totalUsed) || 0);
            feedUnit = s.unit || 'kg';
            if (!feedStockId) feedStockId = s.id;
            if (!feedStockingDate) feedStockingDate = s.stockingDate || s.createdAt;
            feedItems.push({
              id: s.id,
              totalQuantity: qty,
              unit: s.unit || 'kg',
              stockingDate: s.stockingDate || s.createdAt,
              transfer: s.transfer || null
            });
          } else if (cat === 'MEDICINE') {
            medicineAdded += qty;
            backendMedicineUsed = Math.max(backendMedicineUsed, parseFloat(s.totalUsed) || 0);
            medicineUnit = s.unit || 'L';
            if (!medicineStockId) medicineStockId = s.id;
            if (!medicineStockingDate) medicineStockingDate = s.stockingDate || s.createdAt;
            medicineItems.push({
              id: s.id,
              totalQuantity: qty,
              unit: s.unit || 'L',
              stockingDate: s.stockingDate || s.createdAt,
              transfer: s.transfer || null
            });
          }
        }
      });

      const feedUsed = Math.max(liveFeedUsed, backendFeedUsed);
      const medicineUsed = Math.max(liveMedicineUsed, backendMedicineUsed);

      const feedRemaining = Math.max(feedAdded - feedUsed, 0);
      const medicineRemaining = Math.max(medicineAdded - medicineUsed, 0);

      return {
        site,
        feed: feedAdded > 0 || feedUsed > 0 || feedItems.length > 0 ? {
          id: feedStockId || feedItems[0]?.id,
          added: feedAdded,
          used: feedUsed,
          remaining: feedRemaining,
          unit: feedUnit,
          stockingDate: feedStockingDate,
          siteName: site.siteName,
          items: feedItems,
        } : null,
        medicine: medicineAdded > 0 || medicineUsed > 0 || medicineItems.length > 0 ? {
          id: medicineStockId || medicineItems[0]?.id,
          added: medicineAdded,
          used: medicineUsed,
          remaining: medicineRemaining,
          unit: medicineUnit,
          stockingDate: medicineStockingDate,
          siteName: site.siteName,
          items: medicineItems,
        } : null,
      };
    });
  }, [sites, stockings, tanks, tankSiteMap, feedLogs, medicineRecords]);

  // Submit Handlers
  const handleAddStockSubmit = async (formData) => {
    setIsSubmitting(true);
    try {
      await addStock(formData);
      setIsAddStockOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTransferSubmit = async (transferData) => {
    setIsTransferSubmitting(true);
    try {
      const res = await transferStock(transferData);
      setTransferSource(null);
      setSuccessMessage(res?.message || 'Stock transferred successfully.');
      setTimeout(() => setSuccessMessage(''), 5000);
    } finally {
      setIsTransferSubmitting(false);
    }
  };

  // Edit & Delete Stock Handlers
  const handleOpenEditStock = (stockItem) => {
    setEditingStock(stockItem);
    setEditingStockQuantity(String(stockItem.added || stockItem.totalQuantity || ''));
    setEditingStockingDate(
      stockItem.stockingDate
        ? new Date(stockItem.stockingDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    );
  };

  const handleUpdateStockSubmit = async (e) => {
    e.preventDefault();
    if (!editingStock || !editingStock.id) return;
    setIsSubmitting(true);
    try {
      await updateStock(editingStock.id, {
        totalQuantity: editingStockQuantity,
        unit: editingStock.unit,
        stockingDate: editingStockingDate,
      });
      setEditingStock(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptDeleteStep1 = () => {
    setIsPasswordOpen(true);
  };

  const handleFinalDeleteWithPassword = async (password) => {
    if (deletingStockId) {
      try {
        const res = await deleteStock(deletingStockId, password);
        setIsPasswordOpen(false);
        setDeletingStockId(null);
        setSuccessMessage(res?.message || 'Stock record deleted successfully.');
        setTimeout(() => setSuccessMessage(''), 6000);
      } catch (err) {
        setIsPasswordOpen(false);
        setDeletingStockId(null);
      }
    }
  };

  const hasAnyStock = stockings.length > 0;

  return (
    <div className="space-y-6">
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Stocking Management"
        subtitle="Manage site-level stock inventory directly for feed and medicine."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleOpenTransferLog}
              icon={<History className="w-4 h-4" />}
              className="font-semibold shadow-xs border-primary/30 text-primary hover:bg-primary-light/50"
            >
              Transfer Log
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsAddStockOpen(true)}
              icon={<Plus className="w-4 h-4" />}
              className="font-semibold shadow-xs"
              disabled={sites.length === 0}
            >
              Add Stock
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingOtherStock(null);
                setIsOtherStockModalOpen(true);
              }}
              icon={<Plus className="w-4 h-4" />}
              className="font-semibold shadow-xs"
            >
              Other Stock
            </Button>
          </div>
        }
      />

      {/* COMPACT ERROR DISPLAY BANNER */}
      {error && (
        <Card padding="compact" className="border-danger/30 bg-danger-light/20 text-danger text-xs flex items-center gap-2 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </Card>
      )}

      {/* COMPACT SUCCESS DISPLAY BANNER */}
      {successMessage && (
        <Card padding="compact" className="border-success/30 bg-success-light/20 text-success text-xs flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
            <span className="font-semibold">{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage('')} className="text-text-secondary hover:text-text-primary p-0.5 cursor-pointer">✕</button>
        </Card>
      )}

      {/* LOADING SPINNER */}
      {(loading || sitesLoading) && !hasAnyStock ? (
        <div className="py-12 flex justify-center items-center">
          <Loader size="lg" text="Loading stocking inventory..." />
        </div>
      ) : sites.length === 0 ? (
        <Card padding="relaxed" className="border-border/80">
          <EmptyState
            title="No Sites Available"
            description="You need to create at least one Site before adding site-level stock."
          />
        </Card>
      ) : (
        /* 2. SITE-WISE STOCK DASHBOARD CARDS */
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/60 pb-2">
            <div>
              <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
                <Boxes className="w-4.5 h-4.5 text-primary" /> Site-wise Stock Inventory
              </h3>
              <span className="text-xs text-text-secondary">Site-level Feed & Medicine inventory tracking</span>
            </div>
            <Button
              variant="outline"
              size="xs"
              onClick={handleOpenTransferLog}
              icon={<History className="w-3.5 h-3.5" />}
              className="font-semibold text-xs py-1 px-2.5 shadow-2xs border-primary/30 text-primary hover:bg-primary-light/50"
            >
              Log
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
            {siteWiseStockList.map(({ site, feed, medicine }) => {
              const hasSiteStock = Boolean(feed || medicine);

              return (
                <Card key={site.id} padding="normal" className="border-border/80 bg-surface shadow-xs flex flex-col justify-between">
                  <div className="space-y-4">
                    {/* Site Header */}
                    <div className="flex items-start justify-between pb-3 border-b border-border/60">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-10 rounded-xl bg-primary-light text-primary flex items-center justify-center shrink-0 shadow-xs">
                          <MapPin className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="font-bold text-base text-text-primary">{site.siteName}</h4>
                          <span className="text-xs text-text-secondary">{site.location || 'Site Location'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={hasSiteStock ? 'success' : 'neutral'} size="sm">
                          {hasSiteStock ? 'In Stock' : 'No Stock'}
                        </Badge>
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => setTransferSource({
                            site,
                            feedRemaining: feed?.remaining ?? 0,
                            medicineRemaining: medicine?.remaining ?? 0,
                            feedUnit: feed?.unit || 'kg',
                            medicineUnit: medicine?.unit || 'L',
                          })}
                          icon={<ArrowRightLeft className="w-3.5 h-3.5" />}
                          className="font-semibold text-xs py-1 px-2.5 shadow-2xs border-primary/30 text-primary hover:bg-primary-light/50"
                        >
                          Transfer
                        </Button>
                      </div>
                    </div>

                    {hasSiteStock ? (
                      <div className="space-y-3">
                        {/* FEED STOCK BOX */}
                        {feed ? (
                          <div className="p-3.5 rounded-xl bg-teal-50/40 border border-teal-200/60 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-teal-900 flex items-center gap-1.5 uppercase tracking-wider">
                                  <UtensilsCrossed className="w-3.5 h-3.5 text-teal-600" /> Feed Stock
                                </span>
                                {feed.stockingDate && (
                                  <span className="text-[10px] font-semibold text-teal-800 bg-teal-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-teal-600" />
                                    {new Date(feed.stockingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingStock({ ...feed, category: 'FEED', site })}
                                  title="View Stock Details"
                                  className="p-1 text-text-secondary hover:text-primary rounded hover:bg-primary-light transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {feed.id && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditStock({ ...feed, category: 'FEED' })}
                                      title="Edit Feed Stock"
                                      className="p-1 text-text-secondary hover:text-primary rounded hover:bg-primary-light transition-colors cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingStockId(feed.id)}
                                      title="Delete Feed Stock"
                                      className="p-1 text-text-secondary hover:text-danger rounded hover:bg-danger-light transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="p-2 rounded-lg bg-white/90 border border-teal-100">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block">Added</span>
                                <span className="text-sm font-extrabold text-text-primary mt-0.5 block">
                                  {feed.added} <span className="text-[10px] font-medium text-text-secondary">{feed.unit}</span>
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-white/90 border border-teal-100">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block">Used</span>
                                <span className="text-sm font-extrabold text-amber-700 mt-0.5 block">
                                  {feed.used} <span className="text-[10px] font-medium text-text-secondary">{feed.unit}</span>
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-white/90 border border-teal-100">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block">Remaining</span>
                                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                                  {feed.remaining} <span className="text-[10px] font-medium text-text-secondary">{feed.unit}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}

                        {/* MEDICINE STOCK BOX */}
                        {medicine ? (
                          <div className="p-3.5 rounded-xl bg-cyan-50/40 border border-cyan-200/60 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-extrabold text-cyan-900 flex items-center gap-1.5 uppercase tracking-wider">
                                  <Stethoscope className="w-3.5 h-3.5 text-cyan-600" /> Medicine Stock
                                </span>
                                {medicine.stockingDate && (
                                  <span className="text-[10px] font-semibold text-cyan-800 bg-cyan-100/70 px-2 py-0.5 rounded-md flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-cyan-600" />
                                    {new Date(medicine.stockingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => setViewingStock({ ...medicine, category: 'MEDICINE', site })}
                                  title="View Stock Details"
                                  className="p-1 text-text-secondary hover:text-primary rounded hover:bg-primary-light transition-colors cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                {medicine.id && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEditStock({ ...medicine, category: 'MEDICINE' })}
                                      title="Edit Medicine Stock"
                                      className="p-1 text-text-secondary hover:text-primary rounded hover:bg-primary-light transition-colors cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setDeletingStockId(medicine.id)}
                                      title="Delete Medicine Stock"
                                      className="p-1 text-text-secondary hover:text-danger rounded hover:bg-danger-light transition-colors cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-center text-xs">
                              <div className="p-2 rounded-lg bg-white/90 border border-cyan-100">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block">Added</span>
                                <span className="text-sm font-extrabold text-text-primary mt-0.5 block">
                                  {medicine.added} <span className="text-[10px] font-medium text-text-secondary">{medicine.unit}</span>
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-white/90 border border-cyan-100">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block">Used</span>
                                <span className="text-sm font-extrabold text-amber-700 mt-0.5 block">
                                  {medicine.used} <span className="text-[10px] font-medium text-text-secondary">{medicine.unit}</span>
                                </span>
                              </div>

                              <div className="p-2 rounded-lg bg-white/90 border border-cyan-100">
                                <span className="text-[10px] uppercase font-bold text-text-secondary block">Remaining</span>
                                <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                                  {medicine.remaining} <span className="text-[10px] font-medium text-text-secondary">{medicine.unit}</span>
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="py-6 text-center text-xs text-text-secondary bg-background/50 rounded-xl border border-dashed border-border/60">
                        No feed or medicine stock added to this site yet.
                      </div>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* 2.5 OTHER STOCK SECTION */}
      <div className="space-y-4 pt-4 border-t border-border/60">
        <div className="flex items-center justify-between border-b border-border/60 pb-2">
          <div>
            <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
              <Wrench className="w-4.5 h-4.5 text-primary" /> Other Stock
            </h3>
            <span className="text-xs text-text-secondary">Farm-level equipment and spare parts inventory</span>
          </div>
          <Button
            variant="outline"
            size="xs"
            onClick={handleOpenTransferLog}
            icon={<History className="w-3.5 h-3.5" />}
            className="font-semibold text-xs py-1 px-2.5 shadow-2xs border-primary/30 text-primary hover:bg-primary-light/50"
          >
            Log
          </Button>
        </div>

        {otherStocks.length === 0 ? (
          <Card padding="relaxed" className="border-border/80 text-center py-6">
            <div className="text-xs text-text-secondary">
              No farm or site-level equipment or parts added yet. Click <span className="font-semibold text-text-primary">[ + Other Stock ]</span> to add items.
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {otherStocks.map((item) => {
              const itemSite = item.site || sites.find((s) => String(s.id) === String(item.siteId)) || sites[0];
              const isTransferred = Boolean(item.transfer?.fromSite?.siteName);

              return (
                <Card key={item.id} padding="normal" className="border-border/80 bg-surface shadow-xs flex flex-col justify-between space-y-3">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-sm text-text-primary">{item.category}</h4>
                        {itemSite && (
                          <span className="text-[10px] font-semibold text-text-secondary flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 text-primary shrink-0" /> {itemSite.siteName}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {itemSite && (
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => setOtherStockTransferSource({ site: itemSite, initialCategory: item.category })}
                            icon={<ArrowRightLeft className="w-3 h-3" />}
                            className="font-semibold text-[11px] py-1 px-2 border-primary/30 text-primary hover:bg-primary-light/50"
                            title={`Transfer ${item.category} from ${itemSite.siteName}`}
                          >
                            Transfer
                          </Button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingOtherStock(item);
                            setIsOtherStockModalOpen(true);
                          }}
                          title="Edit Other Stock"
                          className="p-1 text-text-secondary hover:text-primary rounded hover:bg-primary-light transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingOtherStockId(item.id);
                            setIsOtherStockPasswordOpen(true);
                          }}
                          title={isTransferred ? `Delete Transferred Stock (Return ${item.count} ${item.category} to ${item.transfer.fromSite?.siteName})` : "Delete Other Stock"}
                          className="p-1 text-text-secondary hover:text-danger rounded hover:bg-danger-light transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-center text-xs">
                      <div className="grid grid-cols-2 gap-1.5">
                        <div className="p-2 rounded-lg bg-background border border-border/50">
                          <span className="text-[9px] uppercase font-bold text-text-secondary block">Total</span>
                          <span className="text-sm font-extrabold text-text-primary mt-0.5 block">
                            {item.count + (item.underRepair || 0)}
                          </span>
                        </div>

                        <div className="p-2 rounded-lg bg-emerald-50/70 border border-emerald-200/60">
                          <span className="text-[9px] uppercase font-bold text-emerald-800 block">Available</span>
                          <span className="text-sm font-extrabold text-emerald-700 mt-0.5 block">
                            {item.count}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-lg bg-amber-50/70 border border-amber-200/60 w-full relative">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-bold text-amber-800">Under Repair</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewingOtherStock(item)}
                              title="View Repair Logs"
                              className="p-1 text-amber-800 hover:text-amber-950 rounded hover:bg-amber-100/80 transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            {Array.isArray(item.repairLogs) && item.repairLogs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setViewingOtherStock(item)}
                                title="Delete Repair Log Entry"
                                className="p-1 text-amber-800 hover:text-danger rounded hover:bg-danger-light transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-extrabold text-amber-700 mt-0.5 block text-center">
                          {item.underRepair || 0}
                        </span>
                      </div>
                    </div>


                    <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t border-border/40">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => handleOpenRepairModal(item, 'SEND')}
                        icon={<Wrench className="w-3 h-3" />}
                        className="font-semibold text-[11px] py-1 px-2 border-amber-300 text-amber-800 hover:bg-amber-50"
                        title="Send items for repair"
                        disabled={item.count <= 0}
                      >
                        Repair
                      </Button>

                      {(item.underRepair || 0) > 0 && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => handleOpenRepairModal(item, 'RETURN')}
                          icon={<RotateCcw className="w-3 h-3" />}
                          className="font-semibold text-[11px] py-1 px-2 border-emerald-300 text-emerald-800 hover:bg-emerald-50"
                          title="Return items from repair"
                        >
                          Return from Repair
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. ADD STOCK MODAL */}
      <Modal
        isOpen={isAddStockOpen}
        onClose={() => setIsAddStockOpen(false)}
        title="Add Site Stock"
        description="Add feed or medicine inventory directly to a specific site."
        size="md"
      >
        <AddStockForm
          onSubmit={handleAddStockSubmit}
          onCancel={() => setIsAddStockOpen(false)}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* 4. EDIT STOCK MODAL */}
      <Modal
        isOpen={Boolean(editingStock)}
        onClose={() => setEditingStock(null)}
        title={`Edit ${editingStock?.category === 'FEED' ? 'Feed' : 'Medicine'} Stock`}
        description="Update total site stock inventory quantity and date."
        size="md"
      >
        {editingStock && (
          <form onSubmit={handleUpdateStockSubmit} className="space-y-4 pt-2">
            <Input
              label="Stocking Date *"
              type="date"
              required
              value={editingStockingDate}
              onChange={(e) => setEditingStockingDate(e.target.value)}
            />

            <Input
              label={`Total Quantity (${editingStock.unit}) *`}
              type="number"
              min="0.1"
              step="0.01"
              required
              value={editingStockQuantity}
              onChange={(e) => setEditingStockQuantity(e.target.value)}
              placeholder="e.g. 100"
            />

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingStock(null)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Updating...' : 'Update Stock'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* 4.5 VIEW STOCK DETAILS MODAL */}
      <Modal
        isOpen={Boolean(viewingStock)}
        onClose={() => setViewingStock(null)}
        title={`${viewingStock?.category === 'FEED' ? 'Feed' : 'Medicine'} Stock Details`}
        description={`Inventory details for ${viewingStock?.site?.siteName || viewingStock?.siteName || 'Site'}`}
        size="md"
      >
        {viewingStock && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-primary-light/30 border border-primary/20 space-y-3 shadow-2xs">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface p-3 rounded-lg border border-border/50">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold block">Site</span>
                  <span className="text-sm font-bold text-text-primary mt-0.5 block">{viewingStock.site?.siteName || viewingStock.siteName || 'N/A'}</span>
                </div>
                <div className="bg-surface p-3 rounded-lg border border-border/50">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold block">Category</span>
                  <span className="text-sm font-bold text-text-primary mt-0.5 block">{viewingStock.category}</span>
                </div>
                <div className="bg-surface p-3 rounded-lg border border-border/50 col-span-2">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold block flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-primary" /> Stocking Date
                  </span>
                  <span className="text-sm font-bold text-primary mt-0.5 block">
                    {viewingStock.stockingDate
                      ? new Date(viewingStock.stockingDate).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'long',
                          year: 'numeric',
                        })
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 rounded-xl bg-teal-50 border border-teal-100">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Total Added</span>
                <span className="text-base font-bold text-text-primary mt-0.5 block">
                  {viewingStock.added || viewingStock.totalQuantity} {viewingStock.unit}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Quantity Used</span>
                <span className="text-base font-bold text-amber-700 mt-0.5 block">
                  {viewingStock.used ?? 0} {viewingStock.unit}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Remaining</span>
                <span className="text-base font-bold text-emerald-700 mt-0.5 block">
                  {viewingStock.remaining ?? viewingStock.added ?? 0} {viewingStock.unit}
                </span>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setViewingStock(null)}>
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 5. DELETE STOCK CONFIRMATION DIALOG (Step 1) */}
      <ConfirmationDialog
        isOpen={Boolean(deletingStockId) && !isPasswordOpen}
        onClose={() => setDeletingStockId(null)}
        onConfirm={handleAcceptDeleteStep1}
        title="Delete Stock Record"
        message="Are you sure you want to delete this stock record from the site?"
        confirmText="Delete Stock"
        type="danger"
      />

      {/* 6. PASSWORD CONFIRMATION MODAL (Step 2) */}
      <PasswordConfirmationModal
        isOpen={isPasswordOpen}
        onClose={() => {
          setIsPasswordOpen(false);
          setDeletingStockId(null);
        }}
        onConfirm={handleFinalDeleteWithPassword}
      />

      {/* 7. OTHER STOCK MODAL */}
      <OtherStockModal
        isOpen={isOtherStockModalOpen}
        onClose={() => {
          setIsOtherStockModalOpen(false);
          setEditingOtherStock(null);
        }}
        onSubmit={handleSaveOtherStock}
        initialData={editingOtherStock}
        sites={sites}
        isSubmitting={isOtherStockSubmitting}
      />

      {/* 8. OTHER STOCK DELETE PASSWORD CONFIRMATION MODAL */}
      <PasswordConfirmationModal
        isOpen={isOtherStockPasswordOpen}
        onClose={() => {
          setIsOtherStockPasswordOpen(false);
          setDeletingOtherStockId(null);
        }}
        onConfirm={handleConfirmDeleteOtherStockWithPassword}
        title="Delete Other Stock"
        message="Enter your password to confirm deletion of this stock record."
      />

      {/* 9. STOCK TRANSFER MODAL */}
      <StockTransferModal
        isOpen={Boolean(transferSource)}
        onClose={() => setTransferSource(null)}
        onSubmit={handleTransferSubmit}
        fromSite={transferSource?.site}
        availableSites={sites}
        siteStockInfo={transferSource}
        isSubmitting={isTransferSubmitting}
      />

      {/* 10. OTHER STOCK TRANSFER MODAL */}
      <OtherStockTransferModal
        isOpen={Boolean(otherStockTransferSource)}
        onClose={() => setOtherStockTransferSource(null)}
        onSubmit={handleOtherStockTransferSubmit}
        fromSite={otherStockTransferSource?.site}
        availableSites={sites}
        siteOtherStockList={otherStocks}
        initialCategory={otherStockTransferSource?.initialCategory}
        isSubmitting={isOtherStockTransferSubmitting}
      />

      {/* 11. OTHER STOCK REPAIR MODAL */}
      <OtherStockRepairModal
        isOpen={repairModalState.isOpen}
        onClose={() => setRepairModalState({ isOpen: false, mode: 'SEND', item: null })}
        onSubmit={handleRepairSubmit}
        mode={repairModalState.mode}
        item={repairModalState.item}
        isSubmitting={isRepairSubmitting}
      />

      {/* 12. OTHER STOCK DETAILS & HISTORY LOG MODAL */}
      <Modal
        isOpen={Boolean(viewingOtherStock)}
        onClose={() => setViewingOtherStock(null)}
        title={`${viewingOtherStock?.category || 'Other Stock'} History & Details`}
        description={`Repair history and inventory details for ${viewingOtherStock?.site?.siteName || viewingOtherStock?.siteName || 'Site'}`}
        size="md"
      >
        {viewingOtherStock && (
          <div className="space-y-4 pt-2">
            <div className="p-4 rounded-xl bg-primary-light/30 border border-primary/20 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-surface p-3 rounded-lg border border-border/50">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold block">Site</span>
                  <span className="text-sm font-bold text-text-primary mt-0.5 block">{viewingOtherStock.site?.siteName || viewingOtherStock.siteName || 'N/A'}</span>
                </div>
                <div className="bg-surface p-3 rounded-lg border border-border/50">
                  <span className="text-[10px] text-text-secondary uppercase font-semibold block">Category</span>
                  <span className="text-sm font-bold text-text-primary mt-0.5 block">{viewingOtherStock.category}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2.5 rounded-xl bg-background border border-border/50">
                <span className="text-[10px] uppercase font-bold text-text-secondary block">Total</span>
                <span className="text-base font-extrabold text-text-primary mt-0.5 block">
                  {viewingOtherStock.count + (viewingOtherStock.underRepair || 0)}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100">
                <span className="text-[10px] uppercase font-bold text-emerald-800 block">Available</span>
                <span className="text-base font-extrabold text-emerald-700 mt-0.5 block">
                  {viewingOtherStock.count}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-100">
                <span className="text-[10px] uppercase font-bold text-amber-800 block">Under Repair</span>
                <span className="text-base font-extrabold text-amber-700 mt-0.5 block">
                  {viewingOtherStock.underRepair || 0}
                </span>
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="font-bold text-xs text-text-primary flex items-center gap-1.5 uppercase tracking-wider">
                <Wrench className="w-3.5 h-3.5 text-primary" /> Stock History & Repair Log
              </h4>

              {Array.isArray(viewingOtherStock.repairLogs) && viewingOtherStock.repairLogs.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {viewingOtherStock.repairLogs.map((log) => {
                    const isSend = log.actionType === 'REPAIR';
                    const dateStr = log.createdAt
                      ? new Date(log.createdAt).toLocaleDateString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric'
                        })
                      : '';

                    return (
                      <div
                        key={log.id}
                        className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                          isSend
                            ? 'bg-amber-50/50 border-amber-200/60'
                            : 'bg-emerald-50/50 border-emerald-200/60'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-text-secondary">{dateStr}</span>
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                                isSend
                                  ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}
                            >
                              {isSend ? 'Sent for Repair' : 'Returned from Repair'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setDeletingRepairLogId(log.id)}
                              title="Delete this repair log entry"
                              className="p-1 text-text-secondary hover:text-danger rounded hover:bg-danger-light transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>


                        <div className="font-bold text-text-primary">
                          Quantity: {log.quantity}
                        </div>

                        {log.notes && (
                          <div className="pt-1 text-text-secondary text-[11px] border-t border-border/40">
                            <span className="font-semibold text-text-primary">Notes:</span> {log.notes}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="py-4 text-center text-xs text-text-secondary bg-background/50 rounded-xl border border-dashed border-border/60">
                  No repair history recorded yet.
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-border">
              <Button variant="outline" size="sm" onClick={() => setViewingOtherStock(null)}>
                Close Details
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* 13. DELETE REPAIR LOG CONFIRMATION DIALOG */}
      <ConfirmationDialog
        isOpen={Boolean(deletingRepairLogId)}
        onClose={() => setDeletingRepairLogId(null)}
        onConfirm={handleDeleteRepairLogSubmit}
        title="Delete Repair Log Entry"
        message="Are you sure you want to delete this repair log entry? This will adjust Under Repair and Available stock counts accordingly."
        confirmText="Delete Repair Log"
        type="danger"
      />

      {/* 14. TRANSFER LOG MODAL */}
      <Modal
        isOpen={isTransferLogOpen}
        onClose={() => setIsTransferLogOpen(false)}
        title="Stock & Equipment Transfer Log"
        description="History of all feed, medicine, and equipment transfers between sites."
        size="lg"
      >
        <div className="space-y-4 pt-2">
          {loadingLogs ? (
            <div className="py-8 flex justify-center items-center">
              <Loader size="md" text="Loading transfer history..." />
            </div>
          ) : transferLogs.length === 0 ? (
            <div className="py-8 text-center text-xs text-text-secondary bg-background/50 rounded-xl border border-dashed border-border/60">
              No stock or equipment transfers recorded yet.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
              {transferLogs.map((log) => {
                const dateStr = log.createdAt
                  ? new Date(log.createdAt).toLocaleString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      hour12: true
                    })
                  : 'N/A';

                return (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-xl border border-border/80 bg-surface shadow-2xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md font-extrabold text-[10px] uppercase tracking-wider ${
                            log.category === 'FEED'
                              ? 'bg-teal-100 text-teal-800 border border-teal-200'
                              : log.category === 'MEDICINE'
                              ? 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {log.category}
                        </span>
                        <span className="text-[11px] font-semibold text-text-secondary flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-text-secondary" /> {dateStr}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <div className="space-y-0.5">
                        <div className="text-sm font-extrabold text-text-primary flex items-center gap-2">
                          <span>
                            {log.quantity} {log.unit} {log.category}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-text-primary">Transferred from:</span>
                          <span className="bg-primary-light/60 px-2 py-0.5 rounded text-primary font-bold">{log.fromSiteName}</span>
                          <ArrowRight className="w-4 h-4 text-primary shrink-0" />
                          <span className="bg-emerald-100/70 px-2 py-0.5 rounded text-emerald-800 font-bold">{log.toSiteName}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border">
            <Button variant="outline" size="sm" onClick={() => setIsTransferLogOpen(false)}>
              Close Log
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}



