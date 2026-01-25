"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncXeroBills } from "@/lib/integrations/xero/actions";

export function SyncBillsButton() {
	const [loading, setLoading] = useState(false);

	const handleSync = async () => {
		setLoading(true);
		try {
			const res = await syncXeroBills();
			if (res.success) {
				toast.success(
					`Synced ${res.counts.bills} bills and ${res.counts.suppliers} suppliers.`,
				);
			}
		} catch (error) {
			toast.error(
				"Failed to sync Xero bills: " +
					(error instanceof Error ? error.message : "Unknown error"),
			);
		} finally {
			setLoading(false);
		}
	};

	return (
		<Button
			onClick={handleSync}
			disabled={loading}
			variant="outline"
			className="gap-2"
		>
			<RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
			{loading ? "Syncing..." : "Sync Bills"}
		</Button>
	);
}
