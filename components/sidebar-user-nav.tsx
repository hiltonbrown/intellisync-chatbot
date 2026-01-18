"use client";

import { UserButton } from "@clerk/nextjs";
import { ChartArea, Moon, Settings2, Sun, UserRoundPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { PersonalizationPage } from "@/components/personalization-page";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { UsagePage } from "@/components/usage-page";

export function SidebarUserNav({
	user,
}: {
	user: { id: string } | null | undefined;
}) {
	const { setTheme, resolvedTheme } = useTheme();
	const router = useRouter();

	return (
		<SidebarMenu>
			<SidebarMenuItem className="flex items-center gap-2">
				<UserButton
					showName
					appearance={{
						elements: {
							rootBox: "w-full",
							userButtonTrigger: "w-full justify-start",
							userButtonBox: "flex-row-reverse",
						},
						variables: {
							colorText: resolvedTheme === "dark" ? "#e5e7eb" : undefined,
						},
					}}
				>
					<UserButton.UserProfilePage
						label="Usage"
						url="usage"
						labelIcon={<ChartArea size={16} />}
					>
						<UsagePage />
					</UserButton.UserProfilePage>

					<UserButton.UserProfilePage
						label="Personalisation"
						url="personalization"
						labelIcon={<UserRoundPen size={16} />}
					>
						<PersonalizationPage />
					</UserButton.UserProfilePage>

					<UserButton.MenuItems>
						<UserButton.Action
							label="Settings"
							labelIcon={<Settings2 size={16} />}
							onClick={() => router.push("/settings")}
						/>
						<UserButton.Action
							label={resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
							labelIcon={
								resolvedTheme === "dark" ? (
									<Sun size={16} />
								) : (
									<Moon size={16} />
								)
							}
							onClick={() =>
								setTheme(resolvedTheme === "dark" ? "light" : "dark")
							}
						/>
					</UserButton.MenuItems>
				</UserButton>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
