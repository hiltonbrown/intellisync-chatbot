import type { ReactNode } from 'react';
import { Bell, Bot, CreditCard, SlidersHorizontal, UserRound } from 'lucide-react';

import { SettingsNavigation, type SettingsNavigationItem } from './_components/settings-navigation';
import { SettingsMenu } from '@/src/ui/components/SettingsMenu';

const NAVIGATION_ITEMS = [
  {
    href: '/settings/user-preferences',
    label: 'User preferences',
    icon: UserRound,
  },
  {
    href: '/settings/notification-settings',
    label: 'Notifications',
    icon: Bell,
  },
  {
    href: '/settings/assistant-settings',
    label: 'Assistant',
    icon: Bot,
  },
  {
    href: '/settings/billing-usage',
    label: 'Billing & usage',
    icon: CreditCard,
  },
  {
    href: '/settings/integration-settings',
    label: 'Integrations',
    icon: SlidersHorizontal,
  },
] satisfies SettingsNavigationItem[];

export default function SettingsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-full w-full bg-muted/10">
      <SettingsMenu>
        <div className="space-y-2">
          <h1 className='font-semibold text-xl'>Settings</h1>
          <p className="text-muted-foreground text-sm">
            Manage your workspace, notifications, and account details.
          </p>
        </div>
        <SettingsNavigation items={NAVIGATION_ITEMS} />
      </SettingsMenu>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-5xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
