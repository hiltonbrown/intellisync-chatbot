import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface CashflowCardsProps {
  summary: {
    debtorsOwing: number;
    creditorsOwing: number;
    netCashflow: number;
  };
  period: number;
  onPeriodChange: (value: string) => void;
}

export function CashflowCards({ summary, period, onPeriodChange }: CashflowCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
        {/* Period Selector inside the first card or separate? Design says "drop down selector". Putting it above or integrated. */}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Debtors Owing</CardTitle>
          <Select value={period.toString()} onValueChange={onPeriodChange}>
            <SelectTrigger className="w-[100px] h-8">
                <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value="30">30 Days</SelectItem>
                <SelectItem value="60">60 Days</SelectItem>
                <SelectItem value="90">90 Days</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">+${summary.debtorsOwing.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">Projected Inflow</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Creditors Owing</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">-${summary.creditorsOwing.toLocaleString('en-AU', { minimumFractionDigits: 2 })}</div>
          <p className="text-xs text-muted-foreground">Projected Outflow</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Net Cash Position</CardTitle>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            className="h-4 w-4 text-muted-foreground"
          >
            <path d="M2 12h20M12 2v20" />
          </svg>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {summary.netCashflow >= 0 ? '+' : ''}${summary.netCashflow.toLocaleString('en-AU', { minimumFractionDigits: 2 })}
          </div>
          <p className="text-xs text-muted-foreground">Projected Net Gain/Loss</p>
        </CardContent>
      </Card>
    </div>
  );
}
