'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { integrationProviders, integrationStatusLabels } from '@/lib/services/integrations/providers';
import type { IntegrationProvider } from '@/lib/services/integrations/providers';
import type {
  HandshakePayload,
  IntegrationSummaryItem,
  SerializedIntegrationState,
  SyncPayload,
} from '@/lib/services/integrations/types';
import type { IntegrationStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const statusVariant: Record<IntegrationStatus, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  connected: 'secondary',
  connecting: 'default',
  syncing: 'default',
  disconnected: 'outline',
  error: 'destructive',
};

type StatusFilter = 'all' | 'connected' | 'disconnected' | 'issues' | 'comingSoon';
type CategoryFilter = 'all' | 'accounting' | 'finance';

type IntegrationsResponse = {
  providers: Array<IntegrationSummaryItem>;
  generatedAt: string;
};

type HandshakeModalState = {
  provider: IntegrationProvider;
  name: string;
  authorizationUrl: string;
  state: string;
  expiresAt: string;
  suggestedRedirect?: string;
};

type LogsModalState = {
  provider: IntegrationProvider;
  name: string;
};

type IntegrationLogEntry = {
  id: string;
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: string;
};

const logLevels: Record<
  IntegrationLogEntry['level'],
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  info: { label: 'Info', variant: 'secondary' },
  warning: { label: 'Warning', variant: 'default' },
  error: { label: 'Error', variant: 'destructive' },
};

const logsByProvider: Record<IntegrationProvider, Array<IntegrationLogEntry>> = {
  quickbooks: [
    {
      id: 'qb-log-1',
      level: 'info',
      message: 'Initial handshake completed successfully.',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 'qb-log-2',
      level: 'warning',
      message: 'Invoice sync skipped due to missing tax codes.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
    },
    {
      id: 'qb-log-3',
      level: 'info',
      message: 'Account mapping verified during nightly sync.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
  ],
  xero: [
    {
      id: 'xero-log-1',
      level: 'info',
      message: 'Bank feed imported 12 new transactions.',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 'xero-log-2',
      level: 'error',
      message: 'Webhook delivery failed — queued for retry.',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    },
  ],
  freshbooks: [
    {
      id: 'freshbooks-log-1',
      level: 'info',
      message: 'Integration is coming soon. Activity will appear here once enabled.',
      timestamp: new Date().toISOString(),
    },
  ],
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { credentials: 'include' });
  const payload = await response.json();

  if (!response.ok) {
    throw new Error(payload?.cause ?? payload?.message ?? 'Failed to load integrations');
  }

  return payload as IntegrationsResponse;
};

function updateIntegrationRecord(
  source: IntegrationsResponse,
  providerId: IntegrationProvider,
  updater: (current: SerializedIntegrationState) => SerializedIntegrationState,
): IntegrationsResponse {
  return {
    ...source,
    providers: source.providers.map((item) =>
      item.definition.id === providerId
        ? {
            ...item,
            integration: updater(item.integration),
          }
        : item,
    ),
    generatedAt: new Date().toISOString(),
  };
}

function formatRelative(timestamp: string | null) {
  if (!timestamp) {
    return 'Never';
  }

  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return 'Never';
  }

  return formatDistanceToNow(date, { addSuffix: true });
}

function getStatusDescription(status: IntegrationStatus) {
  switch (status) {
    case 'connected':
      return 'Data is syncing on schedule.';
    case 'connecting':
      return 'Complete the OAuth handshake to finish setup.';
    case 'syncing':
      return 'Synchronization in progress…';
    case 'error':
      return 'Manual review required before next sync.';
    default:
      return 'Connect to start syncing accounting data.';
  }
}

export default function IntegrationSettingsPage() {
  const { data, error, isLoading, mutate } = useSWR<IntegrationsResponse>(
    '/api/integrations',
    fetcher,
    {
      revalidateOnFocus: false,
    },
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [handshakeDetails, setHandshakeDetails] = useState<HandshakeModalState | null>(
    null,
  );
  const [logsState, setLogsState] = useState<LogsModalState | null>(null);
  const [busyProvider, setBusyProvider] = useState<IntegrationProvider | null>(null);
  const [busyAction, setBusyAction] = useState<'connect' | 'disconnect' | 'sync' | null>(
    null,
  );

  const providerMap = useMemo(
    () => new Map(integrationProviders.map((definition) => [definition.id, definition])),
    [],
  );

  useEffect(() => {
    if (error) {
      toast.error(error.message);
    }
  }, [error]);

  const filteredProviders = useMemo(() => {
    if (!data) {
      return [] as Array<IntegrationSummaryItem>;
    }

    return data.providers.filter(({ definition, integration }) => {
      const matchesCategory =
        categoryFilter === 'all' || definition.category === categoryFilter;

      if (!matchesCategory) {
        return false;
      }

      switch (statusFilter) {
        case 'connected':
          return integration.status === 'connected';
        case 'disconnected':
          return integration.status === 'disconnected';
        case 'issues':
          return integration.status === 'error';
        case 'comingSoon':
          return Boolean(definition.comingSoon);
        default:
          return true;
      }
    });
  }, [data, statusFilter, categoryFilter]);

  const handleConnect = async (providerId: IntegrationProvider) => {
    if (!data) {
      return;
    }

    const definition = providerMap.get(providerId);

    if (definition?.comingSoon) {
      toast.info(`${definition.name} is coming soon.`);
      return;
    }

    setBusyProvider(providerId);
    setBusyAction('connect');

    const optimistic = updateIntegrationRecord(data, providerId, (current) => ({
      ...current,
      status: 'connecting',
      updatedAt: new Date().toISOString(),
    }));

    try {
      await mutate(
        async (current) => {
          const base = current ?? data;
          const response = await fetch(
            `/api/integrations/${providerId}/handshake`,
            {
              method: 'POST',
              credentials: 'include',
            },
          );
          const payload = (await response.json()) as HandshakePayload & {
            message?: string;
            cause?: string;
          };

          if (!response.ok) {
            throw new Error(payload.cause ?? payload.message ?? 'Unable to start handshake');
          }

          setHandshakeDetails({
            provider: providerId,
            name: definition?.name ?? providerId,
            authorizationUrl: payload.handshake.authorizationUrl,
            state: payload.handshake.state,
            expiresAt: payload.handshake.expiresAt,
            suggestedRedirect: payload.handshake.suggestedRedirect,
          });

          toast.success(
            `Handshake started with ${definition?.name ?? providerId}. Complete it in the new window.`,
          );

          return updateIntegrationRecord(base, providerId, () => payload.integration);
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (requestError) {
      console.error(requestError);
      toast.error(
        definition
          ? `Failed to start ${definition.name} handshake.`
          : 'Failed to start integration handshake.',
      );
    } finally {
      setBusyProvider(null);
      setBusyAction(null);
    }
  };

  const handleDisconnect = async (providerId: IntegrationProvider) => {
    if (!data) {
      return;
    }

    const definition = providerMap.get(providerId);

    setBusyProvider(providerId);
    setBusyAction('disconnect');

    const optimistic = updateIntegrationRecord(data, providerId, (current) => ({
      ...current,
      status: 'disconnected',
      connectedAt: null,
      hasCredentials: false,
      updatedAt: new Date().toISOString(),
    }));

    try {
      await mutate(
        async (current) => {
          const base = current ?? data;
          const response = await fetch(
            `/api/integrations/${providerId}/disconnect`,
            {
              method: 'POST',
              credentials: 'include',
            },
          );
          const payload = (await response.json()) as {
            integration: SerializedIntegrationState;
            message?: string;
            cause?: string;
          };

          if (!response.ok) {
            throw new Error(payload.cause ?? payload.message ?? 'Unable to disconnect integration');
          }

          toast.success(
            definition
              ? `${definition.name} disconnected.`
              : 'Integration disconnected.',
          );

          return updateIntegrationRecord(base, providerId, () => payload.integration);
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (requestError) {
      console.error(requestError);
      toast.error(
        definition
          ? `Failed to disconnect ${definition.name}.`
          : 'Failed to disconnect integration.',
      );
    } finally {
      setBusyProvider(null);
      setBusyAction(null);
    }
  };

  const handleSync = async (providerId: IntegrationProvider) => {
    if (!data) {
      return;
    }

    const definition = providerMap.get(providerId);

    if (definition?.comingSoon) {
      toast.info(`${definition.name} syncing will be available soon.`);
      return;
    }

    setBusyProvider(providerId);
    setBusyAction('sync');

    const optimistic = updateIntegrationRecord(data, providerId, (current) => ({
      ...current,
      status: 'syncing',
      updatedAt: new Date().toISOString(),
    }));

    try {
      await mutate(
        async (current) => {
          const base = current ?? data;
          const response = await fetch(`/api/integrations/${providerId}/sync`, {
            method: 'POST',
            credentials: 'include',
          });
          const payload = (await response.json()) as SyncPayload & {
            message?: string;
            cause?: string;
          };

          if (!response.ok) {
            throw new Error(payload.cause ?? payload.message ?? 'Unable to sync integration');
          }

          toast.success(
            definition
              ? `${definition.name} synced ${formatRelative(payload.sync.syncedAt)}.`
              : 'Sync completed.',
          );

          return updateIntegrationRecord(base, providerId, () => payload.integration);
        },
        {
          optimisticData: optimistic,
          rollbackOnError: true,
          revalidate: false,
        },
      );
    } catch (requestError) {
      console.error(requestError);
      toast.error(
        definition
          ? `Failed to sync ${definition.name}.`
          : 'Failed to sync integration.',
      );
    } finally {
      setBusyProvider(null);
      setBusyAction(null);
    }
  };

  const handleViewLogs = (providerId: IntegrationProvider) => {
    const definition = providerMap.get(providerId);
    setLogsState({ provider: providerId, name: definition?.name ?? providerId });
  };

  const renderProviderCards = () => {
    if (isLoading || !data) {
      return (
        <div className="grid gap-4">
          {integrationProviders.map((provider) => (
            <Card key={provider.id} className="border-dashed">
              <CardHeader className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-64" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-28" />
                  <Skeleton className="h-9 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    if (filteredProviders.length === 0) {
      return (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">No integrations match your filters</CardTitle>
            <CardDescription>
              Adjust the filters on the right or connect a new provider to get started.
            </CardDescription>
          </CardHeader>
        </Card>
      );
    }

    return (
      <div className="grid gap-4">
        {filteredProviders.map((item) => (
          <IntegrationProviderCard
            key={item.definition.id}
            item={item}
            busyAction={busyProvider === item.definition.id ? busyAction : null}
            onConnect={() => handleConnect(item.definition.id)}
            onDisconnect={() => handleDisconnect(item.definition.id)}
            onSync={() => handleSync(item.definition.id)}
            onViewLogs={() => handleViewLogs(item.definition.id)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Integration Settings</CardTitle>
              <CardDescription>
                Connect your accounting tools to keep ledgers, invoices, and cash flow analytics in sync.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {renderProviderCards()}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Webhooks & API access</CardTitle>
              <CardDescription>
                Configure inbound webhooks and rotate API keys used by downstream automation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="mb-1 font-medium">Webhook signature secret</div>
                <p className="text-muted-foreground text-sm">
                  Generate a new signing secret to verify events delivered to your internal services. Existing secrets remain valid until revoked.
                </p>
                <Button className="mt-3" variant="outline">
                  Rotate secret
                </Button>
              </div>
              <div>
                <div className="mb-1 font-medium">Service API key</div>
                <p className="text-muted-foreground text-sm">
                  Use scoped API keys for custom integrations or data pipelines. Track usage and revoke keys at any time.
                </p>
                <div className="flex flex-wrap gap-2 pt-3">
                  <Button variant="outline">Create key</Button>
                  <Button variant="ghost" asChild>
                    <Link href="/docs/api">View API documentation</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Filters</CardTitle>
              <CardDescription>
                Quickly focus on providers by category, connection status, or availability.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className='font-medium text-sm'>Status</div>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
                  <SelectTrigger aria-label="Filter integrations by status">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="connected">Connected</SelectItem>
                    <SelectItem value="disconnected">Disconnected</SelectItem>
                    <SelectItem value="issues">Needs attention</SelectItem>
                    <SelectItem value="comingSoon">Coming soon</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className='font-medium text-sm'>Category</div>
                <Select
                  value={categoryFilter}
                  onValueChange={(value) => setCategoryFilter(value as CategoryFilter)}
                >
                  <SelectTrigger aria-label="Filter integrations by category">
                    <SelectValue placeholder="All categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    <SelectItem value="accounting">Accounting</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStatusFilter('all');
                  setCategoryFilter('all');
                }}
              >
                Reset filters
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Need help?</CardTitle>
              <CardDescription>
                Review the integration checklist or contact our support team for guided onboarding.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="link" asChild className="px-0 text-primary">
                <Link href="https://support.intellisync.dev/integrations" target="_blank" rel="noreferrer">
                  Integration checklist
                </Link>
              </Button>
              <Button variant="outline" asChild className="w-full">
                <Link href="mailto:success@intellisync.dev">Contact onboarding</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>

      <AlertDialog
        open={Boolean(handshakeDetails)}
        onOpenChange={(open) => {
          if (!open) {
            setHandshakeDetails(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finish connecting {handshakeDetails?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Authorize access in the provider&apos;s window. If it did not open automatically, use the link below to continue the OAuth flow.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 text-sm">
            <div>
              <div className="font-medium">Authorization URL</div>
              <Button
                variant="link"
                className="px-0 text-primary"
                onClick={() => {
                  if (handshakeDetails) {
                    window.open(handshakeDetails.authorizationUrl, '_blank', 'noopener,noreferrer');
                  }
                }}
              >
                Open OAuth consent
              </Button>
            </div>
            <div className="grid gap-1 text-muted-foreground">
              <div>
                <span className="font-medium text-foreground">State:</span> {handshakeDetails?.state}
              </div>
              <div>
                <span className="font-medium text-foreground">Expires:</span> {formatRelative(handshakeDetails?.expiresAt ?? null)}
              </div>
              {handshakeDetails?.suggestedRedirect ? (
                <div>
                  <span className="font-medium text-foreground">Redirect URI:</span> {handshakeDetails.suggestedRedirect}
                </div>
              ) : null}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setHandshakeDetails(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(logsState)}
        onOpenChange={(open) => {
          if (!open) {
            setLogsState(null);
          }
        }}
      >
        <AlertDialogContent className="max-w-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Activity log — {logsState?.name}</AlertDialogTitle>
            <AlertDialogDescription>
              Review recent sync events, warnings, and errors for troubleshooting.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="max-h-80 space-y-3 overflow-y-auto pr-2">
            {(logsState ? logsByProvider[logsState.provider] : []).map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border bg-muted/30 p-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <Badge variant={logLevels[entry.level].variant}>{logLevels[entry.level].label}</Badge>
                  <span className="text-muted-foreground text-xs">
                    {formatRelative(entry.timestamp)}
                  </span>
                </div>
                <p className="mt-2 text-foreground">{entry.message}</p>
              </div>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setLogsState(null)}>
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type IntegrationProviderCardProps = {
  item: IntegrationSummaryItem;
  busyAction: 'connect' | 'disconnect' | 'sync' | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onSync: () => void;
  onViewLogs: () => void;
};

function IntegrationProviderCard({
  item,
  busyAction,
  onConnect,
  onDisconnect,
  onSync,
  onViewLogs,
}: IntegrationProviderCardProps) {
  const { definition, integration } = item;
  const isBusy = Boolean(busyAction);
  const isConnected = integration.status === 'connected';
  const isSyncing = integration.status === 'syncing' || busyAction === 'sync';
  const isDisconnected = integration.status === 'disconnected';

  const actionLabel = (() => {
    if (busyAction === 'connect') {
      return 'Starting handshake…';
    }

    if (busyAction === 'disconnect') {
      return 'Disconnecting…';
    }

    if (busyAction === 'sync') {
      return 'Syncing…';
    }

    return null;
  })();

  return (
    <Card
      data-testid={`integration-card-${definition.id}`}
      className={cn(
        'transition-shadow',
        integration.status === 'error' && 'border-destructive/60 shadow-destructive/20 shadow-sm',
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-lg">{definition.name}</CardTitle>
            <Badge
              data-testid={`integration-status-${definition.id}`}
              variant={statusVariant[integration.status]}
            >
              {integrationStatusLabels[integration.status]}
            </Badge>
            {definition.comingSoon ? <Badge variant="outline">Coming soon</Badge> : null}
          </div>
          <CardDescription>{definition.description}</CardDescription>
        </div>
        <Badge variant="outline" className='text-[10px] uppercase tracking-wide'>
          {definition.connectionType === 'oauth' ? 'OAuth' : 'API key'}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="text-muted-foreground">{getStatusDescription(integration.status)}</p>
        <div className="grid gap-2 md:grid-cols-2">
          <div>
            <div className='text-muted-foreground text-xs'>Last synced</div>
            <div className="font-medium text-sm">{formatRelative(integration.lastSyncedAt)}</div>
          </div>
          <div>
            <div className='text-muted-foreground text-xs'>Connected</div>
            <div className="font-medium text-sm">
              {integration.connectedAt ? formatRelative(integration.connectedAt) : 'Not connected'}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {isConnected ? (
            <Button
              data-testid={`integration-disconnect-${definition.id}`}
              variant="outline"
              onClick={onDisconnect}
              disabled={isBusy}
            >
              {busyAction === 'disconnect' ? actionLabel : 'Disconnect'}
            </Button>
          ) : (
            <Button
              data-testid={`integration-connect-${definition.id}`}
              onClick={onConnect}
              disabled={definition.comingSoon || isBusy}
            >
              {busyAction === 'connect' ? actionLabel : 'Connect'}
            </Button>
          )}
          <Button
            data-testid={`integration-sync-${definition.id}`}
            variant="secondary"
            onClick={onSync}
            disabled={isDisconnected || definition.comingSoon || isBusy}
          >
            {isSyncing ? 'Syncing…' : 'Sync now'}
          </Button>
          <Button
            data-testid={`integration-logs-${definition.id}`}
            variant="ghost"
            onClick={onViewLogs}
          >
            View logs
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
