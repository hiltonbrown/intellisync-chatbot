import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { geolocation } from "@vercel/functions";
import {
	convertToModelMessages,
	createUIMessageStream,
	JsonToSseTransformStream,
	smoothStream,
	stepCountIs,
	streamText,
} from "ai";
import { after } from "next/server";
import {
	createResumableStreamContext,
	type ResumableStreamContext,
} from "resumable-stream";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import {
	createIntellisyncContext,
	intellisyncSystemPrompt,
	type RequestHints,
} from "@/lib/ai/prompts";
import { getLanguageModel } from "@/lib/ai/providers";
import { buildRagContext } from "@/lib/ai/rag";
import { createDocument } from "@/lib/ai/tools/create-document";
import { createXeroContact } from "@/lib/ai/tools/create-xero-contact";
import { createXeroCreditNote } from "@/lib/ai/tools/create-xero-credit-note";
import { createXeroInvoice } from "@/lib/ai/tools/create-xero-invoice";
import { createXeroPayment } from "@/lib/ai/tools/create-xero-payment";
import { createXeroPayrollTimesheet } from "@/lib/ai/tools/create-xero-payroll-timesheet";
import { createXeroQuote } from "@/lib/ai/tools/create-xero-quote";
import { getABNDetails } from "@/lib/ai/tools/get-abn-details";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { getXeroPayrollTimesheet } from "@/lib/ai/tools/get-xero-payroll-timesheet";
import { listXeroAccounts } from "@/lib/ai/tools/list-xero-accounts";
import { listXeroAgedPayables } from "@/lib/ai/tools/list-xero-aged-payables";
import { listXeroAgedReceivables } from "@/lib/ai/tools/list-xero-aged-receivables";
import { listXeroBalanceSheet } from "@/lib/ai/tools/list-xero-balance-sheet";
import { listXeroBankTransactions } from "@/lib/ai/tools/list-xero-bank-transactions";
import { listXeroContactGroups } from "@/lib/ai/tools/list-xero-contact-groups";
import { listXeroContacts } from "@/lib/ai/tools/list-xero-contacts";
import { listXeroCreditNotes } from "@/lib/ai/tools/list-xero-credit-notes";
import { listXeroInvoices } from "@/lib/ai/tools/list-xero-invoices";
import { listXeroItems } from "@/lib/ai/tools/list-xero-items";
import { listXeroOrganisation } from "@/lib/ai/tools/list-xero-organisation";
import { listXeroPayments } from "@/lib/ai/tools/list-xero-payments";
import { listXeroPayrollCalendars } from "@/lib/ai/tools/list-xero-payroll-calendars";
import { listXeroPayrollEmployees } from "@/lib/ai/tools/list-xero-payroll-employees";
import { listXeroPayrollLeaveApplications } from "@/lib/ai/tools/list-xero-payroll-leave-applications";
import { listXeroPayrollLeaveTypes } from "@/lib/ai/tools/list-xero-payroll-leave-types";
import { listXeroProfitAndLoss } from "@/lib/ai/tools/list-xero-profit-and-loss";
import { listXeroQuotes } from "@/lib/ai/tools/list-xero-quotes";
import { listXeroTaxRates } from "@/lib/ai/tools/list-xero-tax-rates";
import { listXeroTrialBalance } from "@/lib/ai/tools/list-xero-trial-balance";
import { requestSuggestions } from "@/lib/ai/tools/request-suggestions";
import { searchABNByName } from "@/lib/ai/tools/search-abn-by-name";
import { updateDocument } from "@/lib/ai/tools/update-document";
import { updateXeroContact } from "@/lib/ai/tools/update-xero-contact";
import { updateXeroCreditNote } from "@/lib/ai/tools/update-xero-credit-note";
import { updateXeroInvoice } from "@/lib/ai/tools/update-xero-invoice";
import { updateXeroPayrollTimesheet } from "@/lib/ai/tools/update-xero-payroll-timesheet";
import { updateXeroQuote } from "@/lib/ai/tools/update-xero-quote";
import { DEFAULT_CHAT_TITLE, isProductionEnvironment } from "@/lib/constants";
import {
	createStreamId,
	deleteChatById,
	getChatById,
	getDocumentById,
	getMessageCountByUserId,
	getMessagesByChatId,
	getUserById,
	getUserSettingsByUserId,
	saveChat,
	saveMessages,
	updateChatTitleById,
	updateMessage,
	verifyUser,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import {
	convertToUIMessages,
	generateUUID,
	getMostRecentUserMessage,
	getTextFromMessage,
} from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
	if (!globalStreamContext) {
		try {
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
		} catch (error: any) {
			if (error.message.includes("REDIS_URL")) {
				console.log(
					" > Resumable streams are disabled due to missing REDIS_URL",
				);
			} else {
				console.error(error);
			}
		}
	}

	return globalStreamContext;
}

export async function POST(request: Request) {
	let requestBody: PostRequestBody;

	try {
		const json = await request.json();
		requestBody = postRequestBodySchema.parse(json);
	} catch (error) {
		console.error("Chat API request validation failed:", error);
		return new ChatSDKError("bad_request:api").toResponse();
	}

	try {
		const {
			id,
			message,
			messages,
			selectedChatModel,
			selectedVisibilityType,
			currentDocumentId,
		} = requestBody;

		const { userId } = await auth();
		const user = userId ? await currentUser() : null;

		if (!userId || !user) {
			return new ChatSDKError("unauthorized:chat").toResponse();
		}

		await verifyUser({
			id: userId,
			email: user.emailAddresses[0]?.emailAddress ?? "",
		});

		const userType = "regular";

		const messageCount = await getMessageCountByUserId({
			id: userId,
			differenceInHours: 24,
		});

		if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
			return new ChatSDKError("rate_limit:chat").toResponse();
		}

		// Check if this is a tool approval flow (all messages sent)
		const isToolApprovalFlow = Boolean(messages);

		const chat = await getChatById({ id });
		let messagesFromDb: DBMessage[] = [];
		let titlePromise: Promise<string> | null = null;

		const dbUser = await getUserById({ id: userId });
		const userSettings = await getUserSettingsByUserId({ userId });

		// Get organization name from Clerk if available
		const { orgId } = await auth();
		let companyName = userSettings?.companyName || "Your Organisation";
		if (orgId) {
			try {
				const client = await clerkClient();
				const org = await client.organizations.getOrganization({
					organizationId: orgId,
				});
				companyName = org.name;
			} catch (error) {
				console.warn("Failed to fetch organization name:", error);
			}
		}

		if (chat) {
			if (chat.userId !== userId) {
				return new ChatSDKError("forbidden:chat").toResponse();
			}
			// Only fetch messages if chat already exists and not tool approval
			if (!isToolApprovalFlow) {
				messagesFromDb = await getMessagesByChatId({ id });
			}
		} else if (message?.role === "user") {
			// Save chat immediately with placeholder title
			await saveChat({
				id,
				userId,
				title: DEFAULT_CHAT_TITLE,
				visibility: selectedVisibilityType,
			});

			// Start title generation in parallel (don't await)
			titlePromise = generateTitleFromUserMessage({ message });
		}

		// Use all messages for tool approval, otherwise DB messages + new message
		const uiMessages = isToolApprovalFlow
			? (messages as ChatMessage[])
			: [...convertToUIMessages(messagesFromDb), message as ChatMessage];

		// Validate that we have messages to process
		if (!uiMessages || uiMessages.length === 0 || !uiMessages[0]) {
			return new ChatSDKError("bad_request:api").toResponse();
		}

		// Validate that messages have content (parts with actual data)
		const hasValidContent = uiMessages.some((msg) => {
			if (!msg.parts || msg.parts.length === 0) return false;
			return msg.parts.some((part: any) => {
				if (part.type === "text") {
					return part.text && part.text.trim().length > 0;
				}
				if (part.type === "file") {
					return part.url && part.url.length > 0;
				}
				return true; // Other part types are assumed valid
			});
		});

		if (!hasValidContent) {
			console.warn("No valid message content found in request", {
				messageCount: uiMessages.length,
				firstMessageParts: uiMessages[0]?.parts?.length ?? 0,
				isToolApproval: isToolApprovalFlow,
				chatId: id,
			});
			return new ChatSDKError("bad_request:api").toResponse();
		}

		const { longitude, latitude, city, country } = geolocation(request);

		const requestHints: RequestHints = {
			longitude,
			latitude,
			city,
			country,
		};

		const ragMessage =
			message?.role === "user" ? message : getMostRecentUserMessage(uiMessages);
		const ragQuery = ragMessage ? getTextFromMessage(ragMessage) : "";
		const { context: documentContext } = await buildRagContext({
			userId,
			chatId: id,
			query: ragQuery,
		});

		// Build Intellisync context with user data and settings
		const intellisyncContext = createIntellisyncContext({
			firstName: user.firstName,
			lastName: user.lastName,
			companyName,
			timezone: userSettings?.timezone,
			baseCurrency: userSettings?.baseCurrency,
			dateFormat: userSettings?.dateFormat,
			selectedChatModel,
			requestHints,
			customPrompt: dbUser?.systemPrompt,
		});

		const baseSystemPrompt = intellisyncSystemPrompt(intellisyncContext);

		let currentDocumentContext = "";
		if (currentDocumentId) {
			const currentDocument = await getDocumentById({ id: currentDocumentId });

			if (currentDocument && currentDocument.content) {
				currentDocumentContext = `
<active_artifact>
  <id>${currentDocument.id}</id>
  <title>${currentDocument.title}</title>
  <kind>${currentDocument.kind}</kind>
  <content>
${currentDocument.content}
  </content>
  <instruction>
    The user is currently viewing the artifact above. 
    The content provided in the <content> tag is the RAW data of the file. 
    You have full access to read, analyze, calculate, and summarize this data.
    If the user asks "what is in this file" or "analyze this", use the content above to answer.
    Do NOT claim you cannot read the file. It is right here.
  </instruction>
</active_artifact>
`;
			}
		}

		// Check for newly uploaded CSV/TSV files and provide their content
		let uploadedFileContext = "";
		if (message?.role === "user" && message.parts) {
			const fileParts = message.parts.filter(
				(part: any) =>
					part.type === "file" &&
					part.documentId && // Must have documentId
					(part.mediaType === "text/csv" ||
						part.mediaType === "text/tab-separated-values"),
			);

			if (fileParts.length > 0) {
				const fileContents = await Promise.all(
					fileParts.map(async (filePart: any) => {
						const fileName = filePart.name;
						const documentId = filePart.documentId;

						// Fetch the full CSV content from the database using documentId
						const document = await getDocumentById({ id: documentId });

						if (document && document.content) {
							return {
								name: fileName,
								content: document.content,
							};
						}

						return null;
					}),
				);

				const validFileContents = fileContents.filter(Boolean);
				if (validFileContents.length > 0) {
					uploadedFileContext = validFileContents
						.map(
							(file) => `
<uploaded_file>
  <filename>${file!.name}</filename>
  <content>
${file!.content}
  </content>
  <instruction>
    The user has just uploaded this CSV/TSV file. You MUST create a sheet artifact to display this data.
    Use the createDocument tool with kind="sheet", title="${file!.name}", and include the exact content above.
    Do this automatically in your first response, even if the user doesn't ask for it.
  </instruction>
</uploaded_file>
`,
						)
						.join("\n");
				}
			}
		}

		const systemWithContext = [
			baseSystemPrompt,
			documentContext ? `DOCUMENT CONTEXT:\n${documentContext}` : null,
			currentDocumentContext,
			uploadedFileContext,
			"Use the conversation below to answer the user.",
		]
			.filter(Boolean)
			.join("\n\n");

		// Only save user messages to the database (not tool approval responses)
		if (message?.role === "user") {
			await saveMessages({
				messages: [
					{
						chatId: id,
						id: message.id,
						role: "user",
						parts: message.parts,
						attachments: [],
						createdAt: new Date(),
					},
				],
			});
		}

		const streamId = generateUUID();
		await createStreamId({ streamId, chatId: id });

		const stream = createUIMessageStream({
			// Pass original messages for tool approval continuation
			originalMessages: isToolApprovalFlow ? uiMessages : undefined,
			execute: async ({ writer: dataStream }) => {
				// Handle title generation in parallel
				if (titlePromise) {
					titlePromise.then((title) => {
						updateChatTitleById({ chatId: id, title });
						dataStream.write({ type: "data-chat-title", data: title });
					});
				}

				const isReasoningModel =
					selectedChatModel.includes("reasoning") ||
					selectedChatModel.includes("thinking");

				const result = streamText({
					model: getLanguageModel(selectedChatModel),
					system: systemWithContext,
					messages: await convertToModelMessages(uiMessages),
					stopWhen: stepCountIs(5),
					experimental_activeTools: [
						"getWeather",
						"createDocument",
						"updateDocument",
						"requestSuggestions",
						...(process.env.ABN_LOOKUP_ENABLED === "true"
							? ["getABNDetails" as const, "searchABNByName" as const]
							: []),
						// Xero integration tools
						"listXeroOrganisation",
						"listXeroProfitAndLoss",
						"listXeroBalanceSheet",
						"listXeroInvoices",
						"listXeroContacts",
						"listXeroAccounts",
						"createXeroInvoice",
						"listXeroCreditNotes",
						"listXeroQuotes",
						"listXeroBankTransactions",
						"listXeroPayments",
						"listXeroItems",
						"listXeroTaxRates",
						"listXeroTrialBalance",
						"listXeroAgedReceivables",
						"listXeroAgedPayables",
						"createXeroContact",
						"updateXeroContact",
						"createXeroQuote",
						"updateXeroQuote",
						"createXeroCreditNote",
						"updateXeroCreditNote",
						"createXeroPayment",
						"updateXeroInvoice",
						"listXeroPayrollEmployees",
						"listXeroPayrollLeaveApplications",
						"listXeroPayrollLeaveTypes",
						"createXeroPayrollTimesheet",
						"getXeroPayrollTimesheet",
						"updateXeroPayrollTimesheet",
						"listXeroContactGroups",
						"listXeroPayrollCalendars",
					],
					experimental_transform: smoothStream({ chunking: "word" }),
					providerOptions: isReasoningModel
						? {
								anthropic: {
									thinking: { type: "enabled", budgetTokens: 10_000 },
								},
							}
						: undefined,
					tools: {
						getWeather,
						createDocument: createDocument({ userId, chatId: id, dataStream }),
						updateDocument: updateDocument({ userId, chatId: id, dataStream }),
						requestSuggestions: requestSuggestions({
							userId,
							dataStream,
						}),
						...(process.env.ABN_LOOKUP_ENABLED === "true"
							? { getABNDetails, searchABNByName }
							: {}),
						// Xero integration tools
						listXeroOrganisation,
						listXeroProfitAndLoss,
						listXeroBalanceSheet,
						listXeroInvoices,
						listXeroContacts,
						listXeroAccounts,
						createXeroInvoice,
						listXeroCreditNotes,
						listXeroQuotes,
						listXeroBankTransactions,
						listXeroPayments,
						listXeroItems,
						listXeroTaxRates,
						listXeroTrialBalance,
						listXeroAgedReceivables,
						listXeroAgedPayables,
						createXeroContact,
						updateXeroContact,
						createXeroQuote,
						updateXeroQuote,
						createXeroCreditNote,
						updateXeroCreditNote,
						createXeroPayment,
						updateXeroInvoice,
						listXeroPayrollEmployees,
						listXeroPayrollLeaveApplications,
						listXeroPayrollLeaveTypes,
						createXeroPayrollTimesheet,
						getXeroPayrollTimesheet,
						updateXeroPayrollTimesheet,
						listXeroContactGroups,
						listXeroPayrollCalendars,
					},
					experimental_telemetry: {
						isEnabled: isProductionEnvironment,
						functionId: "stream-text",
					},
				});

				result.consumeStream();

				dataStream.merge(
					result.toUIMessageStream({
						sendReasoning: true,
					}),
				);
			},
			generateId: generateUUID,
			onFinish: async ({ messages: finishedMessages }) => {
				if (isToolApprovalFlow) {
					// For tool approval, update existing messages (tool state changed) and save new ones
					for (const finishedMsg of finishedMessages) {
						const existingMsg = uiMessages.find((m) => m.id === finishedMsg.id);
						if (existingMsg) {
							// Update existing message with new parts (tool state changed)
							await updateMessage({
								id: finishedMsg.id,
								parts: finishedMsg.parts,
							});
						} else {
							// Save new message
							await saveMessages({
								messages: [
									{
										id: finishedMsg.id,
										role: finishedMsg.role,
										parts: finishedMsg.parts,
										createdAt: new Date(),
										attachments: [],
										chatId: id,
									},
								],
							});
						}
					}
				} else if (finishedMessages.length > 0) {
					// Normal flow - save all finished messages
					await saveMessages({
						messages: finishedMessages.map((currentMessage) => ({
							id: currentMessage.id,
							role: currentMessage.role,
							parts: currentMessage.parts,
							createdAt: new Date(),
							attachments: [],
							chatId: id,
						})),
					});
				}
			},
			onError: () => {
				return "Oops, an error occurred!";
			},
		});

		const streamContext = getStreamContext();

		if (streamContext) {
			try {
				const resumableStream = await streamContext.resumableStream(
					streamId,
					() => stream.pipeThrough(new JsonToSseTransformStream()),
				);
				if (resumableStream) {
					return new Response(resumableStream);
				}
			} catch (error) {
				console.error("Failed to create resumable stream:", error);
			}
		}

		return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
	} catch (error) {
		const vercelId = request.headers.get("x-vercel-id");

		if (error instanceof ChatSDKError) {
			return error.toResponse();
		}

		// Check for Vercel AI Gateway credit card error
		if (
			error instanceof Error &&
			error.message?.includes(
				"AI Gateway requires a valid credit card on file to service requests",
			)
		) {
			return new ChatSDKError("bad_request:activate_gateway").toResponse();
		}

		// Check for empty prompt error (AI Gateway specific)
		if (
			error instanceof Error &&
			(error.message?.includes("must include at least one parts field") ||
				error.message?.includes("The model is overloaded"))
		) {
			console.error("Empty prompt or overloaded model error:", {
				message: error.message,
				vercelId,
			});
			return new ChatSDKError("bad_request:api").toResponse();
		}

		console.error("Unhandled error in chat API:", error, { vercelId });
		return new ChatSDKError("offline:chat").toResponse();
	}
}

export async function DELETE(request: Request) {
	const { searchParams } = new URL(request.url);
	const id = searchParams.get("id");

	if (!id) {
		return new ChatSDKError("bad_request:api").toResponse();
	}

	const { userId } = await auth();

	if (!userId) {
		return new ChatSDKError("unauthorized:chat").toResponse();
	}

	const chat = await getChatById({ id });

	if (chat?.userId !== userId) {
		return new ChatSDKError("forbidden:chat").toResponse();
	}

	const deletedChat = await deleteChatById({ id });

	return Response.json(deletedChat, { status: 200 });
}
