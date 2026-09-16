import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

import { PageHeader } from '../../components/PageHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { ConfirmationDialog } from '../../components/ConfirmationDialog';
import { PasswordConfirmationModal } from '../../components/PasswordConfirmationModal';
import { EmptyState } from '../../components/EmptyState';

import { CropCard } from '../../components/CropCard';
import { CropForm } from '../../components/CropForm';
import { CropFilters } from '../../components/CropFilters';
import { CropDetailsModal } from '../../components/CropDetailsModal';
import { useCrops } from '../../context/CropContext';
import { useTanks } from '../../context/TankContext';

export default function CropManagement() {
  const navigate = useNavigate();
  const {
    crops = [],
    addCrop,
    updateCrop,
    deleteCrop,
    loading
  } = useCrops();
  const { tanks = [] } = useTanks();

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [tankFilter, setTankFilter] = useState('');

  // Modal Control States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCrop, setEditingCrop] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [viewingCrop, setViewingCrop] = useState(null);

  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [deletingCrop, setDeletingCrop] = useState(null);

  // Handle Site Filter Change (Resets Tank Filter per Requirements 13 & 14)
  const handleSiteChange = (newSiteId) => {
    setSiteFilter(newSiteId);
    setTankFilter('');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSiteFilter('');
    setTankFilter('');
  };

  // Build relational set of tank IDs belonging to the selected site
  const siteTankIds = useMemo(() => {
    if (!siteFilter) return null;
    const siteTanks = (tanks || []).filter((t) => String(t.siteId) === String(siteFilter));
    return new Set(siteTanks.map((t) => String(t.id)));
  }, [tanks, siteFilter]);

  // Filter Crops List Safely using IDs/relationships
  const filteredCrops = useMemo(() => {
    const list = crops || [];
    const query = (searchQuery || '').trim().toLowerCase();

    return list.filter((crop) => {
      if (!crop) return false;

      // 1. Relational Site Filter
      if (siteFilter) {
        const cropTankId = String(crop.tankId || crop.tank?.id || '');
        const cropSiteId = String(crop.siteId || crop.tank?.siteId || crop.tank?.site?.id || '');
        const matchesSite = (siteTankIds && siteTankIds.has(cropTankId)) || cropSiteId === String(siteFilter);
        if (!matchesSite) return false;
      }

      // 2. Relational Tank Filter
      if (tankFilter) {
        const cropTankId = String(crop.tankId || crop.tank?.id || '');
        if (cropTankId !== String(tankFilter)) return false;
      }

      // 3. Search Query Filter
      if (query) {
        const batchStr = crop.batchNumber || '';
        const nameStr = crop.cropName || '';
        const varietyStr = crop.seedVariety || '';
        const rawTank = crop.tankName || crop.tank?.tankName || crop.tank?.name || '';
        const tankStr = rawTank.replace(/\s*\([^)]*\)/g, '').trim();
        const siteStr = crop.siteName || crop.site?.siteName || crop.tank?.site?.siteName || '';
        const notesStr = crop.notes || '';

        const matchesSearch =
          batchStr.toLowerCase().includes(query) ||
          nameStr.toLowerCase().includes(query) ||
          varietyStr.toLowerCase().includes(query) ||
          tankStr.toLowerCase().includes(query) ||
          siteStr.toLowerCase().includes(query) ||
          notesStr.toLowerCase().includes(query);

        if (!matchesSearch) return false;
      }

      return true;
    });
  }, [crops, searchQuery, siteFilter, tankFilter, siteTankIds]);

  // Form Handlers
  const handleOpenAdd = () => {
    setEditingCrop(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (crop) => {
    setEditingCrop(crop);
    setIsFormOpen(true);
    if (isDetailsOpen) setIsDetailsOpen(false);
  };

  const handleOpenDetails = (crop) => {
    setViewingCrop(crop);
    setIsDetailsOpen(true);
  };

  const handleOpenDelete = (crop) => {
    setDeletingCrop(crop);
    setIsDeleteOpen(true);
    if (isDetailsOpen) setIsDetailsOpen(false);
  };

  // Dynamic Empty State Props based on Requirement 15
  const emptyStateProps = useMemo(() => {
    if (siteFilter) {
      const siteTanks = (tanks || []).filter((t) => String(t.siteId) === String(siteFilter));
      if (siteTanks.length === 0) {
        return {
          title: 'No Tanks Available',
          description: 'No tanks available for this site.',
          actionLabel: 'Reset Filters',
          onAction: handleResetFilters,
        };
      }
      if (tankFilter) {
        return {
          title: 'No Crops Registered',
          description: 'No crops registered for this tank yet.',
          actionLabel: 'Reset Filters',
          onAction: handleResetFilters,
        };
      }
      return {
        title: 'No Crops Registered',
        description: 'No crops registered for this site yet.',
        actionLabel: 'Reset Filters',
        onAction: handleResetFilters,
      };
    }

    if (tankFilter) {
      return {
        title: 'No Crops Registered',
        description: 'No crops registered for this tank yet.',
        actionLabel: 'Reset Filters',
        onAction: handleResetFilters,
      };
    }

    if (searchQuery) {
      return {
        title: 'No Crop Batches Found',
        description: 'No crop batches match your filter criteria. Try resetting filters.',
        actionLabel: 'Reset Filters',
        onAction: handleResetFilters,
      };
    }

    return {
      title: 'No Crop Batches Found',
      description: 'No crop batches have been registered yet.',
      actionLabel: 'Register New Crop',
      onAction: handleOpenAdd,
    };
  }, [siteFilter, tankFilter, searchQuery, tanks]);

  const handleSaveCrop = async (formData) => {
    setIsSubmitting(true);
    try {
      if (editingCrop) {
        await updateCrop(editingCrop.id, formData);
      } else {
        await addCrop(formData);
      }
      setIsFormOpen(false);
      setEditingCrop(null);
    } catch (err) {
      console.error('Error saving crop:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptDeleteStep1 = () => {
    setIsDeleteOpen(false);
    setIsPasswordOpen(true);
  };

  const handleFinalDeleteWithPassword = async (password) => {
    if (deletingCrop) {
      await deleteCrop(deletingCrop.id, password);
      setIsPasswordOpen(false);
      setDeletingCrop(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* 1. PAGE HEADER */}
      <PageHeader
        title="Crop Management"
        subtitle="Track and manage crop batches across your farm tanks."
        actions={
          <div className="flex items-center gap-2.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => navigate('/netting')}
              icon={<Plus className="w-4 h-4" />}
              className="font-semibold shadow-xs"
            >
              Netting
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleOpenAdd}
              icon={<Plus className="w-4 h-4" />}
              className="font-semibold shadow-xs"
            >
              Register New Crop
            </Button>
          </div>
        }
      />

      {/* 2. SEARCH & FILTERS */}
      <CropFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        siteFilter={siteFilter}
        onSiteChange={handleSiteChange}
        tankFilter={tankFilter}
        onTankChange={setTankFilter}
        onReset={handleResetFilters}
      />

      {/* 3. CROPS GRID OR EMPTY STATE */}
      {filteredCrops.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredCrops.map((crop) => (
            <CropCard
              key={crop.id}
              crop={crop}
              onView={handleOpenDetails}
              onEdit={handleOpenEdit}
              onDelete={handleOpenDelete}
            />
          ))}
        </div>
      ) : (
        <Card padding="relaxed" className="border-border/80 shadow-2xs">
          <EmptyState
            title={emptyStateProps.title}
            description={emptyStateProps.description}
            actionLabel={emptyStateProps.actionLabel}
            onAction={emptyStateProps.onAction}
          />
        </Card>
      )}

      {/* 4. ADD / EDIT CROP MODAL */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditingCrop(null);
        }}
        title={editingCrop ? 'Edit Crop Details' : 'Register New Crop'}
        description={
          editingCrop
            ? `Update details for Batch ${editingCrop.batchNumber || editingCrop.cropName || 'Crop'}`
            : 'Register a new aquaculture crop batch into a farm tank.'
        }
        size="md"
      >
        <CropForm
          initialData={editingCrop}
          onSubmit={handleSaveCrop}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingCrop(null);
          }}
          isSubmitting={isSubmitting}
        />
      </Modal>

      {/* 5. VIEW CROP DETAILS MODAL */}
      <CropDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setViewingCrop(null);
        }}
        crop={viewingCrop}
        onEdit={handleOpenEdit}
        onDelete={handleOpenDelete}
      />

      {/* 6. DELETE CONFIRMATION DIALOG (Step 1) */}
      <ConfirmationDialog
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setDeletingCrop(null);
        }}
        onConfirm={handleAcceptDeleteStep1}
        title="Delete Crop Record"
        message={
          deletingCrop
            ? `Are you sure you want to delete crop record for "Batch ${deletingCrop.batchNumber || deletingCrop.cropName || 'Crop'}"? This action cannot be undone.`
            : 'Are you sure you want to delete this crop record?'
        }
        confirmText="Delete Crop Record"
        cancelText="Cancel"
        type="danger"
      />

      {/* 7. PASSWORD CONFIRMATION MODAL (Step 2) */}
      <PasswordConfirmationModal
        isOpen={isPasswordOpen}
        onClose={() => {
          setIsPasswordOpen(false);
          setDeletingCrop(null);
        }}
        onConfirm={handleFinalDeleteWithPassword}
      />
    </div>
  );
}
