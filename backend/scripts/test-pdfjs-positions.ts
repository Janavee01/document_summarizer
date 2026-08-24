import fs from "node:fs";
import path from "node:path";

async function main() {
  const { getDocument } = await import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  );

  const data = new Uint8Array(
    fs.readFileSync(
      path.resolve("scripts/fixtures/spacing-corruption.pdf"),
    ),
  );

  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const page = await doc.getPage(1);
  const content = await page.getTextContent();

  for (const item of content.items) {
    if (!("str" in item)) continue;

    console.log(
      JSON.stringify({
        str: item.str,
        x: Math.round(item.transform[4]),
        y: Math.round(item.transform[5]),
        w: Math.round(item.width * 10) / 10,
        h: Math.round(item.height * 10) / 10,
      }),
    );
  }

  await doc.destroy();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
