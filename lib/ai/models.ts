// Curated list of top models from Vercel AI Gateway
export const DEFAULT_CHAT_MODEL = "google/gemini-2.5-flash-lite";

export type ChatModel = {
	id: string;
	name: string;
	provider: string;
	description: string;
};

export const chatModels: ChatModel[] = [
	// Anthropic
	{
		id: "anthropic/claude-haiku-4.5",
		name: "Claude Haiku 4.5",
		provider: "anthropic",
		description: "Fast and effective, great for everyday tasks",
	},
	{
		id: "anthropic/claude-sonnet-4.5",
		name: "Claude Sonnet 4.5",
		provider: "anthropic",
		description: "Best balance of speed, intelligence, and cost",
	},
	// OpenAI
	{
		id: "openai/gpt-5-mini",
		name: "GPT-5 Mini",
		provider: "openai",
		description: "Fast and effective for simple tasks",
	},
	{
		id: "openai/gpt-5.2",
		name: "GPT-5.2",
		provider: "openai",
		description: "Most capable OpenAI model",
	},
	// Google
	{
		id: "google/gemini-2.5-flash-lite",
		name: "Gemini 2.5 Flash Lite",
		provider: "google",
		description: "Ultra fast and effective at a range of tasks",
	},
	{
		id: "google/gemini-3-pro-preview",
		name: "Gemini 3 Pro",
		provider: "google",
		description: "Most capable Google model",
	},
	// xAI
	{
		id: "xai/grok-4.1-fast-non-reasoning",
		name: "Grok 4.1 Fast",
		provider: "xai",
		description: "Fast with 30K context",
	},
	// Reasoning models (extended thinking)
	{
		id: "anthropic/claude-4.5-sonnet-thinking",
		name: "Claude Sonnet 4.5 Thinking",
		provider: "reasoning",
		description: "Extended thinking for complex problems",
	},
	{
		id: "xai/grok-4.1-fast-reasoning",
		name: "Grok 4.1 Fast Reasoning",
		provider: "reasoning",
		description: "Fast tool-calling model with a 2M context window.",
	},
];

// Group models by provider for UI
export const modelsByProvider = chatModels.reduce(
	(acc, model) => {
		if (!acc[model.provider]) {
			acc[model.provider] = [];
		}
		acc[model.provider].push(model);
		return acc;
	},
	{} as Record<string, ChatModel[]>,
);
