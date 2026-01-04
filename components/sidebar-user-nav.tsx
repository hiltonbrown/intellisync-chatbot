"use client";

import { UserButton } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Settings2, Sun, Moon } from "lucide-react";
import { SidebarMenu, SidebarMenuItem } from "@/components/ui/sidebar";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";

export function SidebarUserNav({ user }: { user: { id: string } | null | undefined }) {
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  return (
    <SidebarMenu>
      <SidebarMenuItem className="flex items-center gap-2">
        <UserButton 
          showName
          userProfileUrl="/user-profile"
          appearance={{
            elements: {
              rootBox: "w-full",
              userButtonTrigger: "w-full justify-start",
              userButtonBox: "flex-row-reverse",
            },
            variables: {
              colorText: resolvedTheme === "dark" ? "#e5e7eb" : undefined,
            }
          }}
        >
          <UserButton.MenuItems>
            <UserButton.Action
              label="Settings"
              labelIcon={<Settings2 size={16} />}
              onClick={() => router.push("/settings")}
            />
            <UserButton.Action
              label={resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              labelIcon={resolvedTheme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            />
          </UserButton.MenuItems>
        </UserButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}