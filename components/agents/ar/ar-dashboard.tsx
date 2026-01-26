"use client";

import { useState } from "react";
import { AgentHeader } from "@/components/agent-header";
import { AgeingChart } from "./ageing-chart";
import { CustomerSheet } from "./customer-sheet";
import { CustomerTable } from "./customer-table";
import { SummaryCards } from "./summary-cards";
import { SyncButton } from "./sync-button";

interface DashboardSummary {
	totalOutstanding: number;
	countOutstanding: number;
	dso: number;
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

interface Customer {
	id: string;
	name: string;
	totalDue: number;
	invoiceCount: number;
}

interface ArDashboardProps {
	initialData: DashboardData | null;
	initialCustomers: Customer[];
}

export function ArDashboard({
	initialData,
	initialCustomers,
}: ArDashboardProps) {
	const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(
		null,
	);
	const [isSheetOpen, setIsSheetOpen] = useState(false);

	const handleCustomerClick = (id: string) => {
		setSelectedCustomerId(id);
		setIsSheetOpen(true);
	};

	return (
		<div className="flex flex-col h-full w-full">
			<AgentHeader
				title="Accounts Receivable Agent"
				actions={<SyncButton />}
			/>

			<main className="flex-1 overflow-y-auto p-6 space-y-6">
				{initialData && (
					<>
						<SummaryCards
							totalOutstanding={initialData.summary.totalOutstanding}
							countOutstanding={initialData.summary.countOutstanding}
							dso={initialData.summary.dso}
						/>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
							<div className="col-span-1 md:col-span-2">
								<AgeingChart data={initialData.ageing} />
							</div>
						</div>
					</>
				)}

				<CustomerTable
					customers={initialCustomers}
					onCustomerClick={handleCustomerClick}
				/>
			</main>

			<CustomerSheet
				customerId={selectedCustomerId}
				open={isSheetOpen}
				onOpenChange={setIsSheetOpen}
			/>
		</div>
	);
}
