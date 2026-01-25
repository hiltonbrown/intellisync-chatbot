export const billCommentaryPrompt = (
  vendorName: string,
  lineItemsSummary: string,
  amount: string,
  dueDate: string
) => `
You are an accounts payable assistant.
Vendor: ${vendorName}
Amount: ${amount}
Due Date: ${dueDate}
Line Items: ${lineItemsSummary}

Task: Write a ONE sentence commentary summarizing what this bill is for.
Example: "Monthly subscription for Adobe Creative Cloud software licenses."
Keep it concise. If line items are missing, say "Standard invoice from ${vendorName}."
`;
