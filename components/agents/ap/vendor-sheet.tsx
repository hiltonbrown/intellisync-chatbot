"use client";

import { Sparkles } from "lucide-react";
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
import {
	generateBillCommentary,
	getVendorDetails,
} from "@/lib/agents/ap/actions";

interface VendorSheetProps {
	vendorId: string | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type VendorDetails = NonNullable<Awaited<ReturnType<typeof getVendorDetails>>>;

export function VendorSheet({
	vendorId,
	open,
	onOpenChange,
}: VendorSheetProps) {
	const [data, setData] = useState<VendorDetails | null>(null);
	const [loading, setLoading] = useState(false);
	const [commentaries, setCommentaries] = useState<Record<string, string>>({});
	const [loadingCommentary, setLoadingCommentary] = useState<
		Record<string, boolean>
	>({});

	useEffect(() => {
		if (vendorId && open) {
			setLoading(true);
			setData(null);
			setCommentaries({});
			getVendorDetails(vendorId)
				.then((res) => setData(res))
				.catch((err) => toast.error("Failed to load details"))
				.finally(() => setLoading(false));
		}
	}, [vendorId, open]);

	const handleGenerateCommentary = async (
		billId: string,
		summary: string,
		amount: string,
		due: string,
	) => {
		if (!data) return;
		setLoadingCommentary((prev) => ({ ...prev, [billId]: true }));
		try {
			const text = await generateBillCommentary(
				data.supplier.name,
				summary,
				amount,
				due,
			);
			setCommentaries((prev) => ({ ...prev, [billId]: text }));
		} catch (e) {
			toast.error("Failed to generate commentary");
		} finally {
			setLoadingCommentary((prev) => ({ ...prev, [billId]: false }));
		}
	};

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent className="sm:max-w-xl overflow-y-auto">
				<SheetHeader>
					<SheetTitle>Vendor Details</SheetTitle>
					<SheetDescription>
						View bill history and payment details.
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
							<h3 className="text-lg font-bold">{data.supplier.name}</h3>
							<Badge variant="outline">Risk: {data.risk}</Badge>
						</div>

						<div className="text-sm text-muted-foreground space-y-1">
							<p>{data.supplier.email}</p>
							<p>{data.supplier.phone}</p>
						</div>

						<Tabs defaultValue="unpaid">
							<TabsList>
								<TabsTrigger value="unpaid">Unpaid Bills</TabsTrigger>
								<TabsTrigger value="paid">Paid History</TabsTrigger>
							</TabsList>

							<TabsContent value="unpaid">
								<ScrollArea className="h-[500px] pr-4">
									<div className="space-y-4">
										{data.bills
											.filter((b) => Number(b.amountDue) > 0)
											.map((bill) => (
												<div
													key={bill.id}
													className="flex flex-col gap-2 p-3 border rounded-lg"
												>
													<div className="flex justify-between items-start">
														<div>
															<p className="font-medium">
																Bill {bill.xeroBillId.substring(0, 6)}...
															</p>
															<p className="text-xs text-muted-foreground">
																Due:{" "}
																{bill.dueDate
																	? new Date(bill.dueDate).toLocaleDateString(
																			"en-AU",
																		)
																	: "N/A"}
															</p>
														</div>
														<div className="text-right">
															<p className="font-bold text-red-600">
																${bill.amountDue.toFixed(2)}
															</p>
															<p className="text-xs text-muted-foreground">
																Total: ${bill.total.toFixed(2)}
															</p>
														</div>
													</div>

													{/* Commentary Section */}
													<div className="bg-muted/50 p-2 rounded-md text-sm">
														{commentaries[bill.id] ? (
															<p className="italic text-muted-foreground">
																"{commentaries[bill.id]}"
															</p>
														) : (
															<div className="flex items-center justify-between">
																<span className="text-xs text-muted-foreground">
																	No commentary generated.
																</span>
																<Button
																	variant="ghost"
																	size="sm"
																	className="h-6"
																	disabled={loadingCommentary[bill.id]}
																	onClick={() =>
																		handleGenerateCommentary(
																			bill.id,
																			bill.lineItemsSummary || "",
																			`$${bill.amountDue}`,
																			bill.dueDate
																				? new Date(
																						bill.dueDate,
																					).toLocaleDateString("en-AU")
																				: "Unknown",
																		)
																	}
																>
																	<Sparkles className="w-3 h-3 mr-1" />
																	{loadingCommentary[bill.id]
																		? "Thinking..."
																		: "Explain"}
																</Button>
															</div>
														)}
													</div>
												</div>
											))}
										{data.bills.filter((b) => Number(b.amountDue) > 0)
											.length === 0 && (
											<div className="text-center text-muted-foreground py-8">
												No unpaid bills.
											</div>
										)}
									</div>
								</ScrollArea>
							</TabsContent>

							<TabsContent value="paid">
								<ScrollArea className="h-[500px] pr-4">
									<div className="space-y-2">
										{data.bills
											.filter((b) => Number(b.amountDue) === 0)
											.map((bill) => (
												<div
													key={bill.id}
													className="flex justify-between items-center p-3 border rounded-lg bg-muted/20 opacity-75"
												>
													<div>
														<p className="font-medium">
															Bill {bill.xeroBillId.substring(0, 6)}...
														</p>
														<p className="text-xs text-muted-foreground">
															Paid Date:{" "}
															{bill.updatedAt
																? new Date(bill.updatedAt).toLocaleDateString(
																		"en-AU",
																	)
																: "N/A"}
														</p>
													</div>
													<div className="text-right">
														<p className="font-bold text-green-600">
															${bill.total.toFixed(2)}
														</p>
														<Badge variant="secondary">Paid</Badge>
													</div>
												</div>
											))}
										{data.bills.filter((b) => Number(b.amountDue) === 0)
											.length === 0 && (
											<div className="text-center text-muted-foreground py-8">
												No history found.
											</div>
										)}
									</div>
								</ScrollArea>
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
