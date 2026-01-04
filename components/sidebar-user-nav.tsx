"use client";

import { UserButton, OrganizationSwitcher } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SidebarUserNav({ user }: { user: { id: string } | null | undefined }) {
  const { setTheme, resolvedTheme } = useTheme();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <OrganizationSwitcher 
          hidePersonal
          organizationProfileUrl="/organization-profile"
          organizationProfileMode="navigation"
          appearance={{
            elements: {
              rootBox: "w-full mb-2",
              organizationSwitcherTrigger: "w-full justify-between",
            }
          }}
        />
      </SidebarMenuItem>
      <SidebarMenuItem className="flex items-center gap-2">
        <UserButton 
          showName
          userProfileUrl="/user-profile"
          appearance={{
            elements: {
              rootBox: "w-full",
              userButtonTrigger: "w-full justify-start",
              userButtonBox: "flex-row-reverse",
            }
          }}
        >
          <UserButton.MenuItems>
            <UserButton.Action
              label={resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              labelIcon={<span>{resolvedTheme === "dark" ? "☀️" : "🌙"}</span>}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            />
          </UserButton.MenuItems>
        </UserButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}