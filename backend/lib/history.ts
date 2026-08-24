import type { Summary, SummaryLength } from "@/types/summary";
import { isSummary } from "@/lib/summary-validation";

export interface HistoryEntry {
  id: string;
  createdAt: string;
  fileName: string | null;
  sourceTypeLabel: string | null;
  length: SummaryLength;
  sourceWordCount: number | null;
  summary: Summary;
}

const STORAGE_KEY = "document-intelligence.history.v1";
const MAX_ENTRIES = 100;

function isValidEntry(value: unknown): value is HistoryEntry {
  if (typeof value !== "object" || value === null) return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.id === "string" &&
    candidate.id.length > 0 &&
    typeof candidate.createdAt === "string" &&
    (candidate.fileName === null || typeof candidate.fileName === "string") &&
    (candidate.sourceTypeLabel === null ||
      typeof candidate.sourceTypeLabel === "string") &&
    (candidate.length === "short" ||
      candidate.length === "medium" ||
      candidate.length === "long") &&
    (candidate.sourceWordCount === null ||
      typeof candidate.sourceWordCount === "number") &&
    isSummary(candidate.summary)
  );
}

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(isValidEntry)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  } catch {
    // Corrupted storage should never break the dashboard — reset it.
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage access failures (private mode, quota, etc.).
    }
    return [];
  }
}

function persist(entries: HistoryEntry[]) {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(entries.slice(0, MAX_ENTRIES))
  );
}

export function saveHistoryEntry(entry: HistoryEntry): HistoryEntry[] {
  const entries = loadHistory().filter((item) => item.id !== entry.id);
  entries.unshift(entry);

  try {
    persist(entries);
  } catch {
    // Storage may be full or unavailable; history is best-effort.
  }

  return loadHistory();
}

export function deleteHistoryEntry(id: string): HistoryEntry[] {
  const entries = loadHistory().filter((item) => item.id !== id);

  try {
    persist(entries);
  } catch {
    // Ignore storage failures; the in-memory list is already correct.
  }

  return loadHistory();
}

export function clearHistory(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

export function createHistoryId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `sum_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

interface CreateEntryInput {
  summary: Summary;
  length: SummaryLength;
  fileName?: string | null;
  sourceTypeLabel?: string | null;
  sourceWordCount?: number | null;
}

export function createHistoryEntryFromSummary({
  summary,
  length,
  fileName = null,
  sourceTypeLabel = null,
  sourceWordCount = null,
}: CreateEntryInput): HistoryEntry {
  return {
    id: createHistoryId(),
    createdAt: new Date().toISOString(),
    fileName,
    sourceTypeLabel,
    length,
    sourceWordCount,
    summary,
  };
}
