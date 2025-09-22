'use client';

import { useState, } from 'react';
import { Search, X, Filter } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { TextField } from '@/src/ui/components/TextField';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PreferencesSearchProps {
  onSearchChange: (query: string) => void;
  onCategoryFilter: (categories: string[]) => void;
  searchQuery: string;
  selectedCategories: string[];
}

const preferenceCategories = [
  {
    id: 'general',
    label: 'General',
    description: 'Chat models and basic settings',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    description: 'Theme, colors, and layout',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    description: 'Email, browser, and chat alerts',
  },
  { id: 'privacy', label: 'Privacy', description: 'Data sharing and security' },
  {
    id: 'accessibility',
    label: 'Accessibility',
    description: 'Visual and interaction preferences',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    description: 'Developer and performance settings',
  },
];

export function PreferencesSearch({
  onSearchChange,
  onCategoryFilter,
  searchQuery,
  selectedCategories,
}: PreferencesSearchProps) {
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const handleSearchChange = (value: string) => {
    onSearchChange(value);
  };

  const handleCategoryToggle = (categoryId: string) => {
    const newCategories = selectedCategories.includes(categoryId)
      ? selectedCategories.filter((id) => id !== categoryId)
      : [...selectedCategories, categoryId];
    onCategoryFilter(newCategories);
  };

  const clearSearch = () => {
    onSearchChange('');
  };

  const clearFilters = () => {
    onCategoryFilter([]);
  };

  const activeFiltersCount = selectedCategories.length;

  return (
    <div className='flex items-center gap-3 rounded-lg border bg-muted/30 p-4'>
      <div className='relative max-w-md flex-1'>
        <TextField className="w-full">
          <TextField.Input
            placeholder="Search preferences..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-9"
          />
        </TextField>
        <Search className='-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground' />

        {searchQuery && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            className='-translate-y-1/2 absolute top-1/2 right-1 h-6 w-6 transform p-0'
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>

      <DropdownMenu open={isFilterOpen} onOpenChange={setIsFilterOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filter
            {activeFiltersCount > 0 && (
              <span className='ml-1 rounded-full bg-primary px-1.5 py-0.5 text-primary-foreground text-xs'>
                {activeFiltersCount}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className='px-2 py-1.5 font-medium text-muted-foreground text-sm'>
            Filter by Category
          </div>
          {preferenceCategories.map((category) => (
            <DropdownMenuCheckboxItem
              key={category.id}
              checked={selectedCategories.includes(category.id)}
              onCheckedChange={() => handleCategoryToggle(category.id)}
              className="flex flex-col items-start"
            >
              <span className="font-medium">{category.label}</span>
              <span className='text-muted-foreground text-xs'>
                {category.description}
              </span>
            </DropdownMenuCheckboxItem>
          ))}
          {activeFiltersCount > 0 && (
            <>
              <div className='my-1 border-t' />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="w-full justify-start text-muted-foreground hover:text-foreground"
              >
                Clear all filters
              </Button>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {(searchQuery || activeFiltersCount > 0) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onSearchChange('');
            onCategoryFilter([]);
          }}
          className="text-muted-foreground hover:text-foreground"
        >
          Clear all
        </Button>
      )}
    </div>
  );
}
