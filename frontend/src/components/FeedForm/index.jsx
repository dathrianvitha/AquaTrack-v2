import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { UtensilsCrossed, Container, Calendar, IndianRupee, Package, AlertCircle } from 'lucide-react';

import { Input } from '../Input';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { useTanks } from '../../context/TankContext';
import { useSites } from '../../context/SiteContext';
import { useStocking } from '../../context/StockingContext';

// Zod Validation Schema matching required text inputs
const feedSchema = z.object({
  tankId: z
    .string()
    .min(1, 'Please select a Tank'),
  date: z
    .string()
    .min(1, 'Date is required'),
  feedBrand: z
    .string()
    .min(1, 'Feed Brand is required')
    .trim(),
  feedType: z
    .string()
    .min(1, 'Feed Type is required')
    .trim(),
  quantity: z
    .coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0'),
  costPerKg: z
    .coerce
    .number({ invalid_type_error: 'Cost per kg must be a number' })
    .positive('Cost per kg must be greater than 0'),
  notes: z
    .string()
    .optional(),
});

/**
 * Reusable FeedForm component with dynamic Site -> Tank selection hierarchy from SiteContext & TankContext
 * and real-time Site Stock Availability indicator and validation.
 */
export const FeedForm = ({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
  formError = '',
}) => {
  const { tanks = [] } = useTanks();
  const { sites = [] } = useSites();
  const { stockings = [] } = useStocking();
  const isEditing = Boolean(initialData?.id);

  const [selectedSiteId, setSelectedSiteId] = useState('');

  // Map registered sites for dropdown selection
  const siteSelectOptions = useMemo(() => {
    return sites.map((site) => {
      const rawName = site.siteName || site.name || 'Site';
      const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName;
      return {
        value: String(site.id),
        label: cleanName,
      };
    });
  }, [sites]);

  // Filter tanks belonging strictly to the selected Site
  const filteredTanks = useMemo(() => {
    if (!selectedSiteId) return [];
    return tanks.filter((tank) => String(tank.siteId || tank.site?.id) === String(selectedSiteId));
  }, [tanks, selectedSiteId]);

  // Format Tank label as Tank Name — Site Name (e.g. T1 — Juvvalapalem)
  const tankSelectOptions = useMemo(() => {
    return filteredTanks.map((tank) => {
      const rawName = tank.name || tank.tankName || 'Tank';
      const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName;
      const siteName = tank.siteName || tank.site?.siteName || '';
      const label = siteName ? `${cleanName} — ${siteName}` : cleanName;
      return {
        value: String(tank.id),
        label,
      };
    });
  }, [filteredTanks]);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(feedSchema),
    defaultValues: {
      tankId: '',
      date: new Date().toISOString().split('T')[0],
      feedBrand: '',
      feedType: '',
      quantity: '',
      costPerKg: '',
      notes: '',
    },
    mode: 'onTouched',
  });

  const selectedTankId = watch('tankId');
  const quantityValue = watch('quantity');
  const enteredQuantity = parseFloat(quantityValue) || 0;

  // Identify selected tank and site
  const selectedTank = useMemo(() => {
    return tanks.find((t) => String(t.id) === String(selectedTankId));
  }, [tanks, selectedTankId]);

  const siteId = selectedTank?.siteId || selectedTank?.site?.id || selectedSiteId;

  // Compute available feed stock for selected site
  const siteFeedStockInfo = useMemo(() => {
    if (!siteId) return null;

    let totalAdded = 0;
    let used = 0;
    let unit = 'kg';

    stockings.forEach((s) => {
      const isFeed = s.category?.toUpperCase() === 'FEED';
      const isDirectSite = s.siteId && String(s.siteId) === String(siteId);

      if (isFeed && isDirectSite) {
        totalAdded += parseFloat(s.totalQuantity) || 0;
        used = parseFloat(s.totalUsed) || 0;
        if (s.unit) unit = s.unit;
      } else if (isFeed && Array.isArray(s.siteStock)) {
        const alloc = s.siteStock.find((ss) => String(ss.site?.id || ss.siteId) === String(siteId));
        if (alloc) {
          totalAdded += parseFloat(alloc.allocatedQuantity) || 0;
          used = parseFloat(alloc.usedQuantity) || 0;
          if (alloc.unit || s.unit) unit = alloc.unit || s.unit;
        }
      }
    });

    const currentLogQty = isEditing ? (parseFloat(initialData?.quantity || initialData?.quantityKg) || 0) : 0;
    const effectiveUsed = Math.max(used - currentLogQty, 0);
    const remaining = Math.max(totalAdded - effectiveUsed, 0);
    const matchingSite = sites.find((s) => String(s.id) === String(siteId));
    const siteName = selectedTank?.site?.siteName || selectedTank?.siteName || matchingSite?.siteName || matchingSite?.name || 'this site';

    return {
      totalAdded,
      used: effectiveUsed,
      remaining,
      unit,
      siteName,
      hasStock: totalAdded > 0,
    };
  }, [siteId, stockings, selectedTank, isEditing, initialData, sites]);

  const isExcess = Boolean(siteFeedStockInfo && siteFeedStockInfo.hasStock && enteredQuantity > siteFeedStockInfo.remaining);
  const isNoStock = Boolean(siteFeedStockInfo && !siteFeedStockInfo.hasStock);

  const quantityErrorMessage = errors.quantity?.message || (
    isExcess
      ? `Only ${siteFeedStockInfo.remaining} ${siteFeedStockInfo.unit} of feed is available for this site.`
      : isNoStock && enteredQuantity > 0
        ? `No feed stock added for ${siteFeedStockInfo.siteName} yet.`
        : undefined
  );

  const isSubmitDisabled = isSubmitting || isExcess || (isNoStock && enteredQuantity > 0);

  // Initialize or reset form values
  useEffect(() => {
    if (initialData) {
      const initTankId = initialData.tankId ? String(initialData.tankId) : '';
      const matchingTank = tanks.find((t) => String(t.id) === initTankId);
      const initSiteId = matchingTank?.siteId || matchingTank?.site?.id ? String(matchingTank.siteId || matchingTank.site.id) : '';
      setSelectedSiteId(initSiteId);

      reset({
        tankId: initTankId,
        date: initialData.date || initialData.feedingDate || '',
        feedBrand: initialData.feedBrand || '',
        feedType: initialData.feedType || '',
        quantity: initialData.quantity || initialData.quantityKg || '',
        costPerKg: initialData.costPerKg || (initialData.feedCost && initialData.quantityKg ? initialData.feedCost / initialData.quantityKg : ''),
        notes: initialData.notes || '',
      });
    } else {
      setSelectedSiteId('');
      reset({
        tankId: '',
        date: new Date().toISOString().split('T')[0],
        feedBrand: '',
        feedType: '',
        quantity: '',
        costPerKg: '',
        notes: '',
      });
    }
  }, [initialData, reset, tanks]);

  // Handle site dropdown change and clear previously selected tank
  const handleSiteChange = (e) => {
    const newSiteId = e.target.value;
    setSelectedSiteId(newSiteId);
    setValue('tankId', '', { shouldValidate: true });
  };

  const isTankDisabled = !selectedSiteId || filteredTanks.length === 0;
  const tankPlaceholder = !selectedSiteId
    ? 'Choose site first...'
    : filteredTanks.length === 0
      ? 'No tanks available for this site'
      : 'Choose tank...';

  const handleFormSubmit = (data) => {
    if (isExcess || (isNoStock && enteredQuantity > 0)) {
      return;
    }

    const selectedTankObj = tanks.find((t) => String(t.id) === String(data.tankId));
    const rawTankName = selectedTankObj ? (selectedTankObj.name || selectedTankObj.tankName) : 'Selected Tank';
    const cleanTankName = rawTankName.replace(/\s*\([^)]*\)/g, '').trim();

    const feedPayload = {
      tankId: data.tankId,
      date: data.date,
      feedBrand: data.feedBrand.trim(),
      feedType: data.feedType.trim(),
      feedSize: initialData?.feedSize || '1.2mm',
      quantity: parseFloat(data.quantity),
      costPerKg: parseFloat(data.costPerKg),
      notes: data.notes ? data.notes.trim() : '',
    };

    if (onSubmit) {
      onSubmit({
        ...feedPayload,
        tankName: cleanTankName,
        quantityKg: feedPayload.quantity,
        feedingDate: feedPayload.date,
        feedCost: feedPayload.quantity * feedPayload.costPerKg,
        status: initialData?.status || 'Completed',
      });
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>
      {/* FORM LEVEL ERROR BANNER */}
      {formError && (
        <div className="p-3.5 rounded-xl bg-danger-light/40 border border-danger/30 text-danger text-xs font-semibold flex items-center gap-2.5 shadow-2xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      {/* SECTION 1: BASIC INFORMATION */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border/50 pb-1 flex items-center gap-1.5">
          <Container className="w-3.5 h-3.5 text-primary" /> Basic Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Choose Site"
            required={true}
            placeholder="Choose site..."
            options={siteSelectOptions}
            value={selectedSiteId}
            onChange={handleSiteChange}
          />

          <Select
            label="Choose Tank"
            required={true}
            placeholder={tankPlaceholder}
            options={tankSelectOptions}
            disabled={isTankDisabled}
            error={errors.tankId?.message}
            {...register('tankId')}
          />
        </div>

        <div>
          <Input
            label="Feeding Date"
            type="date"
            required={true}
            icon={<Calendar className="w-4 h-4" />}
            error={errors.date?.message}
            {...register('date')}
          />
        </div>
      </div>

      {/* SECTION 2: FEED INFORMATION */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border/50 pb-1 flex items-center gap-1.5">
          <Package className="w-3.5 h-3.5 text-primary" /> Feed Specifications
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Feed Brand"
            type="text"
            placeholder="Enter feed brand..."
            required={true}
            icon={<Package className="w-4 h-4" />}
            error={errors.feedBrand?.message}
            {...register('feedBrand')}
          />

          <Input
            label="Feed Type"
            type="text"
            placeholder="Enter feed type..."
            required={true}
            icon={<Package className="w-4 h-4" />}
            error={errors.feedType?.message}
            {...register('feedType')}
          />
        </div>
      </div>

      {/* SECTION 3: QUANTITY & COST */}
      <div className="p-4 rounded-xl bg-primary-light/30 border border-primary/20 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <UtensilsCrossed className="w-3.5 h-3.5" /> Quantity & Cost
          </h4>

          {selectedTankId && siteFeedStockInfo && (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
              isExcess
                ? 'bg-danger-light/60 border-danger/40 text-danger'
                : isNoStock
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-teal-50 border-teal-200 text-teal-800'
            }`}>
              Available: {siteFeedStockInfo.remaining} {siteFeedStockInfo.unit}
            </span>
          )}
        </div>

        {/* STOCK AVAILABILITY INDICATOR BADGE */}
        {selectedTankId && siteFeedStockInfo && (
          <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between font-medium transition-colors ${
            isExcess
              ? 'bg-danger-light/30 border-danger/40 text-danger'
              : isNoStock
                ? 'bg-amber-50 border-amber-200 text-amber-800'
                : 'bg-teal-50/80 border-teal-200 text-teal-800'
          }`}>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="w-3.5 h-3.5 shrink-0" />
              <span>
                Available Feed Stock: <strong>{siteFeedStockInfo.remaining} {siteFeedStockInfo.unit}</strong>
              </span>
            </div>
            <span className="text-[10px] opacity-80">({siteFeedStockInfo.siteName})</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Quantity (Kg)"
            type="number"
            step="0.5"
            placeholder="e.g. 45"
            required={true}
            icon={<UtensilsCrossed className="w-4 h-4 text-primary" />}
            error={quantityErrorMessage}
            {...register('quantity')}
          />

          <Input
            label="Cost Per Kg (₹)"
            type="number"
            step="1"
            placeholder="e.g. 70"
            required={true}
            icon={<IndianRupee className="w-4 h-4 text-primary" />}
            error={errors.costPerKg?.message}
            {...register('costPerKg')}
          />
        </div>
      </div>

      {/* SECTION 4: OPTIONAL NOTES */}
      <div>
        <Textarea
          label="Notes (Optional)"
          placeholder="Add any additional notes..."
          rows={2}
          error={errors.notes?.message}
          {...register('notes')}
        />
      </div>

      {/* ACTION BUTTONS */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/80">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>

        <Button
          type="submit"
          variant="primary"
          isLoading={isSubmitting}
          disabled={isSubmitDisabled}
          className="font-semibold"
        >
          {isEditing ? (isSubmitting ? 'Updating...' : 'Update Feed Log') : (isSubmitting ? 'Recording...' : 'Record Feed')}
        </Button>
      </div>
    </form>
  );
};

export default FeedForm;
