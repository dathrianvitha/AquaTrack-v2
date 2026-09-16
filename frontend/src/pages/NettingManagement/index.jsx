import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Edit2, Trash2, Calendar, Scale, Hash, Filter, RefreshCw } from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PasswordConfirmationModal } from '../../components/PasswordConfirmationModal';
import { EmptyState } from '../../components/EmptyState';
import { Loader } from '../../components/Loader';

import nettingService from '../../services/nettingService';
import siteService from '../../services/siteService';
import tankService from '../../services/tankService';

// Helper to convert sequence number to ordinal string (1 -> 1st, 2 -> 2nd, 3 -> 3rd...)
const getOrdinalSuffix = (num) => {
  const n = Number(num);
  if (!n || isNaN(n)) return `${num}th`;
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

// Format date nicely: e.g. "16 Sept 2026"
const formatDateString = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export default function NettingManagement() {
  // Data States
  const [nettings, setNettings] = useState([]);
  const [sites, setSites] = useState([]);
  const [tanks, setTanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  // Filter States
  const [siteFilter, setSiteFilter] = useState('');
  const [tankFilter, setTankFilter] = useState('');

  // Modal Control States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingNetting, setEditingNetting] = useState(null);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Field States
  const [formData, setFormData] = useState({
    siteId: '',
    tankId: '',
    shrimpCount: '',
    nettingDate: new Date().toISOString().split('T')[0]
  });

  // Delete States
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [deletingNetting, setDeletingNetting] = useState(null);

  // Load initial data
  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [nettingsRes, sitesRes, tanksRes] = await Promise.all([
        nettingService.getNettings(),
        siteService.getSites(),
        tankService.getTanks()
      ]);

      setNettings(nettingsRes.data || []);
      setSites(sitesRes.data || []);
      setTanks(tanksRes.data || []);
    } catch (err) {
      console.error('Error fetching netting data:', err);
      setErrorMsg(err.message || 'Failed to load netting data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter tanks for the form based on selected site in form
  const availableTanksForForm = useMemo(() => {
    if (!formData.siteId) return [];
    return tanks.filter((t) => t.siteId === formData.siteId);
  }, [tanks, formData.siteId]);

  // Filter tanks for the page filter dropdown based on selected siteFilter
  const availableTanksForFilter = useMemo(() => {
    if (!siteFilter) return tanks;
    return tanks.filter((t) => t.siteId === siteFilter);
  }, [tanks, siteFilter]);

  // Reset tank filter if selected tank no longer belongs to filtered site
  useEffect(() => {
    if (tankFilter && siteFilter) {
      const isValid = availableTanksForFilter.some((t) => t.id === tankFilter);
      if (!isValid) {
        setTankFilter('');
      }
    }
  }, [siteFilter, tankFilter, availableTanksForFilter]);

  // Filtered Nettings List
  const filteredNettings = useMemo(() => {
    return nettings.filter((record) => {
      const matchesSite = !siteFilter || record.siteId === siteFilter;
      const matchesTank = !tankFilter || record.tankId === tankFilter;
      return matchesSite && matchesTank;
    });
  }, [nettings, siteFilter, tankFilter]);

  // Calculated weight live in grams
  const liveCalculatedWeightGrams = useMemo(() => {
    const count = Number(formData.shrimpCount);
    if (!count || isNaN(count) || count <= 0) return 0;
    return count / 1000;
  }, [formData.shrimpCount]);

  // Modal Handlers
  const handleOpenAdd = () => {
    setEditingNetting(null);
    setFormError('');
    setFormData({
      siteId: sites.length === 1 ? sites[0].id : '',
      tankId: '',
      shrimpCount: '',
      nettingDate: new Date().toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (record) => {
    setEditingNetting(record);
    setFormError('');
    setFormData({
      siteId: record.siteId,
      tankId: record.tankId,
      shrimpCount: record.shrimpCount ? String(record.shrimpCount) : '',
      nettingDate: record.nettingDate
        ? new Date(record.nettingDate).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0]
    });
    setIsFormOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!editingNetting) {
      if (!formData.siteId) {
        setFormError('Please select a Site.');
        return;
      }
      if (!formData.tankId) {
        setFormError('Please select a Tank.');
        return;
      }
    }

    const count = Number(formData.shrimpCount);
    if (!count || isNaN(count) || count <= 0) {
      setFormError('Please enter a valid total shrimp count.');
      return;
    }

    if (!formData.nettingDate) {
      setFormError('Please select a netting date.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingNetting) {
        await nettingService.updateNetting(editingNetting.id, {
          shrimpCount: count,
          nettingDate: formData.nettingDate
        });
      } else {
        await nettingService.createNetting({
          siteId: formData.siteId,
          tankId: formData.tankId,
          shrimpCount: count,
          nettingDate: formData.nettingDate
        });
      }

      setIsFormOpen(false);
      setEditingNetting(null);
      await fetchData();
    } catch (err) {
      console.error('Error saving netting:', err);
      setFormError(err.message || 'Failed to save netting record');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Handlers
  const handleOpenDelete = (record) => {
    setDeletingNetting(record);
    setIsDeleteOpen(true);
  };

  const handleAcceptDeleteStep1 = () => {
    setIsDeleteOpen(false);
    setIsPasswordOpen(true);
  };

  const handleFinalDeleteWithPassword = async (password) => {
    if (deletingNetting) {
      await nettingService.deleteNetting(deletingNetting.id, password);
      setIsPasswordOpen(false);
      setDeletingNetting(null);
      await fetchData();
    }
  };

  const handleResetFilters = () => {
    setSiteFilter('');
    setTankFilter('');
  };

  if (loading) {
    return <Loader fullPage={false} text="Loading Netting Records..." />;
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Netting Management"
        subtitle="Track shrimp count observations for crops."
        actions={
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            icon={<Plus className="w-4 h-4" />}
            className="font-semibold shadow-xs"
          >
            Add Netting
          </Button>
        }
      />

      {errorMsg && (
        <div className="p-4 bg-danger-light/30 border border-danger/40 text-danger rounded-xl text-sm font-medium">
          {errorMsg}
        </div>
      )}

      {/* 2. SITE & TANK FILTERS */}
      <Card padding="compact" className="border-border/80 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3.5">
          <div className="flex items-center gap-2 text-text-secondary text-xs font-semibold uppercase tracking-wider shrink-0">
            <Filter className="w-3.5 h-3.5" />
            <span>Filters</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
            {/* Site Filter */}
            <Select
              value={siteFilter}
              onChange={(e) => setSiteFilter(e.target.value)}
              placeholder="All Sites"
              options={[
                { value: '', label: 'All Sites' },
                ...sites.map((s) => ({
                  value: s.id,
                  label: s.siteName
                }))
              ]}
              className="bg-background text-sm"
            />

            {/* Tank Filter (Respects selected site) */}
            <Select
              value={tankFilter}
              onChange={(e) => setTankFilter(e.target.value)}
              placeholder="All Tanks"
              options={[
                { value: '', label: 'All Tanks' },
                ...availableTanksForFilter.map((t) => {
                  const siteName = t.site?.siteName || sites.find((s) => s.id === t.siteId)?.siteName || '';
                  return {
                    value: t.id,
                    label: siteName ? `${t.tankName} (${siteName})` : t.tankName
                  };
                })
              ]}
              className="bg-background text-sm"
            />
          </div>

          {(siteFilter || tankFilter) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              icon={<RefreshCw className="w-3.5 h-3.5" />}
              className="text-text-secondary hover:text-text-primary self-end sm:self-center text-xs"
            >
              Reset
            </Button>
          )}
        </div>
      </Card>

      {/* 3. NETTING RECORDS GRID OR EMPTY STATE */}
      {filteredNettings.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredNettings.map((record) => {
            const tankName = record.tank?.tankName || 'Tank';
            const siteName = record.site?.siteName || record.tank?.site?.siteName || 'Site';
            const batchNum = record.crop?.batchNumber || record.crop?.cropName || 'N/A';
            const seqLabel = `${getOrdinalSuffix(record.nettingNumber)} Netting`;

            return (
              <Card
                key={record.id}
                padding="normal"
                className="hover:shadow-md transition-all duration-200 border-border/80 flex flex-col justify-between"
              >
                <div className="space-y-3.5">
                  {/* Header: Tank — Site */}
                  <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-2.5">
                    <div>
                      <h3 className="font-bold text-base text-text-primary tracking-tight">
                        {tankName} <span className="text-text-secondary font-normal">— {siteName}</span>
                      </h3>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-semibold text-primary bg-primary-light/40 px-2 py-0.5 rounded-md">
                          Batch #{batchNum}
                        </span>
                      </div>
                    </div>

                    <div className="bg-emerald-50 text-emerald-700 font-bold text-xs px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                      {seqLabel}
                    </div>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-3 gap-2 py-1 bg-background/50 rounded-lg p-2.5 border border-border/40 text-xs">
                    <div>
                      <span className="text-text-secondary text-[11px] block flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> Date
                      </span>
                      <span className="font-semibold text-text-primary mt-0.5 block">
                        {formatDateString(record.nettingDate)}
                      </span>
                    </div>

                    <div>
                      <span className="text-text-secondary text-[11px] block flex items-center gap-1">
                        <Hash className="w-3 h-3" /> Shrimp Count
                      </span>
                      <span className="font-bold text-text-primary mt-0.5 block text-sm">
                        {Number(record.shrimpCount).toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-text-secondary text-[11px] block flex items-center gap-1">
                        <Scale className="w-3 h-3" /> Weight
                      </span>
                      <span className="font-bold text-primary mt-0.5 block text-sm">
                        {Number(record.weightGrams).toLocaleString(undefined, { maximumFractionDigits: 2 })} g
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="flex items-center justify-end gap-1.5 pt-3 border-t border-border/40 mt-3">
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleOpenEdit(record)}
                    icon={<Edit2 className="w-3.5 h-3.5" />}
                    title="Edit Netting"
                  >
                    Edit
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => handleOpenDelete(record)}
                    icon={<Trash2 className="w-3.5 h-3.5" />}
                    className="text-danger hover:bg-danger-light/50"
                    title="Delete Netting"
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card padding="relaxed" className="border-border/80 shadow-2xs">
          <EmptyState
            title="No Netting Records Found"
            description={
              siteFilter || tankFilter
                ? "No netting observations match your selected site or tank filter."
                : "No netting observations have been recorded yet."
            }
            actionLabel={
              siteFilter || tankFilter ? "Reset Filters" : "Add Netting Record"
            }
            onAction={
              siteFilter || tankFilter ? handleResetFilters : handleOpenAdd
            }
          />
        </Card>
      )}

      {/* 4. ADD / EDIT NETTING MODAL */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingNetting(null);
        }}
        title={editingNetting ? 'Edit Netting Record' : 'Add Netting Record'}
        description={
          editingNetting
            ? 'Update shrimp count observation or netting date.'
            : 'Select site and tank to record a shrimp count observation.'
        }
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-3 bg-danger-light/40 border border-danger/50 text-danger rounded-lg text-xs font-medium">
              {formError}
            </div>
          )}

          {/* 1. Site Selection (Read-only during edit) */}
          <Select
            label="Site"
            required
            disabled={!!editingNetting}
            value={formData.siteId}
            onChange={(e) => {
              const newSiteId = e.target.value;
              setFormData((prev) => ({
                ...prev,
                siteId: newSiteId,
                tankId: '' // reset tank selection on site change
              }));
            }}
            placeholder="Select Site..."
            options={sites.map((s) => ({
              value: s.id,
              label: s.siteName
            }))}
          />

          {/* 2. Tank Selection (Filtered by Site, Read-only during edit) */}
          <Select
            label="Tank"
            required
            disabled={!!editingNetting || !formData.siteId}
            value={formData.tankId}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                tankId: e.target.value
              }));
            }}
            placeholder={
              formData.siteId
                ? availableTanksForForm.length > 0
                  ? "Select Tank..."
                  : "No tanks found for this site"
                : "First select a Site"
            }
            options={availableTanksForForm.map((t) => ({
              value: t.id,
              label: t.tankName
            }))}
            helperText={
              !formData.siteId
                ? 'Select a site to load its tanks.'
                : availableTanksForForm.length === 0
                ? 'No tanks available in the selected site.'
                : undefined
            }
          />

          {/* 3. Total Shrimp Count */}
          <div className="space-y-1.5">
            <Input
              label="Total Shrimp Count"
              type="number"
              required
              min="1"
              step="1"
              placeholder="e.g. 10000"
              value={formData.shrimpCount}
              onChange={(e) => {
                setFormData((prev) => ({
                  ...prev,
                  shrimpCount: e.target.value
                }));
              }}
            />

            {/* LIVE CALCULATED WEIGHT DISPLAY */}
            <div className="p-3 bg-primary-light/30 border border-primary/20 rounded-lg flex items-center justify-between">
              <span className="text-xs font-medium text-text-secondary flex items-center gap-1.5">
                <Scale className="w-4 h-4 text-primary" /> Calculated Average Weight:
              </span>
              <span className="text-sm font-bold text-primary">
                {liveCalculatedWeightGrams.toLocaleString(undefined, { maximumFractionDigits: 2 })} g
              </span>
            </div>
          </div>

          {/* 4. Date */}
          <Input
            label="Date"
            type="date"
            required
            value={formData.nettingDate}
            onChange={(e) => {
              setFormData((prev) => ({
                ...prev,
                nettingDate: e.target.value
              }));
            }}
          />

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setIsFormOpen(false);
                setEditingNetting(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmitting}
              className="font-semibold"
            >
              {isSubmitting ? 'Saving...' : 'Save Netting'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* 5. DELETE CONFIRMATION DIALOG (Step 1) */}
      <ConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingNetting(null);
        }}
        onConfirm={handleAcceptDeleteStep1}
        title="Delete Netting Record"
        message={
          deletingNetting
            ? `Are you sure you want to delete the ${getOrdinalSuffix(deletingNetting.nettingNumber)} netting record for tank "${deletingNetting.tank?.tankName || 'Tank'}"?`
            : 'Are you sure you want to delete this netting record?'
        }
        confirmText="Delete Netting Record"
        cancelText="Cancel"
        type="danger"
      />

      {/* 6. PASSWORD CONFIRMATION MODAL (Step 2) */}
      <PasswordConfirmationModal
        isOpen={isPasswordOpen}
        onClose={() => {
          setIsPasswordOpen(false);
          setDeletingNetting(null);
        }}
        onConfirm={handleFinalDeleteWithPassword}
      />
    </div>
  );
}
