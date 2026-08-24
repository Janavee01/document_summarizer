/**
 * Generates deterministic test PDFs used by the extraction tests.
 *
 * These are hand-built PDFs so that glyph positions are fully under
 * our control. This lets us reproduce the exact corruption patterns
 * observed in real-world documents:
 *
 * - word-spacing corruption ("T ra n sf e r")
 * - multi-column layouts (table of contents)
 * - headings / lists / legal numbering
 * - pages without any extractable text (scanned-document case)
 */

import fs from "node:fs";
import path from "node:path";

type TextOp =
  | { op: "font"; size: number }
  | { op: "at"; x: number; y: number }
  | { op: "text"; value: string };

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;

function buildContentStream(ops: TextOp[]): string {
  const parts: string[] = ["BT"];

  for (const step of ops) {
    if (step.op === "font") {
      parts.push(`/F1 ${step.size} Tf`);
    } else if (step.op === "at") {
      parts.push(`1 0 0 1 ${step.x} ${step.y} Tm`);
    } else {
      const escaped = step.value
        .replace(/\\/g, "\\\\")
        .replace(/\(/g, "\\(")
        .replace(/\)/g, "\\)");

      parts.push(`(${escaped}) Tj`);
    }
  }

  parts.push("ET");

  return parts.join("\n");
}

function buildPdf(pageContents: string[]): Buffer {
  const objects: string[] = [];
  const pageCount = pageContents.length;
  const kids = Array.from(
    { length: pageCount },
    (_, index) => `${4 + index * 2} 0 R`,
  ).join(" ");

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push(
    `<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`,
  );
  objects.push(
    "<< /Font << /F1 1000000 0 R >> >>",
  );

  pageContents.forEach((content, index) => {
    const pageObjectNumber = 4 + index * 2;
    const contentObjectNumber = pageObjectNumber + 1;

    objects.push(
      `<< /Type /Page /Parent 2 0 R /Resources 3 0 R ` +
        `/MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
        `/Contents ${contentObjectNumber} 0 R >>`,
    );

    objects.push(
      `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    );
  });

  /*
   * Object 1000000 is not valid in a well-formed PDF reference table.
   * Use the next free object id for the font instead.
   */
  const fontObjectNumber = 4 + pageCount * 2;

  objects[2] = "<< /Font << /F1 FONT_REF 0 R >> >>".replace(
    "FONT_REF",
    String(fontObjectNumber),
  );

  objects.push(
    "<< /Type /Font /Subtype /Type1 /BaseFont /Times-Roman >>",
  );

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));

    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  const objectCount = objects.length + 1;

  pdf += `xref\n0 ${objectCount}\n`;
  pdf += "0000000000 65535 f \n";

  for (const offset of offsets) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  return Buffer.from(pdf, "binary");
}

/*
 * ---------------------------------------------------------------------------
 * Fixture 1: Word-spacing corruption
 * ---------------------------------------------------------------------------
 */
function buildSpacingCorruptionPdf(): Buffer {
  const ops: TextOp[] = [];

  ops.push({ op: "font", size: 12 });
  ops.push({ op: "at", x: 72, y: 700 });
  ops.push({ op: "text", value: "CHAPTER II" });

  ops.push({ op: "at", x: 72, y: 680 });
  ops.push({
    op: "text",
    value: "OF TRANSFERS OF PROPERTY BY ACT OF PARTIES",
  });

  ops.push({ op: "at", x: 72, y: 650 });
  ops.push({ op: "text", value: "instr" });
  ops.push({ op: "at", x: 96, y: 650 });
  ops.push({ op: "text", value: "ument" });

  ops.push({ op: "at", x: 72, y: 630 });
  ops.push({ op: "text", value: "Assa" });
  ops.push({ op: "at", x: 98, y: 630 });
  ops.push({ op: "text", value: "m is a State." });

  ops.push({ op: "at", x: 72, y: 610 });
  ops.push({ op: "text", value: "T" });
  ops.push({ op: "at", x: 78, y: 610 });
  ops.push({ op: "text", value: "ra" });
  ops.push({ op: "at", x: 86, y: 610 });
  ops.push({ op: "text", value: "n" });
  ops.push({ op: "at", x: 92, y: 610 });
  ops.push({ op: "text", value: "sf" });
  ops.push({ op: "at", x: 99, y: 610 });
  ops.push({ op: "text", value: "e" });
  ops.push({ op: "at", x: 105, y: 610 });
  ops.push({ op: "text", value: "r of property is possible." });

  ops.push({ op: "at", x: 72, y: 590 });
  ops.push({ op: "text", value: "w" });
  ops.push({ op: "at", x: 79, y: 590 });
  ops.push({ op: "text", value: "he" });
  ops.push({ op: "at", x: 88, y: 590 });
  ops.push({ op: "text", value: "t" });
  ops.push({ op: "at", x: 93, y: 590 });
  ops.push({ op: "text", value: "he" });
  ops.push({ op: "at", x: 102, y: 590 });
  ops.push({ op: "text", value: "r it is valid depends on law." });

  return buildPdf([buildContentStream(ops)]);
}

/*
 * ---------------------------------------------------------------------------
 * Fixture 2: Multi-column table-of-contents layout
 * ---------------------------------------------------------------------------
 */
function buildColumnsPdf(): Buffer {
  const ops: TextOp[] = [];

  ops.push({ op: "font", size: 14 });
  ops.push({ op: "at", x: 200, y: 720 });
  ops.push({ op: "text", value: "ARRANGEMENT OF SECTIONS" });

  ops.push({ op: "font", size: 11 });

  interface Row {
    y: number;
    section: string;
    title: string;
    page: string;
  }

  const rows: Row[] = [
    { y: 680, section: "1.", title: "Short title", page: "2" },
    { y: 660, section: "2.", title: "Saving of certain enactments", page: "3" },
    { y: 640, section: "3.", title: "Interpretation clause", page: "4" },
    { y: 620, section: "4.", title: "May be partly oral", page: "5" },
    { y: 600, section: "5.", title: "Transfer of property defined", page: "6" },
    { y: 580, section: "114A.", title: "Omnibus confirmation", page: "44" },
    { y: 560, section: "130A.", title: "Assignment of policy", page: "47" },
  ];

  for (const row of rows) {
    ops.push({ op: "at", x: 72, y: row.y });
    ops.push({ op: "text", value: row.section });

    ops.push({ op: "at", x: 180, y: row.y });
    ops.push({ op: "text", value: row.title });

    ops.push({ op: "at", x: 500, y: row.y });
    ops.push({ op: "text", value: row.page });
  }

  return buildPdf([buildContentStream(ops)]);
}

/*
 * ---------------------------------------------------------------------------
 * Fixture 3: Headings, hierarchy and legal list numbering
 * ---------------------------------------------------------------------------
 */
function buildStructurePdf(): Buffer {
  const paragraph1 =
    "Whereas it is expedient to define and amend certain parts of the law relating to the transfer of property by act of parties, it is hereby enacted as follows.";
  const paragraph2 =
    "A transfer of property passes forthwith to the transferee all the interest which the transferor is capable of passing in the property, unless a different intention is expressed.";

  const lines = wrap(paragraph1, 58);
  const lines2 = wrap(paragraph2, 58);

  const ops: TextOp[] = [];

  ops.push({ op: "font", size: 13 });
  ops.push({ op: "at", x: 150, y: 720 });
  ops.push({ op: "text", value: "THE TRANSFER OF PROPERTY ACT, 1882" });

  ops.push({ op: "at", x: 240, y: 690 });
  ops.push({ op: "text", value: "CHAPTER I" });

  ops.push({ op: "font", size: 12 });
  ops.push({ op: "at", x: 190, y: 668 });
  ops.push({ op: "text", value: "PRELIMINARY" });

  let y = 640;

  ops.push({ op: "font", size: 12 });

  for (const line of lines) {
    ops.push({ op: "at", x: 72, y });
    ops.push({ op: "text", value: line });

    y -= 16;
  }

  y -= 8;
  ops.push({ op: "at", x: 72, y });
  ops.push({
    op: "text",
    value: "5. \u201CTransfer of property\u201D defined.\u2014",
  });

  y -= 18;

  for (const line of lines2) {
    ops.push({ op: "at", x: 72, y });
    ops.push({ op: "text", value: line });

    y -= 16;
  }

  y -= 10;

  const items = [
    "(a) the transfer may be made orally, or",
    "(b) the transfer may be made in writing, or",
    "(c) both modes may be combined.",
  ];

  for (const item of items) {
    ops.push({ op: "at", x: 90, y });
    ops.push({ op: "text", value: item });

    y -= 16;
  }

  y -= 10;
  ops.push({ op: "at", x: 72, y });
  ops.push({
    op: "text",
    value:
      "Section 114A and Section 130A were inserted by later amendment acts.",
  });

  return buildPdf([buildContentStream(ops)]);
}

function wrap(text: string, width: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (
      current &&
      current.length + 1 + word.length > width
    ) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines;
}

const outputDir = path.resolve("scripts/fixtures");

fs.mkdirSync(outputDir, { recursive: true });

fs.writeFileSync(
  path.join(outputDir, "spacing-corruption.pdf"),
  buildSpacingCorruptionPdf(),
);

fs.writeFileSync(
  path.join(outputDir, "columns.pdf"),
  buildColumnsPdf(),
);

fs.writeFileSync(
  path.join(outputDir, "structure.pdf"),
  buildStructurePdf(),
);

console.log("Fixtures written to scripts/fixtures/");
