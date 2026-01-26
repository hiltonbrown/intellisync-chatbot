"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { syncXeroData } from "@/lib/integrations/xero/actions";

export function SyncButton() {
	const [loading, setLoading] = useState(false);

	const handleSync = async () => {
		setLoading(true);
		try {
			const res = await syncXeroData();
			if (res.success) {
				toast.success(
					`Synced ${res.counts.invoices} invoices and ${res.counts.contacts} contacts.`,
				);
			}
		} catch (error) {
			toast.error(
				"Failed to sync Xero data: " +
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
			{loading ? "Syncing..." : "Sync Xero Data"}
		</Button>
	);
}
