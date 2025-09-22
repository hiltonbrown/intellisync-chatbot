'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import type { AccentColor } from '@/lib/types/preferences';

interface AccentColorSelectorProps {
  initialColor?: AccentColor;
  onColorChange?: (color: AccentColor) => void;
}

const accentColors = [
  {
    value: 'blue' as const,
    label: 'Blue',
    bgClass: 'bg-blue-500',
    hoverClass: 'hover:bg-blue-600',
  },
  {
    value: 'green' as const,
    label: 'Green',
    bgClass: 'bg-green-500',
    hoverClass: 'hover:bg-green-600',
  },
  {
    value: 'purple' as const,
    label: 'Purple',
    bgClass: 'bg-purple-500',
    hoverClass: 'hover:bg-purple-600',
  },
  {
    value: 'orange' as const,
    label: 'Orange',
    bgClass: 'bg-orange-500',
    hoverClass: 'hover:bg-orange-600',
  },
  {
    value: 'red' as const,
    label: 'Red',
    bgClass: 'bg-red-500',
    hoverClass: 'hover:bg-red-600',
  },
  {
    value: 'teal' as const,
    label: 'Teal',
    bgClass: 'bg-teal-500',
    hoverClass: 'hover:bg-teal-600',
  },
  {
    value: 'pink' as const,
    label: 'Pink',
    bgClass: 'bg-pink-500',
    hoverClass: 'hover:bg-pink-600',
  },
  {
    value: 'gray' as const,
    label: 'Gray',
    bgClass: 'bg-gray-500',
    hoverClass: 'hover:bg-gray-600',
  },
];

export function AccentColorSelector({
  initialColor = 'blue',
  onColorChange,
}: AccentColorSelectorProps) {
  const [selectedColor, setSelectedColor] = useState<AccentColor>(initialColor);

  const handleColorChange = (color: AccentColor) => {
    setSelectedColor(color);
    onColorChange?.(color);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Accent Color</CardTitle>
        <CardDescription>
          Choose your preferred accent color for buttons and interactive
          elements.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-3">
          {accentColors.map((color) => (
            <Button
              key={color.value}
              variant="outline"
              size="sm"
              className={`relative h-12 w-full p-0 ${
                selectedColor === color.value
                  ? 'ring-2 ring-primary ring-offset-2'
                  : ''
              }`}
              onClick={() => handleColorChange(color.value)}
            >
              <div
                className={`h-full w-full rounded-md ${color.bgClass} ${color.hoverClass} flex items-center justify-center`}
              >
                {selectedColor === color.value && (
                  <Check className="h-4 w-4 text-white" />
                )}
              </div>
              <span className="sr-only">{color.label}</span>
            </Button>
          ))}
        </div>
        <div className="mt-4 text-center">
          <span className='text-muted-foreground text-sm'>
            Selected:{' '}
            <span className="font-medium capitalize">{selectedColor}</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
