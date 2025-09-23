import type { IntegrationStatus } from '@/lib/types';

export type IntegrationProvider = 'quickbooks' | 'xero' | 'freshbooks';

export type IntegrationConnectionType = 'oauth' | 'apiKey';

export interface IntegrationProviderDefinition {
  id: IntegrationProvider;
  name: string;
  description: string;
  category: 'accounting' | 'finance';
  connectionType: IntegrationConnectionType;
  helpUrl: string;
  docsUrl: string;
  comingSoon?: boolean;
}

export const integrationProviders: Array<IntegrationProviderDefinition> = [
  {
    id: 'quickbooks',
    name: 'QuickBooks Online',
    description:
      'Sync invoices, revenue events, and chart of accounts directly from QuickBooks to keep your ledgers aligned.',
    category: 'accounting',
    connectionType: 'oauth',
    helpUrl: 'https://quickbooks.intuit.com/app/apps/home',
    docsUrl:
      'https://developer.intuit.com/app/developer/qbo/docs/develop/authentication-and-authorization',
  },
  {
    id: 'xero',
    name: 'Xero',
    description:
      'Import bills, expense claims, and bank reconciliation details from Xero for unified reporting.',
    category: 'accounting',
    connectionType: 'oauth',
    helpUrl: 'https://apps.xero.com/us',
    docsUrl: 'https://developer.xero.com/documentation/guides/oauth2/auth-flow',
  },
  {
    id: 'freshbooks',
    name: 'FreshBooks',
    description:
      'Capture time tracking and invoicing activity from FreshBooks to streamline month-end closing.',
    category: 'finance',
    connectionType: 'oauth',
    helpUrl: 'https://www.freshbooks.com/en-ca/integrations',
    docsUrl: 'https://www.freshbooks.com/en-ca/api/start',
    comingSoon: true,
  },
];

export const integrationStatusLabels: Record<IntegrationStatus, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  syncing: 'Syncing',
  error: 'Needs Attention',
};

export function isIntegrationProvider(
  provider: string,
): provider is IntegrationProvider {
  return integrationProviders.some(({ id }) => id === provider);
}

export function getIntegrationProvider(
  provider: string,
): IntegrationProviderDefinition | undefined {
  return integrationProviders.find(({ id }) => id === provider);
}

export const SUPPORTED_INTEGRATION_PROVIDERS = integrationProviders.map(
  ({ id }) => id,
);
