import fs from "node:fs";
import path from "node:path";

import { extractPdfText, renderPdfPage } from "../lib/extraction/pdf";

async function main() {
  const pdfPath = process.argv[2];

  if (!pdfPath) {
    console.error(
      "Usage: npx tsx scripts/test-pdf-render.ts <pdf-path>",
    );
    process.exit(1);
  }

  const absolutePdfPath = path.resolve(pdfPath);

  if (!fs.existsSync(absolutePdfPath)) {
    console.error(`PDF not found: ${absolutePdfPath}`);
    process.exit(1);
  }

  const pdfBuffer = fs.readFileSync(absolutePdfPath);

  console.log("Reading PDF...");

  const pdfResult = await extractPdfText(pdfBuffer);

  console.log(`PDF contains ${pdfResult.pageCount} page(s).`);

  const outputDirectory = path.resolve("scripts/rendered-pages");

  fs.mkdirSync(outputDirectory, { recursive: true });

  for (let pageNumber = 1; pageNumber <= pdfResult.pageCount; pageNumber++) {
    console.log(`Rendering page ${pageNumber}/${pdfResult.pageCount}...`);

    const imageBuffer = await renderPdfPage(
      pdfBuffer,
      pageNumber,
    );

    const outputPath = path.join(
      outputDirectory,
      `page-${pageNumber}.png`,
    );

    fs.writeFileSync(outputPath, imageBuffer);

    console.log(
      `Saved page ${pageNumber}: ${outputPath} (${imageBuffer.length} bytes)`,
    );
  }

  console.log("\nAll PDF pages rendered successfully.");
}

main().catch((error) => {
  console.error("PDF rendering failed:", error);
  process.exit(1);
});