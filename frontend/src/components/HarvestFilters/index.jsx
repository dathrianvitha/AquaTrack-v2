import React from 'react';
import { RotateCcw } from 'lucide-react';
import { Select } from '../Select';
import { Button } from '../Button';
import { useSites } from '../../context/SiteContext';
import { useTanks } from '../../context/TankContext';

/**
 * Reusable HarvestFilters component for filtering harvest logs by Site and Tank.
 */
export const HarvestFilters = ({
  siteFilter = '',
  onSiteChange,
  tankFilter = '',
  onTankChange,
  onReset,
  className = '',
}) => {
  const { sites = [] } = useSites();
  const { tanks = [] } = useTanks();

  const hasActiveFilters = Boolean(siteFilter || tankFilter);

  // 1. Build Site Options
  const siteOptions = [
    { value: '', label: 'All Sites' },
    ...(sites || []).map((s) => ({
      value: String(s.id),
      label: s.siteName || s.name || 'Site',
    })),
  ];

  // 2. Filter Tanks based on selected site & Build Tank Options
  const filteredTanks = siteFilter
    ? (tanks || []).filter((t) => String(t.siteId) === String(siteFilter))
    : tanks || [];

  const tankOptions = [
    { value: '', label: 'All Tanks' },
    ...filteredTanks.map((t) => {
      const rawName = t.name || t.tankName || 'Tank';
      const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName;
      const siteName = t.siteName || t.site?.siteName || '';

      // When All Sites is selected, show tank with its site name e.g. "K1 — Site 1"
      const label = (!siteFilter && siteName)
        ? `${cleanName} — ${siteName}`
        : cleanName;

      return { value: String(t.id), label };
    }),
  ];

  return (
    <div className={`flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-surface border border-border rounded-xl p-4 shadow-xs ${className}`}>
      {/* Site & Tank Select Dropdowns */}
      <div className="flex flex-wrap items-center gap-3 flex-1">
        {/* Site Select */}
        <div className="w-40 sm:w-48">
          <Select
            placeholder=""
            options={siteOptions}
            value={siteFilter}
            onChange={(e) => onSiteChange && onSiteChange(e.target.value)}
            fullWidth
          />
        </div>

        {/* Tank Select */}
        <div className="w-48 sm:w-56">
          <Select
            placeholder=""
            options={tankOptions}
            value={tankFilter}
            onChange={(e) => onTankChange && onTankChange(e.target.value)}
            fullWidth
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            icon={<RotateCcw className="w-3.5 h-3.5 text-danger" />}
            className="text-xs text-danger font-medium hover:bg-danger-light/50 shrink-0"
            title="Reset Filters"
          >
            Reset
          </Button>
        )}
      </div>
    </div>
  );
};

export default HarvestFilters;
