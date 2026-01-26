"use client";

import { CopyIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
	generateCollectionEmail,
	getCustomerDetails,
} from "@/lib/agents/ar/actions";

interface CustomerSheetProps {
	customerId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

// Client-side type definition mirroring query result
type CustomerDetails = NonNullable<
	Awaited<ReturnType<typeof getCustomerDetails>>
>;

export function CustomerSheet({
	customerId,
	open,
	onOpenChange,
}: CustomerSheetProps) {
	const [data, setData] = useState<CustomerDetails | null>(null);
	const [loading, setLoading] = useState(false);
	const [emailDraft, setEmailDraft] = useState("");
	const [generatingEmail, setGeneratingEmail] = useState(false);

	useEffect(() => {
		if (customerId && open) {
			setLoading(true);
			setData(null);
			setEmailDraft("");
			getCustomerDetails(customerId)
				.then((res) => setData(res))
				.catch((err) => toast.error("Failed to load details"))
				.finally(() => setLoading(false));
		}
	}, [customerId, open]);

	const handleGenerateEmail = async () => {
		if (!data) return;
		setGeneratingEmail(true);
		try {
			const overdue = data.invoices
				.filter(
					(i) =>
						i.amountDue > 0 && i.dueDate && new Date(i.dueDate) < new Date(),
				)
				.map((i) => ({
					date: i.date ? new Date(i.date).toLocaleDateString("en-AU") : "",
					dueDate: i.dueDate
						? new Date(i.dueDate).toLocaleDateString("en-AU")
						: "",
					amount: i.amountDue.toFixed(2),
					number: i.xeroInvoiceId.substring(0, 8),
				}));

			const draft = await generateCollectionEmail(
				data.contact.name,
				overdue,
			);
			setEmailDraft(draft);
		} catch (e) {
			toast.error("Failed to generate email");
		} finally {
			setGeneratingEmail(false);
		}
	};

	const getRiskBadge = (risk: string) => {
		switch (risk) {
			case "High":
				return <Badge variant="destructive">High Risk</Badge>;
			case "Medium":
				return (
					<Badge variant="secondary" className="bg-yellow-500 text-white">
						Medium Risk
					</Badge>
				);
			default:
				return (
					<Badge variant="outline" className="bg-green-500 text-white">
						Low Risk
					</Badge>
				);
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-xl overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Customer Details</SheetTitle>
					<SheetDescription>
						View invoice history and manage collections.
					</SheetDescription>
				</SheetHeader>

				{loading ? (
					<div className="space-y-4 py-4">
						<Skeleton className="h-8 w-1/2" />
						<Skeleton className="h-32 w-full" />
					</div>
				) : data ? (
					<div className="space-y-6 py-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-bold">{data.contact.name}</h3>
							{getRiskBadge(data.risk)}
						</div>

						<div className="text-sm text-muted-foreground space-y-1">
							<p>{data.contact.email}</p>
							<p>{data.contact.phone}</p>
						</div>

						<Tabs defaultValue="invoices">
							<TabsList>
								<TabsTrigger value="invoices">Invoices</TabsTrigger>
								<TabsTrigger value="email">Draft Email</TabsTrigger>
							</TabsList>

							<TabsContent value="invoices">
								<ScrollArea className="h-[400px]">
									<div className="space-y-2">
										{data.invoices.map((inv) => (
											<div
												key={inv.id}
												className="flex justify-between items-center p-3 border rounded-lg"
											>
												<div>
													<p className="font-medium">
														Invoice {inv.xeroInvoiceId.substring(0, 6)}...
													</p>
													<p className="text-xs text-muted-foreground">
														Due:{" "}
														{inv.dueDate
															? new Date(inv.dueDate).toLocaleDateString(
																	"en-AU",
																)
															: "N/A"}
													</p>
												</div>
												<div className="text-right">
													<p className="font-bold">${inv.total.toFixed(2)}</p>
													<Badge
														variant={
															inv.amountDue > 0
																? inv.status === "PAID"
																	? "secondary"
																	: "default"
																: "secondary"
														}
													>
														{inv.amountDue > 0 ? "Unpaid" : "Paid"}
													</Badge>
												</div>
											</div>
										))}
									</div>
								</ScrollArea>
							</TabsContent>

							<TabsContent value="email" className="space-y-4">
								<Button
									onClick={handleGenerateEmail}
									disabled={generatingEmail}
									className="w-full"
								>
									{generatingEmail
										? "Generating..."
										: "Generate Collection Email"}
								</Button>

								{emailDraft && (
									<div className="space-y-2">
										<Textarea
											value={emailDraft}
											readOnly
											className="h-[300px] font-mono text-sm"
										/>
										<Button
											variant="outline"
											onClick={() => {
												navigator.clipboard.writeText(emailDraft);
												toast.success("Copied to clipboard");
											}}
											className="w-full"
										>
											<CopyIcon className="w-4 h-4 mr-2" />
											Copy to Clipboard
										</Button>
									</div>
								)}
							</TabsContent>
						</Tabs>
					</div>
				) : (
					<div className="py-4">No details found.</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
