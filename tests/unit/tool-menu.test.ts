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
