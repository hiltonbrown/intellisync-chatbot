"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { useTheme } from "next-themes";
import { type ReactNode, useEffect, useMemo, useState } from "react";

export function ClerkProviderWrapper({ children }: { children: ReactNode }) {
	const { resolvedTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const appearance = useMemo(
		() => ({
			baseTheme: mounted && resolvedTheme === "dark" ? dark : undefined,
		}),
		[resolvedTheme, mounted],
	);

	return <ClerkProvider appearance={appearance}>{children}</ClerkProvider>;
}
