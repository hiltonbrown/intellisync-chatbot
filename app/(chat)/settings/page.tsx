import Link from "next/link";
import { ArrowUpIcon, BoxIcon, SparklesIcon } from "@/components/icons";
import { SettingsHeader } from "@/components/settings-header";

export default function SettingsPage() {
	return (
		<>
			<SettingsHeader />
			<div className="flex flex-col gap-8 p-4 md:p-8 max-w-4xl mx-auto w-full">
				<h1 className="text-3xl font-bold">Settings</h1>

				<div className="grid gap-4 md:grid-cols-2">
					<Link href="/settings/personalisation" className="block">
						<div className="flex flex-col gap-2 p-6 border rounded-lg hover:bg-muted/50 transition-colors h-full">
							<div className="flex items-center gap-2">
								<div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
									<SparklesIcon size={20} />
								</div>
								<h2 className="text-xl font-semibold">Personalisation</h2>
							</div>
							<p className="text-muted-foreground">
								Customize the system prompt and AI behavior to match your
								preferences and needs.
							</p>
						</div>
					</Link>

					<Link href="/settings/integrations" className="block">
						<div className="flex flex-col gap-2 p-6 border rounded-lg hover:bg-muted/50 transition-colors h-full">
							<div className="flex items-center gap-2">
								<div className="p-2 rounded-md bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400">
									<BoxIcon size={20} />
								</div>
								<h2 className="text-xl font-semibold">Integrations</h2>
							</div>
							<p className="text-muted-foreground">
								Connect your accounting tools such as Xero, QuickBooks, MYOB,
								Zoho, and Sage.
							</p>
						</div>
					</Link>
				</div>
			</div>
		</>
	);
}
