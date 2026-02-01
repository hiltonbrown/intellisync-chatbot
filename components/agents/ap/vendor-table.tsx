"use client";

import { ArrowUpDown, Search } from "lucide-react";
import { useMemo, useState } from "react";
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

interface Vendor {
	id: string;
	name: string;
	totalDue: number;
	billCount: number;
	current: number;
	days30: number;
	days60: number;
	days90: number;
	days90plus: number;
}

interface VendorTableProps {
	vendors: Vendor[];
	onVendorClick: (vendorId: string) => void;
}

type SortField =
	| "name"
	| "totalDue"
	| "current"
	| "days30"
	| "days60"
	| "days90"
	| "days90plus";
type SortOrder = "asc" | "desc";
type FilterTab =
	| "all"
	| "current"
	| "days30"
	| "days60"
	| "days90"
	| "days90plus";

export function VendorTable({ vendors, onVendorClick }: VendorTableProps) {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterTab, setFilterTab] = useState<FilterTab>("all");
	const [sortField, setSortField] = useState<SortField>("totalDue");
	const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

	// Format currency
	const formatCurrency = (value: number) =>
		`$${value.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

	// Handle sorting
	const handleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortOrder("desc");
		}
	};

	// Filter and sort vendors
	const filteredVendors = useMemo(() => {
		let filtered = vendors;

		// Apply search filter
		if (searchQuery) {
			filtered = filtered.filter((v) =>
				v.name.toLowerCase().includes(searchQuery.toLowerCase()),
			);
		}

		// Apply tab filter
		if (filterTab === "current") {
			filtered = filtered.filter((v) => v.current > 0);
		} else if (filterTab === "days30") {
			filtered = filtered.filter((v) => v.days30 > 0);
		} else if (filterTab === "days60") {
			filtered = filtered.filter((v) => v.days60 > 0);
		} else if (filterTab === "days90") {
			filtered = filtered.filter((v) => v.days90 > 0);
		} else if (filterTab === "days90plus") {
			filtered = filtered.filter((v) => v.days90plus > 0);
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
	}, [vendors, searchQuery, filterTab, sortField, sortOrder]);

	return (
		<Card className="col-span-4">
			<CardHeader>
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<CardTitle>Vendor Overview</CardTitle>
					<div className="relative w-full sm:w-64">
						<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search vendors..."
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
					<TabsList className="grid w-1/2 grid-cols-3 lg:grid-cols-6">
						<TabsTrigger value="all">All</TabsTrigger>
						<TabsTrigger value="current">Current</TabsTrigger>
						<TabsTrigger value="days30">1-30</TabsTrigger>
						<TabsTrigger value="days60">31-60</TabsTrigger>
						<TabsTrigger value="days90">61-90</TabsTrigger>
						<TabsTrigger value="days90plus">90+</TabsTrigger>
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
										Vendor Name
										<ArrowUpDown className="ml-2 h-4 w-4" />
									</Button>
								</TableHead>
								<TableHead className="text-right">
									<Button
										variant="ghost"
										onClick={() => handleSort("totalDue")}
										className="h-8 px-2 hover:bg-transparent"
									>
										Total Payable
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
							</TableRow>
						</TableHeader>
						<TableBody>
							{filteredVendors.length === 0 ? (
								<TableRow>
									<TableCell colSpan={7} className="text-center">
										{searchQuery || filterTab !== "all"
											? "No vendors match the current filters."
											: "No outstanding bills found."}
									</TableCell>
								</TableRow>
							) : (
								filteredVendors.map((vendor) => (
									<TableRow
										key={vendor.id}
										className="cursor-pointer hover:bg-muted/50"
										onClick={() => onVendorClick(vendor.id)}
									>
										<TableCell className="font-medium">{vendor.name}</TableCell>
										<TableCell className="text-right font-medium">
											{formatCurrency(vendor.totalDue)}
										</TableCell>
										<TableCell className="text-right">
											{formatCurrency(vendor.current)}
										</TableCell>
										<TableCell className="text-right text-yellow-600">
											{formatCurrency(vendor.days30)}
										</TableCell>
										<TableCell className="text-right text-orange-600">
											{formatCurrency(vendor.days60)}
										</TableCell>
										<TableCell className="text-right text-red-600">
											{formatCurrency(vendor.days90)}
										</TableCell>
										<TableCell className="text-right text-red-800 font-medium">
											{formatCurrency(vendor.days90plus)}
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
