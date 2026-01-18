"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	getUserSystemPrompt,
	saveSystemPrompt,
} from "@/app/(auth)/personalization-actions";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

export function PersonalizationPage() {
	const [systemPrompt, setSystemPrompt] = useState<string>("");
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		async function loadPrompt() {
			try {
				const prompt = await getUserSystemPrompt();
				setSystemPrompt(prompt || "");
			} catch (error) {
				console.error("Failed to load system prompt", error);
				toast.error("Failed to load your custom system prompt.");
			} finally {
				setIsLoading(false);
			}
		}
		loadPrompt();
	}, []);

	const handleSave = async () => {
		setIsSaving(true);
		try {
			await saveSystemPrompt(systemPrompt.trim() || null);
			toast.success("System prompt saved successfully!");
		} catch (error) {
			console.error("Failed to save system prompt", error);
			toast.error("Failed to save your custom system prompt.");
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex h-48 items-center justify-center">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="w-full space-y-6 p-1">
			<div className="flex flex-col gap-2">
				<h1 className="text-2xl font-bold">Personalisation</h1>
				<p className="text-muted-foreground">
					Customise how the AI behaves by providing a custom system prompt.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Custom System Prompt</CardTitle>
					<CardDescription>
						This prompt will be prepended to all your conversations. Use it to
						define the AI's persona, expertise, or response style.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<Textarea
						placeholder="e.g. You are a helpful assistant that always responds in a concise manner and uses Markdown for formatting."
						value={systemPrompt}
						onChange={(e) => setSystemPrompt(e.target.value)}
						className="min-h-[200px] resize-none"
					/>
					<div className="flex justify-end">
						<Button onClick={handleSave} disabled={isSaving}>
							{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
							Save Changes
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
