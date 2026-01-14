"use client";

import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Modal that prompts users to enter their first and last name
 * if they haven't been set in Clerk. This ensures personalized
 * Intellisync responses include the user's actual name.
 */
export function NameCollectionModal() {
	const { user, isLoaded } = useUser();
	const [open, setOpen] = useState(false);
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Only show modal if user is loaded and missing name information
		if (isLoaded && user && !user.firstName) {
			// Small delay to avoid flash on initial load
			const timer = setTimeout(() => {
				setOpen(true);
			}, 500);
			return () => clearTimeout(timer);
		}
	}, [isLoaded, user]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!user) return;
		if (!firstName.trim()) {
			setError("First name is required");
			return;
		}

		setIsSubmitting(true);
		setError(null);

		try {
			await user.update({
				firstName: firstName.trim(),
				lastName: lastName.trim() || undefined,
			});
			setOpen(false);
		} catch (err) {
			console.error("Failed to update user name:", err);
			setError("Failed to save your name. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleSkip = () => {
		// Allow users to skip, but they'll see "User" in responses
		setOpen(false);
	};

	// Don't render anything if user already has a name or not loaded
	if (!isLoaded || !user || user.firstName) {
		return null;
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Welcome to Intellisync</DialogTitle>
					<DialogDescription>
						Please enter your name so Intellisync can personalise your
						experience. Your name will appear in AI-generated documents and
						responses.
					</DialogDescription>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="firstName">
							First Name <span className="text-red-500">*</span>
						</Label>
						<Input
							id="firstName"
							placeholder="Enter your first name"
							value={firstName}
							onChange={(e) => setFirstName(e.target.value)}
							disabled={isSubmitting}
							autoFocus
						/>
					</div>

					<div className="space-y-2">
						<Label htmlFor="lastName">Last Name</Label>
						<Input
							id="lastName"
							placeholder="Enter your last name (optional)"
							value={lastName}
							onChange={(e) => setLastName(e.target.value)}
							disabled={isSubmitting}
						/>
					</div>

					{error && <p className="text-sm text-red-500">{error}</p>}

					<div className="flex justify-end gap-3">
						<Button
							type="button"
							variant="ghost"
							onClick={handleSkip}
							disabled={isSubmitting}
						>
							Skip for now
						</Button>
						<Button type="submit" disabled={isSubmitting || !firstName.trim()}>
							{isSubmitting ? "Saving..." : "Continue"}
						</Button>
					</div>
				</form>
			</DialogContent>
		</Dialog>
	);
}
