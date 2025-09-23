import test from "node:test";
import assert from "node:assert/strict";

import { analyzeEmailFraudInput } from "../../lib/ai/tools/analyze-email-fraud";
import {
  normaliseFieldValue,
  type ToolFieldDefinition,
} from "../../components/tool-menu";

test("normaliseFieldValue returns undefined for optional select fields with empty string values", () => {
    const optionalSelect: ToolFieldDefinition = {
      id: "urgencyLevel",
      type: "select",
      optional: true,
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    };

    const normalised = normaliseFieldValue(optionalSelect, "");

    assert.equal(normalised, undefined);

    assert.doesNotThrow(() =>
      analyzeEmailFraudInput.parse({
        senderEmail: "sender@example.com",
        senderName: "Suspicious Sender",
        subject: "Urgent invoice",
        emailBody: "This is a suspicious email body with more than ten characters.",
        analysisDepth: "detailed",
        urgencyLevel: normalised,
      }),
    );
  });

test("normaliseFieldValue preserves selected values for select fields", () => {
    const optionalSelect: ToolFieldDefinition = {
      id: "urgencyLevel",
      type: "select",
      optional: true,
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    };

    const normalised = normaliseFieldValue(optionalSelect, "medium");

    assert.equal(normalised, "medium");
  });

test("submitting analyzeEmailFraud tool with optional select left untouched passes validation", () => {
    const optionalSelect: ToolFieldDefinition = {
      id: "urgencyLevel",
      type: "select",
      optional: true,
      options: [
        { label: "Low", value: "low" },
        { label: "Medium", value: "medium" },
        { label: "High", value: "high" },
      ],
    };

    const storedValues = {
      senderEmail: "sender@example.com",
      senderName: "Suspicious Sender",
      subject: "Urgent invoice",
      emailBody: "This is a suspicious email body with more than ten characters.",
      urgencyLevel: new String(""),
    };

    const toolFields: Array<ToolFieldDefinition> = [optionalSelect];

    const submission = Object.fromEntries(
      Object.entries(storedValues).map(([fieldId, value]) => {
        const fieldDefinition = toolFields.find(
          (definition) => definition.id === fieldId,
        );

        if (!fieldDefinition) {
          return [fieldId, value];
        }

        return [fieldId, normaliseFieldValue(fieldDefinition, value)];
      }),
    );

    const result = analyzeEmailFraudInput.safeParse(submission);

    assert.equal(
      result.success,
      true,
      result.success ? undefined : JSON.stringify(result.error.issues, null, 2),
    );

    if (result.success) {
      assert.equal(result.data.urgencyLevel, undefined);
    }
  });
