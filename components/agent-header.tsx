"use client";

import { useRouter } from "next/navigation";
import { useWindowSize } from "usehooks-ts";
import { AgentNavDropdown } from "@/components/agent-nav-dropdown";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { PlusIcon } from "./icons";

interface AgentHeaderProps {
	title: string;
	actions?: React.ReactNode;
}

export function AgentHeader({ title, actions }: AgentHeaderProps) {
	const router = useRouter();
	const { open } = useSidebar();
	const { width: windowWidth } = useWindowSize();

	return (
		<header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2 border-b">
			<SidebarToggle />

			{(!open || windowWidth < 768) && (
				<Button
					className="h-8 px-2 md:h-fit md:px-2"
					onClick={() => {
						router.push("/");
						router.refresh();
					}}
					variant="outline"
				>
					<PlusIcon />
					<span className="md:sr-only">New Chat</span>
				</Button>
			)}

			<AgentNavDropdown />

			<div className="ml-auto flex items-center gap-2">
				<h1 className="text-base font-semibold hidden md:block">{title}</h1>
				{actions}
			</div>
		</header>
	);
}
