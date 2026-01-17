import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { SettingsHeader } from "@/components/settings-header";
import { Button } from "@/components/ui/button";

export default function IntegrationsPage() {
	return (
		<>
			<SettingsHeader />
			<div className="flex flex-col gap-8 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<div className="flex items-center gap-4">
					<Link href="/settings">
						<Button variant="ghost" size="icon">
							<ChevronLeft className="h-5 w-5" />
						</Button>
					</Link>
					<h1 className="text-3xl font-bold">Integrations</h1>
				</div>

				<div className="flex flex-col gap-6">
					<div className="border rounded-lg p-6">
						<h2 className="text-xl font-semibold mb-4">Accounting Software</h2>
						<p className="text-muted-foreground mb-4">
							Connect your accounting tools to enable seamless data
							synchronization and automation.
						</p>

						<div className="grid gap-4 md:grid-cols-2 mt-6">
							<div className="border rounded-lg p-4">
								<h3 className="font-semibold mb-2">Xero</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Cloud-based accounting software
								</p>
								<div className="text-sm text-muted-foreground">Coming soon</div>
							</div>

							<div className="border rounded-lg p-4">
								<h3 className="font-semibold mb-2">QuickBooks</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Accounting software for small businesses
								</p>
								<div className="text-sm text-muted-foreground">Coming soon</div>
							</div>

							<div className="border rounded-lg p-4">
								<h3 className="font-semibold mb-2">MYOB</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Business management platform
								</p>
								<div className="text-sm text-muted-foreground">Coming soon</div>
							</div>

							<div className="border rounded-lg p-4">
								<h3 className="font-semibold mb-2">Zoho Books</h3>
								<p className="text-sm text-muted-foreground mb-3">
									Online accounting software
								</p>
								<div className="text-sm text-muted-foreground">Coming soon</div>
							</div>
						</div>
					</div>
				</div>
			</div>
		</>
	);
}
