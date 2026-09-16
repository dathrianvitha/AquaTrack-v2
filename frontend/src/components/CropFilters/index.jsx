import React from 'react';
import { X } from 'lucide-react';
import { SearchBar } from '../SearchBar';
import { Select } from '../Select';
import { Button } from '../Button';
import { useSites } from '../../context/SiteContext';
import { useTanks } from '../../context/TankContext';

/**
 * Reusable CropFilters component for search, site, & tank filtering.
 */
export const CropFilters = ({
  searchQuery = '',
  onSearchChange,
  siteFilter = '',
  onSiteChange,
  tankFilter = '',
  onTankChange,
  onReset,
  className = '',
}) => {
  const { sites = [] } = useSites();
  const { tanks = [] } = useTanks();

  const hasActiveFilters = Boolean(searchQuery || siteFilter || tankFilter);

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
      const cleanName = rawName.replace(/\s*\([^)]*\)/g, '').trim();
      const siteName = t.siteName || t.site?.siteName || '';
      
      // When All Sites is selected, show tank with its site name e.g. "K1 — Site 1" (Req #8)
      const label = (!siteFilter && siteName)
        ? `${cleanName} — ${siteName}`
        : cleanName;

      return { value: String(t.id), label };
    }),
  ];

  return (
    <div className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface border border-border rounded-xl p-4 shadow-xs ${className}`}>
      {/* Search Bar Input */}
      <div className="flex-1 max-w-md">
        <SearchBar
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
          placeholder="Search batch, seed variety or tank..."
        />
      </div>

      {/* Filter Dropdowns & Reset */}
      <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
        {/* Site Dropdown */}
        <div className="w-40 sm:w-44">
          <Select
            placeholder=""
            options={siteOptions}
            value={siteFilter}
            onChange={(e) => onSiteChange && onSiteChange(e.target.value)}
            fullWidth
          />
        </div>

        {/* Tank Dropdown */}
        <div className="w-44 sm:w-48">
          <Select
            placeholder=""
            options={tankOptions}
            value={tankFilter}
            onChange={(e) => onTankChange && onTankChange(e.target.value)}
            fullWidth
          />
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            icon={<X className="w-4 h-4 text-danger" />}
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

export default CropFilters;
