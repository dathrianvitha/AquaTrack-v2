import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Stethoscope, Calendar, IndianRupee, Package, Container, AlertCircle } from 'lucide-react';

import { Input } from '../Input';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { Button } from '../Button';
import { useTanks } from '../../context/TankContext';
import { useSites } from '../../context/SiteContext';
import { useStocking } from '../../context/StockingContext';
import { MEDICINE_TYPES, MEDICINE_TYPE_OPTIONS, normalizeMedicineType } from '../../constants/medicineTypes';
import { medicineService } from '../../services/medicineService';

// Zod Validation Schema matching required frontend fields
const medicineSchema = z.object({
  tankId: z
    .string()
    .min(1, 'Please select a Tank'),
  medicineType: z
    .string()
    .min(1, 'Please select a Medicine Type'),
  quantity: z
    .coerce
    .number({ invalid_type_error: 'Quantity must be a number' })
    .positive('Quantity must be greater than 0'),
  cost: z
    .coerce
    .number({ invalid_type_error: 'Cost must be a number' })
    .min(0, 'Cost cannot be negative'),
  date: z
    .string()
    .min(1, 'Application Date is required'),
  notes: z
    .string()
    .optional(),
});

/**
 * Reusable MedicineForm component with dynamic Site -> Tank selection hierarchy from SiteContext & TankContext
 * and real-time Site & Medicine Type Stock Availability indicator and validation.
 */
export const MedicineForm = ({
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
  const [serverStock, setServerStock] = useState(null);
  const [loadingStock, setLoadingStock] = useState(false);

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
    resolver: zodResolver(medicineSchema),
    defaultValues: {
      tankId: '',
      medicineType: '',
      quantity: '',
      cost: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
    mode: 'onTouched',
  });

  const selectedTankId = watch('tankId');
  const selectedMedicineType = watch('medicineType');
  const quantityValue = watch('quantity');
  const enteredQuantity = parseFloat(quantityValue) || 0;

  // Identify selected tank and site
  const selectedTank = useMemo(() => {
    return tanks.find((t) => String(t.id) === String(selectedTankId));
  }, [tanks, selectedTankId]);

  const siteId = selectedTank?.siteId || selectedTank?.site?.id || selectedSiteId;

  // Fetch live stock availability for this site and medicine type from the server
  useEffect(() => {
    let isCancelled = false;
    if (siteId && selectedMedicineType && MEDICINE_TYPES.includes(selectedMedicineType)) {
      setLoadingStock(true);
      medicineService
        .getMedicineStockAvailability(siteId, selectedMedicineType)
        .then((res) => {
          if (!isCancelled && res?.data) {
            setServerStock(res.data);
          }
        })
        .catch(() => {
          if (!isCancelled) setServerStock(null);
        })
        .finally(() => {
          if (!isCancelled) setLoadingStock(false);
        });
    } else {
      setServerStock(null);
    }
    return () => {
      isCancelled = true;
    };
  }, [siteId, selectedMedicineType]);

  // Compute available medicine stock for selected site and medicine type
  const siteMedicineStockInfo = useMemo(() => {
    if (!siteId || !selectedMedicineType) return null;

    let totalAdded = 0;
    let used = 0;
    let unit = 'kg';

    stockings.forEach((s) => {
      const isMedicine = s.category?.toUpperCase() === 'MEDICINE';
      const isDirectSite = s.siteId && String(s.siteId) === String(siteId);
      const sType = normalizeMedicineType(s.medicineType);
      const isTypeMatch = sType === selectedMedicineType;

      if (isMedicine && isDirectSite && isTypeMatch) {
        totalAdded += parseFloat(s.totalQuantity) || 0;
        used = parseFloat(s.totalUsed) || 0;
        if (s.unit) unit = s.unit;
      }
    });

    const currentRecordQty =
      isEditing &&
      (normalizeMedicineType(initialData?.medicineType) === selectedMedicineType ||
       normalizeMedicineType(initialData?.medicineName) === selectedMedicineType)
        ? parseFloat(initialData?.quantity) || 0
        : 0;

    let remaining = 0;
    if (serverStock && serverStock.medicineType === selectedMedicineType) {
      remaining = Math.max((parseFloat(serverStock.availableQuantity) || 0) + currentRecordQty, 0);
      unit = serverStock.unit || unit;
      totalAdded = parseFloat(serverStock.allocatedMedicine) || 0;
      used = parseFloat(serverStock.usedMedicine) || 0;
    } else {
      const effectiveUsed = Math.max(used - currentRecordQty, 0);
      remaining = Math.max(totalAdded - effectiveUsed, 0);
    }

    const matchingSite = sites.find((s) => String(s.id) === String(siteId));
    const siteName =
      selectedTank?.site?.siteName ||
      selectedTank?.siteName ||
      matchingSite?.siteName ||
      matchingSite?.name ||
      'this site';

    return {
      medicineType: selectedMedicineType,
      totalAdded,
      used,
      remaining,
      unit,
      siteName,
      hasStock: remaining > 0,
    };
  }, [siteId, selectedMedicineType, stockings, selectedTank, isEditing, initialData, sites, serverStock]);

  const isZeroStock = Boolean(siteMedicineStockInfo && siteMedicineStockInfo.remaining <= 0);
  const isExcess = Boolean(siteMedicineStockInfo && enteredQuantity > siteMedicineStockInfo.remaining);

  const quantityErrorMessage = errors.quantity?.message || (
    !selectedMedicineType
      ? undefined
      : isZeroStock && enteredQuantity > 0
        ? `No stock available for ${selectedMedicineType} at ${siteMedicineStockInfo.siteName}.`
        : isExcess
          ? `Only ${siteMedicineStockInfo.remaining} ${siteMedicineStockInfo.unit} of ${selectedMedicineType} is available for this site.`
          : undefined
  );

  const isSubmitDisabled = isSubmitting || !selectedMedicineType || isZeroStock || isExcess;

  // Initialize or reset form values
  useEffect(() => {
    if (initialData) {
      const initTankId = initialData.tankId ? String(initialData.tankId) : '';
      const matchingTank = tanks.find((t) => String(t.id) === initTankId);
      const initSiteId = matchingTank?.siteId || matchingTank?.site?.id ? String(matchingTank.siteId || matchingTank.site.id) : '';
      setSelectedSiteId(initSiteId);

      const rawMedType = initialData.medicineType || initialData.medicineName || '';
      const initMedType = normalizeMedicineType(rawMedType);

      reset({
        tankId: initTankId,
        medicineType: initMedType,
        quantity: initialData.quantity || '',
        cost: initialData.cost || '',
        date: initialData.date ? new Date(initialData.date).toISOString().split('T')[0] : (initialData.applicationDate || ''),
        notes: initialData.notes || '',
      });
    } else {
      setSelectedSiteId('');
      reset({
        tankId: '',
        medicineType: '',
        quantity: '',
        cost: '',
        date: new Date().toISOString().split('T')[0],
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
      : 'Select tank...';

  const handleFormSubmit = (data) => {
    if (isExcess || isZeroStock || !data.medicineType) {
      return;
    }

    const selectedTankObj = tanks.find((t) => String(t.id) === String(data.tankId));
    const rawTankName = selectedTankObj ? (selectedTankObj.name || selectedTankObj.tankName) : 'Selected Tank';
    const cleanTankName = rawTankName.replace(/\s*\([^)]*\)/g, '').trim();

    const medicinePayload = {
      tankId: data.tankId,
      medicineName: data.medicineType,
      medicineType: data.medicineType,
      purpose: initialData?.purpose || 'Water treatment',
      dosage: initialData?.dosage || 'As required',
      quantity: parseFloat(data.quantity),
      cost: parseFloat(data.cost) || 0,
      date: data.date,
      notes: data.notes ? data.notes.trim() : '',
    };

    if (onSubmit) {
      onSubmit({
        ...medicinePayload,
        tankName: cleanTankName,
        applicationDate: medicinePayload.date,
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
            label="Select Tank"
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
            label="Application Date"
            type="date"
            required={true}
            icon={<Calendar className="w-4 h-4" />}
            error={errors.date?.message}
            {...register('date')}
          />
        </div>
      </div>

      {/* SECTION 2: MEDICINE DETAILS */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border/50 pb-1 flex items-center gap-1.5">
          <Stethoscope className="w-3.5 h-3.5 text-primary" /> Treatment Details
        </h4>
        <div>
          <Select
            label="Medicine Type"
            required={true}
            placeholder="Select medicine type..."
            options={MEDICINE_TYPE_OPTIONS}
            icon={<Stethoscope className="w-4 h-4 text-primary" />}
            error={errors.medicineType?.message}
            {...register('medicineType')}
          />
        </div>
      </div>

      {/* SECTION 3: QUANTITY & COST */}
      <div className="p-4 rounded-xl bg-primary-light/30 border border-primary/20 space-y-3 shadow-2xs">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5" /> Quantity & Cost
          </h4>

          {(selectedSiteId || selectedTankId) && selectedMedicineType && siteMedicineStockInfo && (
            <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border shadow-2xs ${
              isExcess || isZeroStock
                ? 'bg-danger-light/60 border-danger/40 text-danger'
                : 'bg-cyan-50 border-cyan-200 text-cyan-800'
            }`}>
              Available: {siteMedicineStockInfo.remaining} {siteMedicineStockInfo.unit}
            </span>
          )}
        </div>

        {/* STOCK AVAILABILITY INDICATOR BADGE */}
        {(selectedSiteId || selectedTankId) && selectedMedicineType && siteMedicineStockInfo && (
          <div className={`p-2.5 rounded-lg border text-xs flex items-center justify-between font-medium transition-colors ${
            isZeroStock
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : isExcess
                ? 'bg-danger-light/30 border-danger/40 text-danger'
                : 'bg-cyan-50/80 border-cyan-200 text-cyan-800'
          }`}>
            <div className="flex items-center gap-2">
              <Stethoscope className="w-3.5 h-3.5 shrink-0" />
              <span>
                Available <strong>{selectedMedicineType}</strong> Stock: <strong>{siteMedicineStockInfo.remaining} {siteMedicineStockInfo.unit}</strong>
              </span>
            </div>
            <span className="text-[10px] opacity-80">({siteMedicineStockInfo.siteName})</span>
          </div>
        )}

        {/* ZERO STOCK ALERT */}
        {(selectedSiteId || selectedTankId) && selectedMedicineType && isZeroStock && (
          <div className="p-2.5 rounded-lg bg-danger-light/30 border border-danger/40 text-danger text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              No stock available for {selectedMedicineType} at {siteMedicineStockInfo?.siteName || 'this site'}. You cannot record usage until stock is added in Stock Management.
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Quantity"
            type="number"
            step="0.01"
            placeholder="e.g. 5"
            required={true}
            disabled={isZeroStock}
            icon={<Package className="w-4 h-4 text-primary" />}
            error={quantityErrorMessage}
            {...register('quantity')}
          />

          <Input
            label="Treatment Cost (₹)"
            type="number"
            placeholder="e.g. 999"
            required={true}
            icon={<IndianRupee className="w-4 h-4 text-primary" />}
            error={errors.cost?.message}
            {...register('cost')}
          />
        </div>
      </div>

      {/* SECTION 4: APPLICATION NOTES (OPTIONAL) */}
      <div>
        <Textarea
          label="Application Notes (Optional)"
          placeholder="Add any notes..."
          rows={2}
          error={errors.notes?.message}
          {...register('notes')}
        />
      </div>

      {/* ACTIONS */}
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
          {isEditing ? (isSubmitting ? 'Updating...' : 'Update Treatment Record') : (isSubmitting ? 'Recording...' : 'Save Treatment')}
        </Button>
      </div>
    </form>
  );
};

export default MedicineForm;
