"use client";

import { exampleSetup } from "prosemirror-example-setup";
import { inputRules } from "prosemirror-inputrules";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { memo, useEffect, useRef } from "react";

import type { Suggestion } from "@/lib/db/schema";
import {
  documentSchema,
  handleTransaction,
  headingRule,
} from "@/lib/editor/config";
import {
  buildContentFromDocument,
  buildDocumentFromContent,
  createDecorations,
} from "@/lib/editor/functions";
import {
  projectWithPositions,
  suggestionsPlugin,
  suggestionsPluginKey,
} from "@/lib/editor/suggestions";

type EditorProps = {
  content: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
  suggestions: Suggestion[];
};

function PureEditor({
  content,
  onSaveContent,
  suggestions,
  status,
}: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);
  const lastContentRef = useRef<string>("");

  // Initialize editor once on mount
  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      const state = EditorState.create({
        doc: buildDocumentFromContent(content || ""),
        plugins: [
          ...exampleSetup({ schema: documentSchema, menuBar: false }),
          inputRules({
            rules: [
              headingRule(1),
              headingRule(2),
              headingRule(3),
              headingRule(4),
              headingRule(5),
              headingRule(6),
            ],
          }),
          suggestionsPlugin,
        ],
      });

      editorRef.current = new EditorView(containerRef.current, {
        state,
      });

      lastContentRef.current = content || "";
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update transaction handler when onSaveContent changes
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.setProps({
        dispatchTransaction: (transaction) => {
          handleTransaction({
            transaction,
            editorRef,
            onSaveContent,
          });
        },
      });
    }
  }, [onSaveContent]);

  // Update editor content when content prop changes
  useEffect(() => {
    if (!editorRef.current) return;

    const safeContent = content || "";

    // Skip if content hasn't actually changed
    if (safeContent === lastContentRef.current && status !== "streaming") {
      return;
    }

    const currentContent = buildContentFromDocument(
      editorRef.current.state.doc
    );

    // Update editor if content differs from what's displayed
    if (currentContent !== safeContent) {
      const newDocument = buildDocumentFromContent(safeContent);

      const transaction = editorRef.current.state.tr.replaceWith(
        0,
        editorRef.current.state.doc.content.size,
        newDocument.content
      );

      transaction.setMeta("no-save", true);
      editorRef.current.dispatch(transaction);
      lastContentRef.current = safeContent;
    }
  }, [content, status]);

  // Update suggestions decorations
  useEffect(() => {
    if (!editorRef.current?.state.doc) return;

    const projectedSuggestions = projectWithPositions(
      editorRef.current.state.doc,
      suggestions
    ).filter(
      (suggestion) => suggestion.selectionStart && suggestion.selectionEnd
    );

    const decorations = createDecorations(
      projectedSuggestions,
      editorRef.current
    );

    const transaction = editorRef.current.state.tr;
    transaction.setMeta(suggestionsPluginKey, { decorations });
    editorRef.current.dispatch(transaction);
  }, [suggestions, content]);

  return (
    <div
      className="prose dark:prose-invert relative min-h-[200px] w-full"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps: EditorProps, nextProps: EditorProps) {
  return (
    prevProps.suggestions === nextProps.suggestions &&
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content &&
    prevProps.onSaveContent === nextProps.onSaveContent
  );
}

export const Editor = memo(PureEditor, areEqual);
