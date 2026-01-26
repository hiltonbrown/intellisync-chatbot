export const cashflowSuggestionPrompt = (recurringTransactions: string) => `
You are a cashflow analyst.
Analyze the following recurring transactions (Description, Amount, Date):
${recurringTransactions}

Predict the NEXT occurrence of these expenses/incomes.
Return a JSON array of suggested adjustments:
[
  { "description": "Weekly Wages", "amount": 5000, "date": "2024-10-30", "type": "OUT" }
]
Only suggest high confidence recurring items (e.g. wages, rent, tax).
Ignore one-off payments.
`;
