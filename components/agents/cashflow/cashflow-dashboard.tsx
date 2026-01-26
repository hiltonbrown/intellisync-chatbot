"use client";

import { useState } from "react";
import { CashflowCards } from "./cashflow-cards";
import { CashflowChart, type CashflowChartDataPoint } from "./cashflow-chart";
import { CashflowSchedule } from "./cashflow-schedule";
import { CashflowSheet } from "./cashflow-sheet";
import { SyncTransactionsButton } from "./sync-transactions-button";

export interface CashflowEvent {
	id: string;
	date: Date | null;
	amount: number;
	title: string | null;
	type: string;
}

interface CashflowDashboardProps {
	initialData: {
		summary: {
			debtorsOwing: number;
			creditorsOwing: number;
			netCashflow: number;
		};
	} | null;
	chartData: CashflowChartDataPoint[];
	events: CashflowEvent[];
}

export function CashflowDashboard({
	initialData,
	chartData,
	events,
}: CashflowDashboardProps) {
	const [period, setPeriod] = useState("30");

	return (
		<div className="flex flex-col h-full w-full">
			<header className="flex items-center justify-between px-6 py-4 border-b">
				<h1 className="text-xl font-semibold">Cashflow Agent</h1>
				<div className="flex gap-2">
					<CashflowSheet />
					<SyncTransactionsButton />
				</div>
			</header>

			<main className="flex-1 overflow-y-auto p-6 space-y-6">
				<CashflowCards
					summary={
						initialData?.summary || {
							debtorsOwing: 0,
							creditorsOwing: 0,
							netCashflow: 0,
						}
					}
					period={Number(period)}
					onPeriodChange={setPeriod}
				/>

				<div className="grid grid-cols-1 gap-6">
					<CashflowChart data={chartData} />
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
					<div className="col-span-3">
						<CashflowSchedule events={events} />
					</div>
				</div>
			</main>
		</div>
	);
}
