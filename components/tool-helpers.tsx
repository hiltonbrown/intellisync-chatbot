"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import type { ToolUIPart } from "ai";
import type { ChatMessage } from "@/lib/types";

/**
 * Helper to determine if a tool execution was denied by the user
 */
export function getIsDenied(part: ToolUIPart): boolean {
  const state = part.state;
  return (
    state === "output-denied" ||
    (state === "approval-responded" &&
      (part as { approval?: { approved?: boolean } }).approval?.approved ===
        false)
  );
}

/**
 * Helper to extract approval ID from a tool part
 */
export function getApprovalId(part: ToolUIPart): string | undefined {
  return (part as { approval?: { id: string } }).approval?.id;
}

/**
 * Reusable approval buttons component for tools that require user approval
 */
export function ToolApprovalButtons({
  approvalId,
  toolName,
  addToolApprovalResponse,
}: {
  approvalId: string;
  toolName: string;
  addToolApprovalResponse: UseChatHelpers<ChatMessage>["addToolApprovalResponse"];
}) {
  return (
    <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
      <button
        className="rounded-md px-3 py-1.5 text-muted-foreground text-sm transition-colors hover:bg-muted hover:text-foreground"
        onClick={() => {
          addToolApprovalResponse({
            id: approvalId,
            approved: false,
            reason: `User denied ${toolName}`,
          });
        }}
        type="button"
      >
        Deny
      </button>
      <button
        className="rounded-md bg-primary px-3 py-1.5 text-primary-foreground text-sm transition-colors hover:bg-primary/90"
        onClick={() => {
          addToolApprovalResponse({
            id: approvalId,
            approved: true,
          });
        }}
        type="button"
      >
        Allow
      </button>
    </div>
  );
}

/**
 * Standard width constraint for approval-based tools
 */
export const TOOL_WIDTH_CLASS = "w-[min(100%,450px)]";
