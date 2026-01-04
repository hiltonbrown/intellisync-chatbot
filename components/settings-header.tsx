"use client";

import { useRouter } from "next/navigation";
import { memo } from "react";
import { useWindowSize } from "usehooks-ts";
import { useTheme } from "next-themes";
import { OrganizationSwitcher } from "@clerk/nextjs";
import { SidebarToggle } from "@/components/sidebar-toggle";
import { Button } from "@/components/ui/button";
import { PlusIcon } from "./icons";
import { useSidebar } from "./ui/sidebar";

function PureSettingsHeader() {
  const router = useRouter();
  const { open } = useSidebar();
  const { resolvedTheme } = useTheme();

  const { width: windowWidth } = useWindowSize();

  return (
    <header className="sticky top-0 flex items-center gap-2 bg-background px-2 py-1.5 md:px-2">
      <SidebarToggle />

      {(!open || windowWidth < 768) && (
        <Button
          className="order-2 ml-auto h-8 px-2 md:order-1 md:ml-0 md:h-fit md:px-2"
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

      <OrganizationSwitcher 
        hidePersonal
        appearance={{
          elements: {
            rootBox: "flex-shrink-0",
            organizationSwitcherTrigger: "px-2 h-8 md:h-fit",
            organizationSwitcherTriggerIcon: resolvedTheme === "dark" ? "text-gray-200" : "",
            organizationPreviewTextContainer: resolvedTheme === "dark" ? "text-gray-200" : "",
            organizationPreviewMainIdentifier: resolvedTheme === "dark" ? "text-gray-200" : "",
            organizationPreviewSecondaryIdentifier: resolvedTheme === "dark" ? "text-gray-400" : "",
          },
          variables: {
            colorText: resolvedTheme === "dark" ? "#e5e7eb" : undefined,
            colorTextSecondary: resolvedTheme === "dark" ? "#9ca3af" : undefined,
          }
        }}
      />
    </header>
  );
}

export const SettingsHeader = memo(PureSettingsHeader);
