'use client';

import type { ReactNode } from 'react';

interface PreferencesFilterProps {
  children: ReactNode;
  category: string;
  title: string;
  description: string;
  searchQuery: string;
  selectedCategories: string[];
}

export function PreferencesFilter({
  children,
  category,
  title,
  description,
  searchQuery,
  selectedCategories,
}: PreferencesFilterProps) {
  // Check if this section should be visible based on filters
  const isVisibleByCategory =
    selectedCategories.length === 0 || selectedCategories.includes(category);

  const isVisibleBySearch =
    !searchQuery ||
    title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.toLowerCase().includes(searchQuery.toLowerCase());

  const isVisible = isVisibleByCategory && isVisibleBySearch;

  if (!isVisible) {
    return null;
  }

  return <>{children}</>;
}
