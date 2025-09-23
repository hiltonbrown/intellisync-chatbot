"use client";

export type ToolFieldType =
  | "text"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "multiselect";

export type ToolFieldDefinition = {
  id: string;
  type: ToolFieldType;
  optional?: boolean;
  options?: Array<{
    label: string;
    value: string;
  }>;
};

export type ToolFieldValue = string | number | boolean | Array<string> | undefined;

function coerceToNumber(value: unknown): number | undefined {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "number") {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}

function coerceToBoolean(value: unknown): boolean | undefined {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }
  }

  return Boolean(value);
}

function coerceToString(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  return typeof value === "string" ? value : String(value);
}

function coerceToStringArray(value: unknown): Array<string> {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .filter((item) => item.length > 0);
  }

  if (typeof value === "string") {
    return value.length > 0 ? [value] : [];
  }

  return [];
}

export function normaliseFieldValue(
  field: ToolFieldDefinition,
  rawValue: unknown,
): ToolFieldValue {
  switch (field.type) {
    case "number": {
      return coerceToNumber(rawValue);
    }

    case "boolean": {
      return coerceToBoolean(rawValue);
    }

    case "multiselect": {
      return coerceToStringArray(rawValue);
    }

    case "select": {
      if (
        rawValue === "" ||
        rawValue === undefined ||
        rawValue === null
      ) {
        return undefined;
      }

      return coerceToString(rawValue);
    }

    case "text":
    case "textarea":
    default: {
      return coerceToString(rawValue);
    }
  }
}

export function ToolMenu() {
  return null;
}
