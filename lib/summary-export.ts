import type { Summary, SummaryLength } from "@/types/summary";

export interface ExportMeta {
  fileName?: string | null;
  generatedAt?: string;
  length?: SummaryLength;
}

export type ExportFormat = "txt" | "md" | "pdf";

export function formatExportDate(iso: string): string {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return iso;

  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function slugifyFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

  return slug || "summary";
}

export function buildExportFileName(
  summary: Summary,
  extension: ExportFormat
): string {
  return `${slugifyFileName(summary.title)}.${extension}`;
}

function collectSections(summary: Summary) {
  return [
    { title: "Key Points", items: summary.keyPoints },
    { title: "Main Ideas", items: summary.mainIdeas },
    { title: "Action Items", items: summary.actionItems },
  ].filter((section) => section.items.length > 0);
}

function metaLines(summary: Summary, meta: ExportMeta): string[] {
  const lines: string[] = [];

  lines.push(`Document Type: ${summary.documentType}`);

  if (meta.fileName) {
    lines.push(`Source File: ${meta.fileName}`);
  }

  if (meta.length) {
    const label = meta.length.charAt(0).toUpperCase() + meta.length.slice(1);
    lines.push(`Summary Length: ${label}`);
  }

  lines.push(
    `Generated: ${formatExportDate(meta.generatedAt ?? new Date().toISOString())}`
  );

  return lines;
}

export function buildPlainTextExport(
  summary: Summary,
  meta: ExportMeta = {}
): string {
  const sections: string[] = [];

  sections.push(summary.title);
  sections.push("=".repeat(Math.min(60, Math.max(16, summary.title.length))));
  sections.push("");
  sections.push(...metaLines(summary, meta));
  sections.push("");
  sections.push("SUMMARY");
  sections.push("-".repeat(60));
  sections.push(summary.summary);

  for (const section of collectSections(summary)) {
    sections.push("");
    sections.push(section.title.toUpperCase());
    sections.push("-".repeat(60));

    for (const item of section.items) {
      sections.push(`• ${item}`);
    }
  }

  if (summary.entities.length > 0) {
    sections.push("");
    sections.push("MENTIONED");
    sections.push("-".repeat(60));
    sections.push(summary.entities.join(", "));
  }

  if (summary.improvementSuggestions.length > 0) {
    sections.push("");
    sections.push("IMPROVEMENT SUGGESTIONS");
    sections.push("-".repeat(60));

    for (const item of summary.improvementSuggestions) {
      sections.push(`• ${item}`);
    }
  }

  return `${sections.join("\n")}\n`;
}

export function buildMarkdownExport(
  summary: Summary,
  meta: ExportMeta = {}
): string {
  const sections: string[] = [];
  const escapedMeta = metaLines(summary, meta).map((line) => line.replace(/\*/g, "\\*"));

  sections.push(`# ${summary.title}`);
  sections.push("");
  sections.push(...escapedMeta.map((line) => `- ${line}`));
  sections.push("");
  sections.push("## Summary");
  sections.push("");
  // Preserve paragraph structure: blank lines become real paragraphs and
  // single newlines become hard line breaks instead of merging into one run-on.
  sections.push(
    summary.summary
      .trim()
      .split(/\n{2,}/)
      .map((block) => block.trim().replace(/\n/g, "  \n"))
      .join("\n\n")
  );

  for (const section of collectSections(summary)) {
    sections.push("");
    sections.push(`## ${section.title}`);
    sections.push("");

    for (const item of section.items) {
      // Keep list rendering stable when the model emits multi-line bullets.
      const [first, ...rest] = item.split("\n");
      sections.push(`- ${first}`);
      for (const continuation of rest) {
        sections.push(`  ${continuation}`);
      }
    }
  }

  if (summary.entities.length > 0) {
    sections.push("");
    sections.push("## Mentioned");
    sections.push("");
    sections.push(summary.entities.map((entity) => `\`${entity}\``).join(" · "));
  }

  if (summary.improvementSuggestions.length > 0) {
    sections.push("");
    sections.push("## Improvement Suggestions");
    sections.push("");

    for (const item of summary.improvementSuggestions) {
      sections.push(`- ${item}`);
    }
  }

  return `${sections.join("\n")}\n`;
}

export function downloadTextFile(
  fileName: string,
  content: string,
  mimeType: string
): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");

  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
