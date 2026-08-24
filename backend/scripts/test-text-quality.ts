import { analyzeTextQuality } from "../lib/extraction/text-quality";

const samples = [
  {
    name: "Normal English",
    text: `
      The server understood the request and refused to authorize
      access to the requested resource.
    `,
  },
  {
    name: "Empty",
    text: "",
  },
  {
    name: "Short",
    text: "hello",
  },
  {
    name: "OCR corruption",
    text: `
      A ry rad is sage or group of oder.
      The amy hi commtil cryes
      Amity are eo skies we overs when lie 10 10 SL
    `,
  },
  {
    name: "Technical text",
    text: `
      SELECT DISTINCT column
      FROM mytable
      JOIN another_table
      ON mytable.column = another_table.column
      WHERE constraint_expression
      GROUP BY column
      ORDER BY column ASC;
    `,
  },
  {
    name: "Programming text",
    text: `
      class Animal {
        void sound() {
          System.out.println("Animal makes a sound");
        }
      }
    `,
  },
];

for (const sample of samples) {
  const result = analyzeTextQuality(sample.text);

  console.log("\n==============================");
  console.log(sample.name);
  console.log("==============================");
  console.log("Score:", result.qualityScore.toFixed(3));
  console.log("Characters:", result.characterCount);
  console.log("Words:", result.wordCount);
  console.log("Alphanumeric:", result.alphanumericRatio.toFixed(3));
  console.log("Printable:", result.printableRatio.toFixed(3));
  console.log(
    "Suspicious:",
    result.suspiciousCharacterRatio.toFixed(3),
  );
  console.log(
    "Average word length:",
    result.averageWordLength.toFixed(2),
  );
  console.log(
    "Word-like:",
    result.wordLikeRatio.toFixed(3),
  );
  console.log("Is suspicious:", result.isSuspicious);
  console.log("Reasons:", result.reasons);
}
