import { ArDashboard } from "@/components/agents/ar/ar-dashboard";
import { getArDashboardData, getCustomerList } from "@/lib/agents/ar/queries";

export const metadata = {
	title: "Accounts Receivable Agent",
};

export default async function ArPage() {
	const [data, customers] = await Promise.all([
		getArDashboardData(),
		getCustomerList(),
	]);

	return <ArDashboard initialData={data} initialCustomers={customers} />;
}
