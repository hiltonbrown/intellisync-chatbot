"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Plus, RefreshCcw, Unplug, ChevronLeft, CheckCircle2, AlertCircle, Clock, Calendar } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SettingsHeader } from "@/components/settings-header";

interface IntegrationBinding {
    id: string;
    externalTenantName: string;
    externalTenantId: string;
    status: string;
    bindingCreatedAt: string;
    bindingUpdatedAt: string;
    grantId: string;
    grantStatus: string;
    grantCreatedAt: string;
    grantUpdatedAt: string;
    grantExpiresAt: string;
    grantLastUsedAt: string | null;
}

interface IntegrationGrant {
    id: string;
    status: string;
    authorisedByClerkUserId: string;
    expiresAt: string;
}

interface StatusResponse {
    bindings: IntegrationBinding[];
    grants: IntegrationGrant[];
}

interface XeroTenant {
    id: string;
    tenantId: string;
    tenantName: string;
    tenantType: string;
}

function formatDateTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

function formatRelativeTime(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    return formatDateTime(dateString);
}

export default function IntegrationsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const [isLoading, setIsLoading] = useState(true);
    const [data, setData] = useState<StatusResponse>({ bindings: [], grants: [] });

    // Modal State
    const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
    const [availableTenants, setAvailableTenants] = useState<XeroTenant[]>([]);
    const [selectingGrantId, setSelectingGrantId] = useState<string | null>(null);
    const [isSelecting, setIsSelecting] = useState(false);

    // Initial Load
    useEffect(() => {
        loadStatus();

        // Check for action param from callback
        const action = searchParams.get("action");
        const grantId = searchParams.get("grantId");
        if (action === "select_tenant" && grantId) {
            openSelectionModal(grantId);
            // Clean URL
            router.replace("/settings/integrations");
        }
    }, [searchParams]);

    async function loadStatus() {
        try {
            const res = await fetch("/api/integrations/status");
            if (res.ok) {
                const json = await res.json();
                setData(json);
            }
        } catch (e) {
            console.error(e);
            toast.error("Failed to load integrations");
        } finally {
            setIsLoading(false);
        }
    }

    async function openSelectionModal(grantId: string) {
        setSelectingGrantId(grantId);
        setIsSelectModalOpen(true);
        setAvailableTenants([]);

        try {
            const res = await fetch(`/api/integrations/xero/tenants/list?grantId=${grantId}`);
            if (res.ok) {
                const tenants = await res.json();
                setAvailableTenants(tenants);
            } else {
                toast.error("Failed to list tenants from Xero");
            }
        } catch (e) {
            toast.error("Error fetching tenants");
        }
    }

    async function handleSelectTenant(tenantId: string) {
        if (!selectingGrantId) return;
        setIsSelecting(true);
        try {
            const res = await fetch("/api/integrations/xero/tenants/select", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ grantId: selectingGrantId, tenantId })
            });

            if (res.ok) {
                toast.success("Organization connected successfully");
                setIsSelectModalOpen(false);
                loadStatus();
            } else {
                const txt = await res.text();
                toast.error(`Connection failed: ${txt}`);
            }
        } catch (e) {
            toast.error("Failed to connect tenant");
        } finally {
            setIsSelecting(false);
        }
    }

    async function handleDisconnect(bindingId: string) {
        if (!confirm("Are you sure you want to disconnect this organization?")) return;

        try {
             const res = await fetch("/api/integrations/xero/disconnect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ tenantBindingId: bindingId })
            });

            if (res.ok) {
                toast.success("Disconnected successfully");
                loadStatus();
            } else {
                toast.error("Disconnect failed");
            }
        } catch (e) {
            toast.error("Error disconnecting");
        }
    }

    function startConnection() {
        window.location.href = "/api/integrations/xero/start";
    }

    if (isLoading) {
        return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8" /></div>;
    }

    return (
        <>
            <SettingsHeader />
            <div className="flex flex-col gap-8 p-4 md:p-8 max-w-4xl mx-auto w-full">
                <div className="flex items-center gap-4">
					<Link href="/settings">
						<Button variant="ghost" size="icon">
							<ChevronLeft className="h-5 w-5" />
						</Button>
					</Link>
                    <div>
                        <h1 className="text-3xl font-bold">Integrations</h1>
                        <p className="text-muted-foreground">Manage your connections to external services.</p>
                    </div>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                             {/* Simple Xero Icon placeholder or text */}
                             <span className="font-bold text-blue-500">Xero</span>
                        </CardTitle>
                        <CardDescription>Connect your Xero organization to sync invoices and contacts.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Active Connections */}
                        <div>
                            <h3 className="text-sm font-medium mb-4">Connected Organizations</h3>
                            {data.bindings.length === 0 ? (
                                <div className="text-sm text-muted-foreground italic">No organizations connected.</div>
                            ) : (
                                <div className="grid gap-4">
                                    {data.bindings.map(binding => {
                                        const isHealthy = binding.status === 'active' && binding.grantStatus === 'active';
                                        const needsAttention = binding.status === 'needs_reauth' || binding.grantStatus === 'refresh_failed';

                                        return (
                                            <div key={binding.id} className="border rounded-lg bg-card">
                                                {/* Header Row */}
                                                <div className="flex items-start justify-between p-4 border-b">
                                                    <div className="flex items-start gap-3">
                                                        {/* Status Icon */}
                                                        <div className="mt-1">
                                                            {isHealthy ? (
                                                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                                            ) : (
                                                                <AlertCircle className="w-5 h-5 text-amber-600" />
                                                            )}
                                                        </div>

                                                        {/* Organization Info */}
                                                        <div className="flex-1">
                                                            <div className="font-semibold text-lg">{binding.externalTenantName}</div>
                                                            <div className="text-xs text-muted-foreground mt-1">
                                                                Tenant ID: {binding.externalTenantId}
                                                            </div>
                                                            <div className="flex gap-2 mt-2">
                                                                <Badge variant={binding.status === 'active' ? 'default' : 'destructive'}>
                                                                    {binding.status}
                                                                </Badge>
                                                                {binding.grantStatus !== 'active' && (
                                                                    <Badge variant="outline" className="text-amber-600 border-amber-600">
                                                                        Token: {binding.grantStatus}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Action Buttons */}
                                                    <div className="flex gap-2">
                                                        {needsAttention && (
                                                            <Button size="sm" variant="outline" onClick={startConnection}>
                                                                <RefreshCcw className="w-4 h-4 mr-2" />
                                                                Reconnect
                                                            </Button>
                                                        )}
                                                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDisconnect(binding.id)}>
                                                            <Unplug className="w-4 h-4 mr-2" />
                                                            Disconnect
                                                        </Button>
                                                    </div>
                                                </div>

                                                {/* Connection Details */}
                                                <div className="p-4 bg-muted/30">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                        {/* Original Connection */}
                                                        <div className="flex items-start gap-2">
                                                            <Calendar className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Connected</div>
                                                                <div className="font-medium">{formatDateTime(binding.grantCreatedAt)}</div>
                                                                <div className="text-xs text-muted-foreground">{formatRelativeTime(binding.grantCreatedAt)}</div>
                                                            </div>
                                                        </div>

                                                        {/* Last Token Refresh */}
                                                        <div className="flex items-start gap-2">
                                                            <RefreshCcw className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Last Token Refresh</div>
                                                                <div className="font-medium">{formatDateTime(binding.grantUpdatedAt)}</div>
                                                                <div className="text-xs text-muted-foreground">{formatRelativeTime(binding.grantUpdatedAt)}</div>
                                                            </div>
                                                        </div>

                                                        {/* Last Used */}
                                                        {binding.grantLastUsedAt && (
                                                            <div className="flex items-start gap-2">
                                                                <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                                <div>
                                                                    <div className="text-muted-foreground text-xs">Last API Call</div>
                                                                    <div className="font-medium">{formatDateTime(binding.grantLastUsedAt)}</div>
                                                                    <div className="text-xs text-muted-foreground">{formatRelativeTime(binding.grantLastUsedAt)}</div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Token Expiry */}
                                                        <div className="flex items-start gap-2">
                                                            <Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                            <div>
                                                                <div className="text-muted-foreground text-xs">Access Token Expires</div>
                                                                <div className="font-medium">{formatDateTime(binding.grantExpiresAt)}</div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {new Date(binding.grantExpiresAt) > new Date()
                                                                        ? 'Auto-refreshes when needed'
                                                                        : 'Expired - will refresh on next use'}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                        <div className="pt-4 border-t">
                            <Button onClick={startConnection}>
                                <Plus className="w-4 h-4 mr-2" />
                                Connect New Organization
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tenant Selection Modal */}
                <Dialog open={isSelectModalOpen} onOpenChange={setIsSelectModalOpen}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Select Organization</DialogTitle>
                            <DialogDescription>
                                Select which Xero organization you want to connect to this workspace.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-4">
                            {availableTenants.length === 0 ? (
                                 <div className="flex justify-center p-4">
                                     <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
                                 </div>
                            ) : (
                                <div className="grid gap-2">
                                    {availableTenants.map(tenant => (
                                        <Button
                                            key={tenant.id}
                                            variant="outline"
                                            className="justify-between h-auto py-3 px-4"
                                            onClick={() => handleSelectTenant(tenant.tenantId)}
                                            disabled={isSelecting}
                                        >
                                            <div className="flex flex-col items-start">
                                                <span className="font-semibold">{tenant.tenantName}</span>
                                                <span className="text-xs text-muted-foreground">Type: {tenant.tenantType}</span>
                                            </div>
                                            {isSelecting && <Loader2 className="h-4 w-4 animate-spin" />}
                                        </Button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </>
    );
}
