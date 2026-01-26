import { CashflowDashboard } from "@/components/agents/cashflow/cashflow-dashboard";
import {
	getCalendarEvents,
	getCashflowChartData,
	getCashflowDashboardData,
} from "@/lib/agents/cashflow/queries";

export const metadata = {
	title: "Cashflow Agent",
};

export default async function CashflowPage() {
	const [data, chartData, events] = await Promise.all([
		getCashflowDashboardData(30), // Default 30
		getCashflowChartData(),
		getCalendarEvents(),
	]);

	return (
		<CashflowDashboard
			initialData={data}
			chartData={chartData}
			events={events}
		/>
	);
}
