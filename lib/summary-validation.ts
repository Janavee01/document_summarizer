import type { Summary } from "@/types/summary";

/*
 * Single source of truth for validating an unknown value as a Summary.
 * Used by history persistence and share-link parsing so both accept or
 * reject payloads consistently when the Summary shape evolves.
 */
export function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export function isSummary(value: unknown): value is Summary {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.title === "string" &&
    typeof candidate.documentType === "string" &&
    typeof candidate.summary === "string" &&
    isStringArray(candidate.keyPoints) &&
    isStringArray(candidate.mainIdeas) &&
    isStringArray(candidate.entities) &&
    isStringArray(candidate.actionItems) &&
    isStringArray(candidate.improvementSuggestions)
  );
}
