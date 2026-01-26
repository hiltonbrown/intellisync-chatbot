"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDownIcon } from "@/components/icons";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

export function AgentNavDropdown() {
	const pathname = usePathname();

	const agents = [
		{
			name: "Accounts Receivable",
			path: "/agents/ar",
			description: "Manage customer invoices and payments",
		},
		{
			name: "Accounts Payable",
			path: "/agents/ap",
			description: "Manage vendor bills and payments",
		},
		{
			name: "Cashflow",
			path: "/agents/cashflow",
			description: "Monitor and forecast cashflow",
		},
	];

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="h-8 px-2 md:h-fit md:px-3">
					<span className="hidden md:inline">Agents</span>
					<ChevronDownIcon size={16} />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuLabel>Navigate to Agent</DropdownMenuLabel>
				<DropdownMenuSeparator />
				{agents.map((agent) => (
					<DropdownMenuItem key={agent.path} asChild>
						<Link
							href={agent.path}
							className={`flex flex-col items-start cursor-pointer ${
								pathname === agent.path ? "bg-muted" : ""
							}`}
						>
							<span className="font-medium">{agent.name}</span>
							<span className="text-xs text-muted-foreground">
								{agent.description}
							</span>
						</Link>
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
