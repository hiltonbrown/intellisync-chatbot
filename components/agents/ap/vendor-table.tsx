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

interface VendorTableProps {
	vendors: Vendor[];
	onVendorClick: (vendorId: string) => void;
}

export function VendorTable({ vendors, onVendorClick }: VendorTableProps) {
	return (
		<Card className="col-span-4">
			<CardHeader>
				<CardTitle>Vendor Overview</CardTitle>
			</CardHeader>
			<CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Vendor</TableHead>
							<TableHead className="text-right">Total Outstanding</TableHead>
							<TableHead className="text-right">Current</TableHead>
							<TableHead className="text-right">30 Days</TableHead>
							<TableHead className="text-right">60 Days</TableHead>
							<TableHead className="text-right">90+ Days</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{vendors.length === 0 ? (
							<TableRow>
								<TableCell colSpan={6} className="text-center">
									No outstanding bills found.
								</TableCell>
							</TableRow>
						) : (
							vendors.map((vendor) => (
								<TableRow
									key={vendor.id}
									className="cursor-pointer hover:bg-muted/50"
									onClick={() => onVendorClick(vendor.id)}
								>
									<TableCell className="font-medium">{vendor.name}</TableCell>
									<TableCell className="text-right font-bold">
										$
										{vendor.totalDue.toLocaleString("en-AU", {
											minimumFractionDigits: 2,
										})}
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{vendor.buckets.current > 0
											? `$${vendor.buckets.current.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
											: "-"}
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{vendor.buckets.days30 > 0
											? `$${vendor.buckets.days30.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
											: "-"}
									</TableCell>
									<TableCell className="text-right text-muted-foreground">
										{vendor.buckets.days60 > 0
											? `$${vendor.buckets.days60.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
											: "-"}
									</TableCell>
									<TableCell className="text-right text-destructive">
										{vendor.buckets.days90plus > 0
											? `$${vendor.buckets.days90plus.toLocaleString("en-AU", { minimumFractionDigits: 2 })}`
											: "-"}
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
