"use client";

import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Customer {
	id: string;
	name: string;
	totalDue: number;
	invoiceCount: number;
	current: number;
	days30: number;
	days60: number;
	days90: number;
	days90plus: number;
	riskScore: number;
	followUpTone: string;
}

interface CustomerTableProps {
	customers: Customer[];
	onCustomerClick: (customerId: string) => void;
}

type SortField =
	| "name"
	| "totalDue"
	| "current"
	| "days30"
	| "days60"
	| "days90"
	| "days90plus"
	| "riskScore";
type SortOrder = "asc" | "desc";
type FilterTab =
	| "all"
	| "current"
	| "days30"
	| "days60"
	| "days90"
	| "days90plus"
	| "high-risk";

export function CustomerTable({
	customers,
	onCustomerClick,
}: CustomerTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterTab, setFilterTab] = useState<FilterTab>("all");
	const [sortField, setSortField] = useState<SortField>("totalDue");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

	// Format currency
	const formatCurrency = (value: number) =>
		`$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	// Risk badge color based on follow-up tone
	const getToneBadgeVariant = (tone: string) => {
		if (tone === "Final") return "destructive";
		if (tone === "Firm") return "default";
		return "secondary";
	};

	// Handle sorting
	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortOrder("desc");
		}
	};

	// Filter and sort customers
	const filteredCustomers = useMemo(() => {
		let filtered = customers;

		// Apply search filter
		if (searchQuery) {
			filtered = filtered.filter((c) =>
				c.name.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		// Apply tab filter
		if (filterTab === "high-risk") {
			filtered = filtered.filter((c) => c.riskScore > 0.7);
		} else if (filterTab === "current") {
			filtered = filtered.filter((c) => c.current > 0);
		} else if (filterTab === "days30") {
			filtered = filtered.filter((c) => c.days30 > 0);
		} else if (filterTab === "days60") {
			filtered = filtered.filter((c) => c.days60 > 0);
		} else if (filterTab === "days90") {
			filtered = filtered.filter((c) => c.days90 > 0);
		} else if (filterTab === "days90plus") {
			filtered = filtered.filter((c) => c.days90plus > 0);
		}

		// Apply sorting
		filtered.sort((a, b) => {
			let comparison = 0;
			if (sortField === "name") {
				comparison = a.name.localeCompare(b.name);
			} else {
				comparison = a[sortField] - b[sortField];
			}
			return sortOrder === "asc" ? comparison : -comparison;
		});

		return filtered;
	}, [customers, searchQuery, filterTab, sortField, sortOrder]);

	return (
		<Card className="col-span-4">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle>Customer Overview</CardTitle>
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search customers..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-8"
						/>
					</div>
				</div>
				<Tabs
					value={filterTab}
					onValueChange={(v) => setFilterTab(v as FilterTab)}
				>
					<TabsList className="grid w-1/2 grid-cols-4 lg:grid-cols-7">
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="current">Current</TabsTrigger>
						<TabsTrigger value="days30">1-30</TabsTrigger>
						<TabsTrigger value="days60">31-60</TabsTrigger>
						<TabsTrigger value="days90">61-90</TabsTrigger>
						<TabsTrigger value="days90plus">90+</TabsTrigger>
						<TabsTrigger value="high-risk">High Risk</TabsTrigger>
					</TabsList>
				</Tabs>
			</CardHeader>
			<CardContent>
				<div className="overflow-x-auto">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>
									<Button
										variant="ghost"
										onClick={() => handleSort("name")}
										className="h-8 px-2 hover:bg-transparent"
									>
										Customer Name
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("totalDue")}
										className="h-8 px-2 hover:bg-transparent"
									>
										Total Outstanding
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("current")}
										className="h-8 px-2 hover:bg-transparent"
									>
										Current
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("days30")}
										className="h-8 px-2 hover:bg-transparent"
									>
										1-30
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("days60")}
										className="h-8 px-2 hover:bg-transparent"
									>
										31-60
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("days90")}
										className="h-8 px-2 hover:bg-transparent"
									>
										61-90
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("days90plus")}
										className="h-8 px-2 hover:bg-transparent"
									>
										90+
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-center">
									<Button
										variant="ghost"
										onClick={() => handleSort("riskScore")}
										className="h-8 px-2 hover:bg-transparent"
									>
										Follow-up Tone
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredCustomers.length === 0 ? (
								<TableRow>
									<TableCell colSpan={8} className="text-center">
										{searchQuery || filterTab !== "all"
											? "No customers match the current filters."
											: "No outstanding invoices found."}
									</TableCell>
								</TableRow>
							) : (
								filteredCustomers.map((customer) => (
									<TableRow
										key={customer.id}
										className="cursor-pointer hover:bg-muted/50"
										onClick={() => onCustomerClick(customer.id)}
									>
										<TableCell className="font-medium">
											{customer.name}
										</TableCell>
										<TableCell className="text-right font-medium">
											{formatCurrency(customer.totalDue)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(customer.current)}
										</TableCell>
										<TableCell className="text-right text-yellow-600">
											{formatCurrency(customer.days30)}
										</TableCell>
										<TableCell className="text-right text-orange-600">
											{formatCurrency(customer.days60)}
										</TableCell>
										<TableCell className="text-right text-red-600">
											{formatCurrency(customer.days90)}
										</TableCell>
										<TableCell className="text-right text-red-800 font-medium">
											{formatCurrency(customer.days90plus)}
										</TableCell>
										<TableCell className="text-center">
											<div className="flex flex-col items-center gap-1">
												<Badge
													variant={getToneBadgeVariant(customer.followUpTone)}
												>
													{customer.followUpTone}
												</Badge>
												<span className="text-xs text-muted-foreground">
													{customer.riskScore.toFixed(2)}
												</span>
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</CardContent>
		</Card>
	);
}
