import fs from "node:fs";
import path from "node:path";

import { extractDocumentText } from "../lib/extraction";

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error(
      "Usage: npx tsx scripts/test-hybrid-extraction.ts <pdf-path>",
    );
    process.exit(1);
  }

  const absolutePdfPath = path.resolve(pdfPath);

  if (!fs.existsSync(absolutePdfPath)) {
    console.error(`PDF not found: ${absolutePdfPath}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(absolutePdfPath);

  console.log("Starting hybrid extraction...");
  console.log(`File: ${absolutePdfPath}`);
  console.log();

  const result = await extractDocumentText(
    pdfBuffer,
    "pdf",
  );

  console.log("===== EXTRACTION SUMMARY =====");
  console.log(`Method: ${result.method}`);
  console.log(`Pages: ${result.pageCount}`);
  console.log(`Words: ${result.wordCount}`);
  console.log(`Characters: ${result.characterCount}`);
  console.log();

  console.log("===== PAGE METHODS =====");

  for (const page of result.pages ?? []) {
    console.log(
      `Page ${page.pageNumber}: ${page.method} (${page.text.length} characters)`,
    );
  }

  console.log();

  console.log("===== EXTRACTED TEXT =====");
  console.log(result.text);
  console.log("============================");
}

main().catch((error) => {
  console.error("Hybrid extraction failed:", error);
  process.exit(1);
});
