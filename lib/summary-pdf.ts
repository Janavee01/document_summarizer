"use client";

import { jsPDF } from "jspdf";
import type { Summary } from "@/types/summary";
import {
  formatExportDate,
  slugifyFileName,
  type ExportMeta,
} from "@/lib/summary-export";

const MARGIN = 56;
const BODY_SIZE = 10.5;
const BODY_LEADING = 15.5;

export function buildSummaryPdf(
  summary: Summary,
  meta: ExportMeta = {}
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGIN * 2;
  let cursorY = MARGIN;

  const ensureSpace = (needed: number) => {
    if (cursorY + needed > pageHeight - MARGIN) {
      doc.addPage();
      cursorY = MARGIN;
    }
  };

  const writeWrapped = (
    text: string,
    { size = BODY_SIZE, style = "normal", indent = 0, leading = BODY_LEADING } = {}
  ) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(size);
    const wrapped = doc.splitTextToSize(text, contentWidth - indent);

    for (const line of wrapped) {
      ensureSpace(leading);
      doc.text(line, MARGIN + indent, cursorY);
      cursorY += leading;
    }
  };

  const writeGap = (gap: number) => {
    ensureSpace(gap);
    cursorY += gap;
  };

  const writeSectionHeading = (title: string) => {
    writeGap(14);
    writeWrapped(title.toUpperCase(), { size: 11, style: "bold" });
    writeGap(4);
  };

  const writeBullets = (items: string[]) => {
    doc.setFontSize(BODY_SIZE);

    for (const item of items) {
      const bulletIndent = 14;
      doc.setFont("helvetica", "bold");
      const wrapped = doc.splitTextToSize(item, contentWidth - bulletIndent);

      ensureSpace(BODY_LEADING);
      doc.setFontSize(BODY_SIZE);
      doc.text("•", MARGIN, cursorY);
      doc.setFont("helvetica", "normal");
      for (let i = 0; i < wrapped.length; i += 1) {
        if (i > 0) {
          ensureSpace(BODY_LEADING);
        }
        doc.text(wrapped[i], MARGIN + bulletIndent, cursorY);
        cursorY += BODY_LEADING;
      }
    }
  };

  // Title block
  writeWrapped(summary.title, { size: 18, style: "bold", leading: 24 });

  // Meta block
  const metaEntries = [`Document Type: ${summary.documentType}`];

  if (meta.fileName) {
    metaEntries.push(`Source File: ${meta.fileName}`);
  }

  if (meta.length) {
    const label =
      meta.length.charAt(0).toUpperCase() + meta.length.slice(1);
    metaEntries.push(`Summary Length: ${label}`);
  }

  metaEntries.push(
    `Generated: ${formatExportDate(meta.generatedAt ?? new Date().toISOString())}`
  );

  writeGap(6);
  doc.setTextColor(110, 110, 110);
  writeWrapped(metaEntries.join("   ·   "), { size: 9, leading: 13 });
  doc.setTextColor(0, 0, 0);

  // Divider
  writeGap(8);
  ensureSpace(1);
  doc.setDrawColor(200, 200, 200);
  doc.line(MARGIN, cursorY, pageWidth - MARGIN, cursorY);
  cursorY += 1;

  // Summary body
  writeSectionHeading("Summary");
  writeWrapped(summary.summary);

  const sections = [
    { title: "Key Points", items: summary.keyPoints },
    { title: "Main Ideas", items: summary.mainIdeas },
    { title: "Action Items", items: summary.actionItems },
    { title: "Improvement Suggestions", items: summary.improvementSuggestions },
  ].filter((section) => section.items.length > 0);

  for (const section of sections) {
    writeSectionHeading(section.title);
    writeBullets(section.items);
  }

  if (summary.entities.length > 0) {
    writeSectionHeading("Mentioned");
    writeWrapped(summary.entities.join(", "));
  }

  return doc;
}

export function exportSummaryPdf(summary: Summary, meta: ExportMeta = {}): void {
  const doc = buildSummaryPdf(summary, meta);
  doc.save(`${slugifyFileName(summary.title)}.pdf`);
}
