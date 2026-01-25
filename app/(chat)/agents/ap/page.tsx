import { ApDashboard } from "@/components/agents/ap/ap-dashboard";
import { getApDashboardData, getVendorList } from "@/lib/agents/ap/queries";

export const metadata = {
	title: "Accounts Payable Agent",
};

export default async function ApPage() {
	const [data, vendors] = await Promise.all([
		getApDashboardData(),
		getVendorList(),
	]);

	return <ApDashboard initialData={data} initialVendors={vendors} />;
}
