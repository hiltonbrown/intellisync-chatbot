'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';

import { SettingsMenu } from '@/src/ui/components/SettingsMenu';

interface SettingsNavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface SettingsNavigationProps {
  items: SettingsNavigationItem[];
}

export function SettingsNavigation({ items }: SettingsNavigationProps) {
  const pathname = usePathname();

  return (
    <nav className="flex w-full flex-col gap-2">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href;

        return (
          <Link key={item.href} href={item.href} className="w-full">
            <SettingsMenu.Item
              selected={isActive}
              icon={<Icon className="h-4 w-4" />}
              label={item.label}
            />
          </Link>
        );
      })}
    </nav>
  );
}
