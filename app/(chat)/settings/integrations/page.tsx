"use client";

import {
	AlertCircle,
	Calendar,
	CheckCircle2,
	ChevronLeft,
	Clock,
	Loader2,
	Plus,
	RefreshCcw,
	Unplug,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SettingsHeader } from "@/components/settings-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";

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
	grantRefreshTokenIssuedAt: string | null;
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
	return date.toLocaleString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
		hour12: true,
	});
}

function formatRelativeTime(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 1) return "just now";
	if (diffMins < 60)
		return `${diffMins} minute${diffMins === 1 ? "" : "s"} ago`;
	if (diffHours < 24)
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
	return formatDateTime(dateString);
}

function formatTimeUntil(dateString: string): string {
	const date = new Date(dateString);
	const now = new Date();
	const diffMs = date.getTime() - now.getTime();

	if (diffMs < 0) return "expired";

	const diffMins = Math.floor(diffMs / 60000);
	const diffHours = Math.floor(diffMins / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? "" : "s"}`;
	if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? "" : "s"}`;
	return `${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

function getTokenHealth(
	expiresAt: string,
	refreshTokenIssuedAt: string | null,
	grantStatus: string,
): {
	level: "healthy" | "warning" | "critical";
	message: string;
} {
	if (grantStatus !== "active") {
		return {
			level: "critical",
			message: "Token refresh failed - reconnection required",
		};
	}

	const now = new Date();
	const expiryDate = new Date(expiresAt);
	const minutesUntilExpiry = Math.floor(
		(expiryDate.getTime() - now.getTime()) / 60000,
	);

	// Check refresh token age if available
	if (refreshTokenIssuedAt) {
		const refreshDate = new Date(refreshTokenIssuedAt);
		const refreshAgeDays = Math.floor(
			(now.getTime() - refreshDate.getTime()) / 86400000,
		);

		if (refreshAgeDays > 55) {
			return {
				level: "critical",
				message: `Refresh token is ${refreshAgeDays} days old (60 day limit) - will auto-refresh soon`,
			};
		}
		if (refreshAgeDays > 45) {
			return {
				level: "warning",
				message: `Refresh token is ${refreshAgeDays} days old - scheduled for rotation`,
			};
		}
	}

	// Check access token expiry
	if (minutesUntilExpiry < 0) {
		return {
			level: "warning",
			message: "Access token expired - will auto-refresh on next use",
		};
	}
	if (minutesUntilExpiry < 10) {
		return {
			level: "warning",
			message: `Token expires in ${formatTimeUntil(expiresAt)} - will auto-refresh soon`,
		};
	}

	return {
		level: "healthy",
		message: "Connection healthy - tokens fresh and valid",
	};
}

export default function IntegrationsPage() {
	const router = useRouter();
	const searchParams = useSearchParams();

	const [isLoading, setIsLoading] = useState(true);
	const [data, setData] = useState<StatusResponse>({
		bindings: [],
		grants: [],
	});

	// Modal State
	const [isSelectModalOpen, setIsSelectModalOpen] = useState(false);
	const [availableTenants, setAvailableTenants] = useState<XeroTenant[]>([]);
	const [selectingGrantId, setSelectingGrantId] = useState<string | null>(null);
	const [isSelecting, setIsSelecting] = useState(false);

	// Manual refresh state
	const [isRefreshing, setIsRefreshing] = useState(false);

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
			const res = await fetch(
				`/api/integrations/xero/tenants/list?grantId=${grantId}`,
			);
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
				body: JSON.stringify({ grantId: selectingGrantId, tenantId }),
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
		if (!confirm("Are you sure you want to disconnect this organization?"))
			return;

		try {
			const res = await fetch("/api/integrations/xero/disconnect", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ tenantBindingId: bindingId }),
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

	async function handleManualRefresh() {
		setIsRefreshing(true);
		try {
			const res = await fetch("/api/integrations/xero/refresh", {
				method: "POST",
			});

			if (res.ok) {
				const result = await res.json();
				if (result.refreshedCount > 0) {
					toast.success(
						`Successfully refreshed ${result.refreshedCount} connection${result.refreshedCount === 1 ? "" : "s"}`,
					);
				} else {
					toast.success("All tokens are already fresh");
				}
				// Reload status to show updated times
				await loadStatus();
			} else {
				toast.error("Failed to refresh tokens");
			}
		} catch (e) {
			toast.error("Error refreshing tokens");
			console.error(e);
		} finally {
			setIsRefreshing(false);
		}
	}

	if (isLoading) {
		return (
			<div className="p-8 flex justify-center">
				<Loader2 className="animate-spin h-8 w-8" />
			</div>
		);
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
						<p className="text-muted-foreground">
							Manage your connections to external services.
						</p>
					</div>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							{/* Simple Xero Icon placeholder or text */}
							<span className="font-bold text-blue-500">Xero</span>
						</CardTitle>
						<CardDescription>
							Connect your Xero organization to sync invoices and contacts.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-6">
						{/* Active Connections */}
						<div>
							<h3 className="text-sm font-medium mb-4">
								Connected Organizations
							</h3>
							{data.bindings.length === 0 ? (
								<div className="text-sm text-muted-foreground italic">
									No organizations connected.
								</div>
							) : (
								<div className="grid gap-4">
									{data.bindings.map((binding) => {
										const isHealthy =
											binding.status === "active" &&
											binding.grantStatus === "active";
										const needsAttention =
											binding.status === "needs_reauth" ||
											binding.grantStatus === "refresh_failed";

										const tokenHealth = getTokenHealth(
											binding.grantExpiresAt,
											binding.grantRefreshTokenIssuedAt,
											binding.grantStatus,
										);

										return (
											<div
												key={binding.id}
												className="border rounded-lg bg-card"
											>
												{/* Header Row */}
												<div className="flex items-start justify-between p-4 border-b">
													<div className="flex items-start gap-3 flex-1">
														{/* Status Icon */}
														<div className="mt-1">
															{tokenHealth.level === "healthy" ? (
																<CheckCircle2 className="w-5 h-5 text-green-600" />
															) : tokenHealth.level === "warning" ? (
																<AlertCircle className="w-5 h-5 text-amber-600" />
															) : (
																<AlertCircle className="w-5 h-5 text-red-600" />
															)}
														</div>

														{/* Organization Info */}
														<div className="flex-1">
															<div className="font-semibold text-lg">
																{binding.externalTenantName}
															</div>
															<div className="text-xs text-muted-foreground mt-1">
																{tokenHealth.message}
															</div>
															<div className="flex gap-2 mt-2 flex-wrap">
																<Badge
																	variant={
																		binding.status === "active"
																			? "default"
																			: "destructive"
																	}
																>
																	{binding.status}
																</Badge>
																{binding.grantStatus !== "active" && (
																	<Badge
																		variant="outline"
																		className="text-amber-600 border-amber-600"
																	>
																		Token: {binding.grantStatus}
																	</Badge>
																)}
																{tokenHealth.level === "healthy" && (
																	<Badge
																		variant="outline"
																		className="text-green-600 border-green-600"
																	>
																		Auto-refresh enabled
																	</Badge>
																)}
															</div>
														</div>
													</div>

													{/* Action Buttons */}
													<div className="flex gap-2">
														{needsAttention && (
															<Button
																size="sm"
																variant="outline"
																onClick={startConnection}
															>
																<RefreshCcw className="w-4 h-4 mr-2" />
																Reconnect
															</Button>
														)}
														<Button
															size="sm"
															variant="ghost"
															className="text-destructive hover:text-destructive"
															onClick={() => handleDisconnect(binding.id)}
														>
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
																<div className="text-muted-foreground text-xs">
																	Connected
																</div>
																<div className="font-medium">
																	{formatDateTime(binding.grantCreatedAt)}
																</div>
																<div className="text-xs text-muted-foreground">
																	{formatRelativeTime(binding.grantCreatedAt)}
																</div>
															</div>
														</div>

														{/* Last Token Refresh */}
														<div className="flex items-start gap-2">
															<RefreshCcw className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
															<div>
																<div className="text-muted-foreground text-xs">
																	Last Token Refresh
																</div>
																<div className="font-medium">
																	{formatDateTime(binding.grantUpdatedAt)}
																</div>
																<div className="text-xs text-muted-foreground">
																	{formatRelativeTime(binding.grantUpdatedAt)}
																</div>
															</div>
														</div>

														{/* Access Token Expiry */}
														<div className="flex items-start gap-2">
															<Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
															<div>
																<div className="text-muted-foreground text-xs">
																	Access Token
																</div>
																<div className="font-medium">
																	{new Date(binding.grantExpiresAt) > new Date()
																		? `Expires in ${formatTimeUntil(binding.grantExpiresAt)}`
																		: "Expired"}
																</div>
																<div className="text-xs text-muted-foreground">
																	{new Date(binding.grantExpiresAt) > new Date()
																		? "Auto-refreshes 10 min before expiry"
																		: "Will refresh on next use"}
																</div>
															</div>
														</div>

														{/* Refresh Token Age */}
														{binding.grantRefreshTokenIssuedAt && (
															<div className="flex items-start gap-2">
																<RefreshCcw className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
																<div>
																	<div className="text-muted-foreground text-xs">
																		Refresh Token Age
																	</div>
																	<div className="font-medium">
																		{formatRelativeTime(
																			binding.grantRefreshTokenIssuedAt,
																		)}
																	</div>
																	<div className="text-xs text-muted-foreground">
																		Auto-rotates at 45 days (60 day limit)
																	</div>
																</div>
															</div>
														)}

														{/* Last Used */}
														{binding.grantLastUsedAt && (
															<div className="flex items-start gap-2">
																<Clock className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
																<div>
																	<div className="text-muted-foreground text-xs">
																		Last API Call
																	</div>
																	<div className="font-medium">
																		{formatDateTime(binding.grantLastUsedAt)}
																	</div>
																	<div className="text-xs text-muted-foreground">
																		{formatRelativeTime(
																			binding.grantLastUsedAt,
																		)}
																	</div>
																</div>
															</div>
														)}
													</div>
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>

						{/* Actions Section */}
						<div className="pt-4 border-t space-y-4">
							<div className="flex flex-wrap gap-2">
								<Button onClick={startConnection}>
									<Plus className="w-4 h-4 mr-2" />
									Connect New Organization
								</Button>
								{data.bindings.length > 0 && (
									<Button
										variant="outline"
										onClick={handleManualRefresh}
										disabled={isRefreshing}
									>
										{isRefreshing ? (
											<Loader2 className="w-4 h-4 mr-2 animate-spin" />
										) : (
											<RefreshCcw className="w-4 h-4 mr-2" />
										)}
										Refresh Tokens Now
									</Button>
								)}
							</div>

							{/* Auto-refresh Info */}
							{data.bindings.length > 0 && (
								<div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
									<div className="flex items-start gap-3">
										<CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
										<div className="text-sm">
											<div className="font-medium text-blue-900 dark:text-blue-100 mb-1">
												Automatic Token Refresh Active
											</div>
											<div className="text-blue-700 dark:text-blue-300 space-y-1">
												<p>
													• Tokens are automatically checked and refreshed when you
													open chat pages
												</p>
												<p>
													• Background refresh runs every 5 minutes during active
													sessions
												</p>
												<p>
													• Tokens refresh 10 minutes before expiry and at 45
													days age
												</p>
												<p>
													• No manual reconnection needed in normal usage
												</p>
											</div>
										</div>
									</div>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				{/* Tenant Selection Modal */}
				<Dialog open={isSelectModalOpen} onOpenChange={setIsSelectModalOpen}>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Select Organization</DialogTitle>
							<DialogDescription>
								Select which Xero organization you want to connect to this
								workspace.
							</DialogDescription>
						</DialogHeader>

						<div className="space-y-4 py-4">
							{availableTenants.length === 0 ? (
								<div className="flex justify-center p-4">
									<Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
								</div>
							) : (
								<div className="grid gap-2">
									{availableTenants.map((tenant) => (
										<Button
											key={tenant.id}
											variant="outline"
											className="justify-between h-auto py-3 px-4"
											onClick={() => handleSelectTenant(tenant.tenantId)}
											disabled={isSelecting}
										>
											<div className="flex flex-col items-start">
												<span className="font-semibold">
													{tenant.tenantName}
												</span>
												<span className="text-xs text-muted-foreground">
													Type: {tenant.tenantType}
												</span>
											</div>
											{isSelecting && (
												<Loader2 className="h-4 w-4 animate-spin" />
											)}
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
