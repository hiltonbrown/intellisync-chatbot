export const placeholderChatTitles = ["New chat", "New Chat"] as const;

export const isPlaceholderChatTitle = (title: string) =>
	placeholderChatTitles.includes(
		title.trim() as (typeof placeholderChatTitles)[number],
	);
