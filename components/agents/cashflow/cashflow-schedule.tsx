"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

interface CashflowScheduleProps {
	events: any[];
}

export function CashflowSchedule({ events }: CashflowScheduleProps) {
	return (
		<Card className="col-span-4 md:col-span-2">
			<CardHeader>
				<CardTitle>Upcoming Schedule</CardTitle>
			</CardHeader>
			<CardContent>
				<ScrollArea className="h-[400px]">
					<div className="space-y-4">
						{events.map((event, i) => (
							<div
								key={i}
								className="flex justify-between items-center p-3 border rounded-lg"
							>
								<div className="flex items-center gap-3">
									<div
										className={`w-2 h-10 rounded-full ${event.type === "IN" ? "bg-green-500" : "bg-red-500"}`}
									/>
									<div>
										<p className="font-medium">
											{event.date
												? new Date(event.date).toLocaleDateString("en-AU", {
														weekday: "short",
														day: "numeric",
														month: "short",
													})
												: "N/A"}
										</p>
										<p className="text-sm text-muted-foreground">
											{event.title}
										</p>
									</div>
								</div>
								<div className="text-right">
									<p
										className={`font-bold ${event.type === "IN" ? "text-green-600" : "text-red-600"}`}
									>
										{event.type === "IN" ? "+" : "-"}$
										{event.amount.toLocaleString("en-AU", {
											minimumFractionDigits: 2,
										})}
									</p>
								</div>
							</div>
						))}
						{events.length === 0 && (
							<div className="text-center text-muted-foreground">
								No upcoming events found.
							</div>
						)}
					</div>
				</ScrollArea>
			</CardContent>
		</Card>
	);
}
