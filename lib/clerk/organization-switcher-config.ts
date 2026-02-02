import { dark } from "@clerk/themes";
import type { OrganizationSwitcher, UserButton } from "@clerk/nextjs";
import type { ComponentProps } from "react";

type OrganizationSwitcherAppearance = NonNullable<
	ComponentProps<typeof OrganizationSwitcher>["appearance"]
>;

type UserButtonAppearance = NonNullable<
	ComponentProps<typeof UserButton>["appearance"]
>;

/**
 * Shared appearance configuration for OrganizationSwitcher components.
 * Use this in all header components to maintain consistent styling.
 */
export function getOrganizationSwitcherAppearance(
	resolvedTheme: string | undefined,
): OrganizationSwitcherAppearance {
	const isDark = resolvedTheme === "dark";

	return {
		baseTheme: isDark ? dark : undefined,
		elements: {
			rootBox: "flex-shrink-0",
			organizationSwitcherTrigger: "px-2 h-8 md:h-fit",
		},
	};
}

/**
 * Shared appearance configuration for UserButton components.
 * Use this in sidebar and header components to maintain consistent styling.
 * Also applies to UserProfile modal (account settings).
 */
export function getUserButtonAppearance(
	resolvedTheme: string | undefined,
): UserButtonAppearance {
	const isDark = resolvedTheme === "dark";

	return {
		baseTheme: isDark ? dark : undefined,
		elements: {
			rootBox: "w-full",
			userButtonTrigger: "w-full justify-start",
			userButtonBox: "flex-row-reverse",
		},
	};
}
