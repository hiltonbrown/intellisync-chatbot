"use client";

import { UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SidebarUserNav({ user }: { user: { id: string } | null | undefined }) {
  const { setTheme, resolvedTheme } = useTheme();

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