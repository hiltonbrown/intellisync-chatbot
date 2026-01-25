"use client";

import { useState } from "react";
import { ApAgeingChart } from "./ap-ageing-chart";
import { ApSummaryCards } from "./ap-summary-cards";
import { SyncBillsButton } from "./sync-bills-button";
import { VendorSheet } from "./vendor-sheet";
import { VendorTable } from "./vendor-table";

interface DashboardSummary {
	totalPayable: number;
	countPayable: number;
	dpo: number;
}

interface AgeingData {
	current: number;
	days30: number;
	days60: number;
	days90: number;
	days90plus: number;
}

interface DashboardData {
	summary: DashboardSummary;
	ageing: AgeingData;
}

interface Vendor {
	id: string;
	name: string;
	totalDue: number;
	billCount: number;
    buckets: {
        current: number;
        days30: number;
        days60: number;
        days90: number;
        days90plus: number;
    };
}

interface ApDashboardProps {
	initialData: DashboardData | null;
	initialVendors: Vendor[];
}

export function ApDashboard({
	initialData,
	initialVendors,
}: ApDashboardProps) {
	const [selectedVendorId, setSelectedVendorId] = useState<string | null>(
		null,
	);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const handleVendorClick = (id: string) => {
		setSelectedVendorId(id);
		setIsSheetOpen(true);
	};

	return (
		<div className="flex flex-col h-full w-full">
			<header className="flex items-center justify-between px-6 py-4 border-b">
				<h1 className="text-xl font-semibold">Accounts Payable Agent</h1>
				<SyncBillsButton />
			</header>

			<main className="flex-1 overflow-y-auto p-6 space-y-6">
				{initialData && (
					<>
						<ApSummaryCards
							totalPayable={initialData.summary.totalPayable}
							countPayable={initialData.summary.countPayable}
							dpo={initialData.summary.dpo}
						/>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="col-span-1 md:col-span-2">
								<ApAgeingChart data={initialData.ageing} />
							</div>
						</div>
					</>
				)}

				<VendorTable
					vendors={initialVendors}
					onVendorClick={handleVendorClick}
				/>
			</main>

			<VendorSheet
				vendorId={selectedVendorId}
				open={isSheetOpen}
				onOpenChange={setIsSheetOpen}
			/>
		</div>
	);
}
