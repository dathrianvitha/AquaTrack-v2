import React, { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar, IndianRupee, Container } from 'lucide-react';

import { Input } from '../Input';
import { Select } from '../Select';
import { Textarea } from '../Textarea';
import { Button } from '../Button';

import {
  EXPENSE_CATEGORY_OPTIONS,
  PAYMENT_MODE_OPTIONS
} from '../../constants/expenseData';
import { useTanks } from '../../context/TankContext';
import { useSites } from '../../context/SiteContext';

// Zod Validation Schema matching frontend required fields with dynamic Tank / Site requirement
const expenseSchema = z
  .object({
    selectedEntityId: z.string().optional(),
    category: z.string().min(1, 'Please select an Expense Category'),
    amount: z
      .coerce
      .number({ invalid_type_error: 'Amount must be a number' })
      .positive('Amount must be greater than 0'),
    paymentMode: z.string().min(1, 'Please select a Payment Mode'),
    date: z.string().min(1, 'Date is required'),
    notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const isSeedCost =
      data.category === 'Seed Cost' ||
      (typeof data.category === 'string' &&
        data.category.trim().toLowerCase() === 'seed cost');
    if (!data.selectedEntityId || !data.selectedEntityId.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: isSeedCost ? 'Please select a Tank' : 'Please select a Site',
        path: ['selectedEntityId'],
      });
    }
  });

/**
 * Reusable ExpenseForm component with dynamic Tank / Site dropdown based on Expense Category.
 * Case 1 — Seed Cost: Label is 'Choose Tank', dropdown lists registered Tanks from TankContext.
 * Case 2 — All other categories: Label is 'Choose Site', dropdown lists registered Sites from SiteContext.
 */
export const ExpenseForm = ({
  initialData = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
  serverError = '',
}) => {
  const { tanks = [] } = useTanks();
  const { sites = [] } = useSites();
  const isEditing = Boolean(initialData?.id);

  // Dynamic Tank options for Seed Cost
  const tankSelectOptions = tanks.map((tank) => {
    const rawName = tank.tankName || tank.name || 'Tank';
    const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
    return {
      value: String(tank.id),
      label: cleanName,
    };
  });

  // Dynamic Site options for all other expense categories
  const siteSelectOptions = sites.map((site) => {
    const rawName = site.siteName || site.name || 'Site';
    const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
    return {
      value: String(site.id),
      label: cleanName,
    };
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      selectedEntityId: '',
      category: '',
      amount: '',
      paymentMode: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
    },
    mode: 'onTouched',
  });

  const selectedCategory = watch('category');
  const isSeedCost =
    selectedCategory === 'Seed Cost' ||
    (typeof selectedCategory === 'string' &&
      selectedCategory.trim().toLowerCase() === 'seed cost');

  const selectionLabel = isSeedCost ? 'Choose Tank' : 'Choose Site';
  const selectionPlaceholder = isSeedCost ? 'Choose tank...' : 'Choose site...';
  const selectionOptions = isSeedCost ? tankSelectOptions : siteSelectOptions;

  const prevIsSeedCostRef = useRef(isSeedCost);
  const isFirstRenderRef = useRef(true);

  // Reset selected entity whenever category toggles between Seed Cost and other categories
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      prevIsSeedCostRef.current = isSeedCost;
      return;
    }

    if (prevIsSeedCostRef.current !== isSeedCost) {
      setValue('selectedEntityId', '', { shouldValidate: false });
      prevIsSeedCostRef.current = isSeedCost;
    }
  }, [isSeedCost, setValue]);

  useEffect(() => {
    if (initialData) {
      const initialCat = initialData.category || '';
      const isSeed =
        initialCat === 'Seed Cost' ||
        (typeof initialCat === 'string' &&
          initialCat.trim().toLowerCase() === 'seed cost');
      const initialEntityId = isSeed
        ? initialData.tankId || ''
        : initialData.siteId || initialData.tankId || '';

      reset({
        selectedEntityId: initialEntityId ? String(initialEntityId) : '',
        category: initialCat,
        amount: initialData.amount || '',
        paymentMode: initialData.paymentMode || '',
        date: initialData.date || new Date().toISOString().split('T')[0],
        notes: initialData.notes || '',
      });
    }
  }, [initialData, reset]);

  const handleFormSubmit = (data) => {
    let expensePayload = {
      category: data.category,
      description: data.category, // Internally populate description using category for API compatibility
      amount: parseFloat(data.amount),
      paymentMode: data.paymentMode,
      date: data.date,
      notes: data.notes ? data.notes.trim() : '',
    };

    if (isSeedCost) {
      const selectedTankObj = tanks.find(
        (t) => String(t.id) === String(data.selectedEntityId)
      );
      const rawTankName = selectedTankObj
        ? selectedTankObj.tankName || selectedTankObj.name
        : 'Selected Pond';
      const cleanTankName = rawTankName.replace(/\s*\([^)]*\)/g, '').trim();

      expensePayload = {
        ...expensePayload,
        tankId: data.selectedEntityId,
        siteId: selectedTankObj?.siteId || selectedTankObj?.site?.id || '',
        tankName: cleanTankName,
        siteName:
          selectedTankObj?.siteName || selectedTankObj?.site?.siteName || '',
      };
    } else {
      const selectedSiteObj = sites.find(
        (s) => String(s.id) === String(data.selectedEntityId)
      );
      const rawSiteName = selectedSiteObj
        ? selectedSiteObj.siteName || selectedSiteObj.name
        : 'Selected Site';
      const cleanSiteName = rawSiteName.replace(/\s*\([^)]*\)/g, '').trim();

      // Site-level expense: strictly send siteId without attaching an arbitrary single tankId
      expensePayload = {
        ...expensePayload,
        siteId: data.selectedEntityId,
        siteName: cleanSiteName,
      };
    }

    if (onSubmit) {
      onSubmit(expensePayload);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-5" noValidate>
      {serverError && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
          {serverError}
        </div>
      )}

      {!isSeedCost && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-800 text-xs rounded-xl flex items-center gap-2">
          <span>💡</span>
          <span>
            <strong>Site Level Expense:</strong> This amount will be split equally among all tanks on this site that have active crops and reflected tank-wise in reports.
          </span>
        </div>
      )}

      {/* SECTION 1: BASIC INFORMATION */}
      <div className="space-y-3">
        <h4 className="text-[11px] font-bold uppercase tracking-wider text-text-secondary border-b border-border/50 pb-1 flex items-center gap-1.5">
          <Container className="w-3.5 h-3.5 text-primary" /> Basic Information
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label={selectionLabel}
            required={true}
            placeholder={selectionPlaceholder}
            options={selectionOptions}
            error={errors.selectedEntityId?.message}
            {...register('selectedEntityId')}
          />

          <Select
            label="Expense Category"
            required={true}
            placeholder="Select category..."
            options={EXPENSE_CATEGORY_OPTIONS}
            error={errors.category?.message}
            {...register('category')}
          />
        </div>
      </div>

      {/* SECTION 2: TRANSACTION DETAILS */}
      <div className="p-4 rounded-xl bg-primary-light/30 border border-primary/20 space-y-3.5 shadow-2xs">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <IndianRupee className="w-3.5 h-3.5" /> Transaction Details
        </h4>
        <div className="space-y-3.5">
          {/* Prominent, full-width Amount input for easy readability of large amounts */}
          <div>
            <Input
              label="Amount (₹)"
              type="number"
              step="1"
              placeholder="e.g. 2500"
              required={true}
              icon={<IndianRupee className="w-4 h-4 text-primary" />}
              error={errors.amount?.message}
              className="text-base font-semibold tracking-wide"
              {...register('amount')}
            />
          </div>

          {/* Payment Mode and Date in a 2-column balanced grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select
              label="Payment Mode"
              required={true}
              placeholder="Select mode..."
              options={PAYMENT_MODE_OPTIONS}
              error={errors.paymentMode?.message}
              {...register('paymentMode')}
            />

            <Input
              label="Date"
              type="date"
              required={true}
              icon={<Calendar className="w-4 h-4 text-primary" />}
              error={errors.date?.message}
              {...register('date')}
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: NOTES (OPTIONAL) */}
      <div>
        <Textarea
          label="Notes (Optional)"
          placeholder="Add transaction details, invoice number, vendor name..."
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
          disabled={isSubmitting}
          className="font-semibold"
        >
          {isEditing ? (isSubmitting ? 'Updating...' : 'Update Expense') : (isSubmitting ? 'Recording...' : 'Save Expense Record')}
        </Button>
      </div>
    </form>
  );
};

export default ExpenseForm;
