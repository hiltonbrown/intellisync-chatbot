import type { OrganizationSwitcher } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type AppearanceConfig = NonNullable<
	ComponentProps<typeof OrganizationSwitcher>["appearance"]
>;

/**
 * Shared appearance configuration for OrganizationSwitcher components.
 * Use this in all header components to maintain consistent styling.
 */
export function getOrganizationSwitcherAppearance(
	resolvedTheme: string | undefined,
): AppearanceConfig {
	const isDark = resolvedTheme === "dark";

	return {
		elements: {
			rootBox: "flex-shrink-0",
			organizationSwitcherTrigger: "px-2 h-8 md:h-fit",
			organizationSwitcherTriggerIcon: isDark ? "text-gray-200" : "",
			organizationPreviewTextContainer: isDark ? "text-gray-200" : "",
			organizationPreviewMainIdentifier: isDark ? "text-gray-200" : "",
			organizationPreviewSecondaryIdentifier: isDark ? "text-gray-400" : "",
		},
		variables: {
			colorText: isDark ? "#e5e7eb" : undefined,
			colorTextSecondary: isDark ? "#9ca3af" : undefined,
		},
	};
}
