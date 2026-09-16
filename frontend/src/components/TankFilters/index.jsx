import React from 'react';
import { RotateCcw } from 'lucide-react';
import { SearchBar } from '../SearchBar';
import { Select } from '../Select';
import { Button } from '../Button';
import { useSites } from '../../context/SiteContext';

/**
 * Reusable TankFilters component for search & site dropdown filtering.
 */
export const TankFilters = ({
  searchQuery = '',
  onSearchChange,
  siteFilter = '',
  onSiteChange,
  sites: sitesProp,
  onReset,
  className = '',
}) => {
  const { sites: contextSites = [] } = useSites();
  const sites = sitesProp || contextSites || [];

  const hasActiveFilters = Boolean(searchQuery || siteFilter);

  const siteOptions = [
    { value: '', label: 'All Sites' },
    ...(sites || []).map((s) => ({
      value: String(s.id),
      label: s.siteName || s.name || 'Site',
    })),
  ];

  return (
    <div className={`flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-surface border border-border rounded-xl p-4 shadow-xs ${className}`}>
      {/* Search Bar Input */}
      <div className="flex-1 max-w-md">
        <SearchBar
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          onClear={() => onSearchChange('')}
          placeholder="Search tank name or remarks..."
        />
      </div>

      {/* Filter Dropdowns & Reset */}
      <div className="flex flex-wrap items-center gap-3 shrink-0">
        {/* Site Dropdown */}
        <div className="w-40 sm:w-48">
          <Select
            placeholder=""
            options={siteOptions}
            value={siteFilter}
            onChange={(e) => onSiteChange(e.target.value)}
            fullWidth
          />
        </div>

        {/* Clear / Reset Filters Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            icon={<RotateCcw className="w-3.5 h-3.5 text-danger" />}
            className="text-xs text-danger font-medium hover:bg-danger-light/50"
          >
            Reset Filters
          </Button>
        )}
      </div>
    </div>
  );
};

export default TankFilters;
