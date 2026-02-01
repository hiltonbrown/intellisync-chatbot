"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import { AgentNavDropdown } from "@/components/agent-nav-dropdown";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";

function PureSettingsHeader() {
	const router = useRouter();
	const { open } = useSidebar();
	const { width: windowWidth } = useWindowSize();

	return (
		<header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
			<SidebarToggle />

			{(!open || windowWidth < 768) && (
				<Button
					className="h-8 px-2"
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
		</header>
	);
}

export const SettingsHeader = memo(PureSettingsHeader);
