"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

interface Customer {
	id: string;
	name: string;
	totalDue: number;
	invoiceCount: number;
}

interface CustomerTableProps {
	customers: Customer[];
	onCustomerClick: (customerId: string) => void;
}

export function CustomerTable({
	customers,
	onCustomerClick,
}: CustomerTableProps) {
	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Customer Overview</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Customer</TableHead>
							<TableHead className="text-right">Invoices</TableHead>
							<TableHead className="text-right">Total Outstanding</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{customers.length === 0 ? (
							<TableRow>
								<TableCell colSpan={3} className="text-center">
									No outstanding invoices found.
								</TableCell>
							</TableRow>
						) : (
							customers.map((customer) => (
								<TableRow
									key={customer.id}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() => onCustomerClick(customer.id)}
								>
									<TableCell className="font-medium">{customer.name}</TableCell>
									<TableCell className="text-right">
										{customer.invoiceCount}
									</TableCell>
									<TableCell className="text-right">
										$
										{customer.totalDue.toLocaleString("en-AU", {
											minimumFractionDigits: 2,
										})}
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</CardContent>
		</Card>
	);
}
