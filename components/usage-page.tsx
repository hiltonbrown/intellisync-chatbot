"use client";

import { UsageChart } from "@/components/usage-chart";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const modelUsage = [
  // Mock data - replace with real data fetching
  {
    model: "Google Gemini 2.5 Flash",
    inputTokens: 15420,
    outputTokens: 8500,
    totalTokens: 23920,
  },
  {
    model: "Anthropic Claude 3.5 Sonnet",
    inputTokens: 4200,
    outputTokens: 1200,
    totalTokens: 5400,
  },
  {
    model: "OpenAI GPT-4o",
    inputTokens: 1200,
    outputTokens: 800,
    totalTokens: 2000,
  },
];

export function UsagePage() {
  return (
    <div className="w-full space-y-6 p-1">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold">Token Usage</h1>
        <p className="text-muted-foreground">
          View your token usage over the last 7 days.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Usage Overview</CardTitle>
          <CardDescription>
            Total tokens consumed across all models.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <UsageChart />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Usage by Model</CardTitle>
          <CardDescription>
            Detailed breakdown of input and output tokens per model.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-4 border-b bg-muted/50 p-4 text-sm font-medium">
              <div>Model</div>
              <div className="text-right">Input Tokens</div>
              <div className="text-right">Output Tokens</div>
              <div className="text-right">Total</div>
            </div>
            {modelUsage.map((item) => (
              <div
                key={item.model}
                className="grid grid-cols-4 items-center p-4 text-sm hover:bg-muted/50"
              >
                <div className="font-medium">{item.model}</div>
                <div className="text-right text-muted-foreground">
                  {item.inputTokens.toLocaleString()}
                </div>
                <div className="text-right text-muted-foreground">
                  {item.outputTokens.toLocaleString()}
                </div>
                <div className="text-right font-medium">
                  {item.totalTokens.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
