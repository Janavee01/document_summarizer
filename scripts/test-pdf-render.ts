import fs from "node:fs";
import path from "node:path";

import { renderPdfPage } from "../lib/extraction/pdf";

async function main() {
  const pdfPath = process.argv[2];
  const pageNumber = Number(process.argv[3] ?? "1");

  if (!pdfPath) {
    console.error(
      "Usage: npx tsx scripts/test-pdf-render.ts <pdf-path> <page-number>",
    );
    process.exit(1);
  }

  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    console.error("Page number must be a positive integer.");
    process.exit(1);
  }

  const absolutePdfPath = path.resolve(pdfPath);

  if (!fs.existsSync(absolutePdfPath)) {
    console.error(`PDF not found: ${absolutePdfPath}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(absolutePdfPath);

  console.log(`Rendering page ${pageNumber}...`);

  const imageBuffer = await renderPdfPage(pdfBuffer, pageNumber);

  const outputPath = path.resolve(
    `scripts/rendered-page-${pageNumber}.png`,
  );

  fs.writeFileSync(outputPath, imageBuffer);

  console.log(`Rendered image written to: ${outputPath}`);
  console.log(`Image size: ${imageBuffer.length} bytes`);
}

main().catch((error) => {
  console.error("PDF rendering failed:", error);
  process.exit(1);
});
