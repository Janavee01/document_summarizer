export type TextQuality = {
  text: string;

  characterCount: number;
  wordCount: number;

  alphanumericRatio: number;
  printableRatio: number;
  suspiciousCharacterRatio: number;

  averageWordLength: number;
  wordLikeRatio: number;

  singleCharacterTokenRatio: number;
  technicalStructureRatio: number;
  suspiciousWordRatio: number;

  singleCharacterRatio: number;
  longTokenRatio: number;
  repeatedTokenRatio: number;
  vowelRatio: number;
  alphabeticWordRatio: number;

  qualityScore: number;

  isEmpty: boolean;
  isSuspicious: boolean;

  reasons: string[];
};

const MIN_MEANINGFUL_CHARACTERS = 3;
const MIN_MEANINGFUL_WORDS = 1;

const MIN_PRINTABLE_RATIO = 0.85;
const MIN_ALPHANUMERIC_RATIO = 0.20;
const MAX_SUSPICIOUS_CHARACTER_RATIO = 0.05;

const SUSPICIOUS_SCORE_THRESHOLD = 0.55;

const COMMON_WORD_PATTERN =
  /^[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*[.,;:!?)]?$/u;

const ALPHABETIC_WORD_PATTERN =
  /^[\p{L}]+(?:['’-][\p{L}]+)*[.,;:!?)]?$/u;

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function getWords(text: string): string[] {
  const normalized = normalizeText(text);

  if (!normalized) {
    return [];
  }

  return normalized.split(" ").filter(Boolean);
}

function calculateRatio(
  numerator: number,
  denominator: number,
): number {
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function isSuspiciousCharacter(character: string): boolean {
  const codePoint = character.codePointAt(0);

  if (codePoint === undefined) {
    return false;
  }

  if (character === "\uFFFD") {
    return true;
  }

  const isControlCharacter =
    codePoint < 32 &&
    character !== "\n" &&
    character !== "\r" &&
    character !== "\t";

  return isControlCharacter;
}

function calculateAverageWordLength(
  words: string[],
): number {
  if (words.length === 0) {
    return 0;
  }

  const totalLength = words.reduce(
    (total, word) => total + word.length,
    0,
  );

  return totalLength / words.length;
}

function calculateWordLikeRatio(
  words: string[],
): number {
  if (words.length === 0) {
    return 0;
  }

  const wordLikeCount = words.filter((word) =>
    COMMON_WORD_PATTERN.test(word),
  ).length;

  return wordLikeCount / words.length;
}

function calculateTechnicalStructureRatio(
  text: string,
): number {
  if (!text.trim()) {
    return 0;
  }

  const technicalPatterns = [
    /[{}\[\]();]/g,
    /=>/g,
    /::/g,
    /\b(class|interface|function|return|const|let|var|public|private|protected)\b/gi,
    /\b(SELECT|FROM|WHERE|JOIN|GROUP BY|ORDER BY|HAVING|INSERT|UPDATE|DELETE)\b/gi,
    /\.\w+\(/g,
  ];

  let matches = 0;

  for (const pattern of technicalPatterns) {
    matches += text.match(pattern)?.length ?? 0;
  }

  return Math.min(matches / 8, 1);
}

function calculateSingleCharacterTokenRatio(
  words: string[],
): number {
  if (words.length === 0) {
    return 0;
  }

  const singleCharacterTokens = words.filter(
    (word) => word.length === 1,
  ).length;

  return singleCharacterTokens / words.length;
}

function looksLikeSuspiciousWord(
  word: string,
): boolean {
  const letters = word
    .toLowerCase()
    .replace(/[^\p{L}]/gu, "");

  if (letters.length < 4) {
    return false;
  }

  /*
   * Extremely long consonant runs are uncommon in normal
   * natural-language words and can indicate OCR corruption.
   */
  if (/[^aeiou]{5,}/.test(letters)) {
    return true;
  }

  if (/^[^aeiou]{4,}/.test(letters)) {
    return true;
  }

  return false;
}

function calculateSuspiciousWordRatio(
  words: string[],
): number {
  const lexicalWords = words.filter(
    (word) => /^[\p{L}]+$/u.test(word),
  );

  if (lexicalWords.length === 0) {
    return 0;
  }

  const suspiciousWords = lexicalWords.filter(
    looksLikeSuspiciousWord,
  );

  return suspiciousWords.length / lexicalWords.length;
}

function calculateSingleCharacterRatio(
  words: string[],
): number {
  if (words.length === 0) {
    return 0;
  }

  const singleCharacterCount = words.filter(
    (word) => word.length === 1,
  ).length;

  return singleCharacterCount / words.length;
}

function calculateLongTokenRatio(
  words: string[],
): number {
  if (words.length === 0) {
    return 0;
  }

  const longTokenCount = words.filter(
    (word) => word.length > 30,
  ).length;

  return longTokenCount / words.length;
}

function calculateRepeatedTokenRatio(
  words: string[],
): number {
  if (words.length < 2) {
    return 0;
  }

  const frequencies = new Map<string, number>();

  for (const word of words) {
    const normalizedWord = word.toLowerCase();

    frequencies.set(
      normalizedWord,
      (frequencies.get(normalizedWord) ?? 0) + 1,
    );
  }

  let repeatedCount = 0;

  for (const count of frequencies.values()) {
    if (count > 1) {
      repeatedCount += count;
    }
  }

  return repeatedCount / words.length;
}

function calculateVowelRatio(
  text: string,
): number {
  const letters = text.match(/[\p{L}]/gu) ?? [];

  if (letters.length === 0) {
    return 0;
  }

  const vowels = text.match(/[aeiou]/giu) ?? [];

  return vowels.length / letters.length;
}

function calculateAlphabeticWordRatio(
  words: string[],
): number {
  if (words.length === 0) {
    return 0;
  }

  const alphabeticWords = words.filter((word) =>
    ALPHABETIC_WORD_PATTERN.test(word),
  ).length;

  return alphabeticWords / words.length;
}

function calculateQualityScore(metrics: {
  printableRatio: number;
  alphanumericRatio: number;
  suspiciousCharacterRatio: number;
  averageWordLength: number;
  wordLikeRatio: number;
  wordCount: number;
  characterCount: number;

  singleCharacterTokenRatio: number;
  technicalStructureRatio: number;
  suspiciousWordRatio: number;

  longTokenRatio: number;
  repeatedTokenRatio: number;
  vowelRatio: number;
  alphabeticWordRatio: number;
}): number {
  if (metrics.characterCount === 0) {
    return 0;
  }

  let score = 0;

  /*
   * 1. Printable structure
   */
  score +=
    Math.min(metrics.printableRatio, 1) * 0.20;

  /*
   * 2. Alphanumeric content
   */
  score +=
    Math.min(
      metrics.alphanumericRatio / 0.50,
      1,
    ) * 0.15;

  /*
   * 3. Word-like tokens
   */
  score +=
    Math.min(metrics.wordLikeRatio, 1) * 0.10;

  /*
   * 4. Reasonable word lengths
   */
  if (
    metrics.averageWordLength >= 2 &&
    metrics.averageWordLength <= 20
  ) {
    score += 0.10;
  } else if (
    metrics.averageWordLength >= 1 &&
    metrics.averageWordLength <= 30
  ) {
    score += 0.05;
  }

  /*
   * 5. Amount of extracted content
   */
  if (metrics.wordCount >= 10) {
    score += 0.10;
  } else if (metrics.wordCount >= 3) {
    score += 0.07;
  } else if (metrics.wordCount >= 1) {
    score += 0.04;
  }

  if (metrics.characterCount >= 50) {
    score += 0.05;
  } else if (metrics.characterCount >= 10) {
    score += 0.03;
  }

  /*
   * 6. Technical/code structure.
   *
   * This protects programming and SQL documents from being
   * incorrectly marked suspicious because of symbols and
   * short tokens.
   */
  score +=
    metrics.technicalStructureRatio * 0.10;

  /*
   * 7. Single-character tokens.
   *
   * Penalize them only when the text does not look technical.
   */
  if (
    metrics.singleCharacterTokenRatio > 0.35 &&
    metrics.technicalStructureRatio < 0.15
  ) {
    score -= 0.10;
  }

  /*
   * 8. Suspicious lexical patterns.
   */
  score -= Math.min(
    metrics.suspiciousWordRatio * 0.30,
    0.20,
  );

  /*
   * 9. Very long tokens.
   */
  score -= Math.min(
    metrics.longTokenRatio * 0.20,
    0.10,
  );

  /*
   * 10. Excessive repetition.
   */
  if (metrics.repeatedTokenRatio > 0.60) {
    score -= 0.10;
  }

  /*
   * 11. Extremely low vowel content can indicate OCR
   * corruption in otherwise alphabetic text.
   */
  if (
    metrics.vowelRatio < 0.08 &&
    metrics.alphabeticWordRatio > 0.50
  ) {
    score -= 0.10;
  }

  /*
   * 12. Suspicious/control characters.
   */
  score -= Math.min(
    metrics.suspiciousCharacterRatio * 2,
    0.30,
  );

  return Math.max(
    0,
    Math.min(score, 1),
  );
}

export function analyzeTextQuality(
  text: string,
): TextQuality {
  const normalizedText = normalizeText(text);
  const words = getWords(normalizedText);

  const characterCount = normalizedText.length;
  const wordCount = words.length;

  /*
   * Empty extraction must be handled before calculating
   * the remaining metrics.
   */
  if (characterCount === 0) {
    return {
      text: normalizedText,

      characterCount: 0,
      wordCount: 0,

      alphanumericRatio: 0,
      printableRatio: 0,
      suspiciousCharacterRatio: 0,

      averageWordLength: 0,
      wordLikeRatio: 0,

      singleCharacterTokenRatio: 0,
      technicalStructureRatio: 0,
      suspiciousWordRatio: 0,

      singleCharacterRatio: 0,
      longTokenRatio: 0,
      repeatedTokenRatio: 0,
      vowelRatio: 0,
      alphabeticWordRatio: 0,

      qualityScore: 0,

      isEmpty: true,
      isSuspicious: true,

      reasons: [
        "No text was extracted",
      ],
    };
  }

  let alphanumericCount = 0;
  let printableCount = 0;
  let suspiciousCharacterCount = 0;

  for (const character of normalizedText) {
    if (/[\p{L}\p{N}]/u.test(character)) {
      alphanumericCount++;
    }

    if (
      character >= " " &&
      character !== "\u007F"
    ) {
      printableCount++;
    }

    if (isSuspiciousCharacter(character)) {
      suspiciousCharacterCount++;
    }
  }

  const alphanumericRatio = calculateRatio(
    alphanumericCount,
    characterCount,
  );

  const printableRatio = calculateRatio(
    printableCount,
    characterCount,
  );

  const suspiciousCharacterRatio =
    calculateRatio(
      suspiciousCharacterCount,
      characterCount,
    );

  const averageWordLength =
    calculateAverageWordLength(words);

  const wordLikeRatio =
    calculateWordLikeRatio(words);

  const singleCharacterTokenRatio =
    calculateSingleCharacterTokenRatio(words);

  const technicalStructureRatio =
    calculateTechnicalStructureRatio(
      normalizedText,
    );

  const suspiciousWordRatio =
    calculateSuspiciousWordRatio(words);

  const singleCharacterRatio =
    calculateSingleCharacterRatio(words);

  const longTokenRatio =
    calculateLongTokenRatio(words);

  const repeatedTokenRatio =
    calculateRepeatedTokenRatio(words);

  const vowelRatio =
    calculateVowelRatio(normalizedText);

  const alphabeticWordRatio =
    calculateAlphabeticWordRatio(words);

  const qualityScore =
    calculateQualityScore({
      printableRatio,
      alphanumericRatio,
      suspiciousCharacterRatio,
      averageWordLength,
      wordLikeRatio,
      wordCount,
      characterCount,

      singleCharacterTokenRatio,
      technicalStructureRatio,
      suspiciousWordRatio,

      longTokenRatio,
      repeatedTokenRatio,
      vowelRatio,
      alphabeticWordRatio,
    });

  const reasons: string[] = [];

  if (
    characterCount <
    MIN_MEANINGFUL_CHARACTERS
  ) {
    reasons.push(
      "Very little text was extracted",
    );
  }

  if (
    wordCount <
    MIN_MEANINGFUL_WORDS
  ) {
    reasons.push(
      "No meaningful words were detected",
    );
  }

  if (
    printableRatio <
    MIN_PRINTABLE_RATIO
  ) {
    reasons.push(
      "Extracted text contains too many non-printable characters",
    );
  }

  if (
    alphanumericRatio <
    MIN_ALPHANUMERIC_RATIO
  ) {
    reasons.push(
      "Extracted text contains very little alphanumeric content",
    );
  }

  if (
    suspiciousCharacterRatio >
    MAX_SUSPICIOUS_CHARACTER_RATIO
  ) {
    reasons.push(
      "Extracted text contains suspicious characters",
    );
  }

  /*
   * Do not complain about word-like ratio for technical text.
   */
  if (
    wordCount >= 2 &&
    wordLikeRatio < 0.40 &&
    technicalStructureRatio < 0.15
  ) {
    reasons.push(
      "Extracted tokens do not resemble normal readable text",
    );
  }

  /*
   * Single-character tokens are suspicious only when the
   * document does not look technical.
   */
  if (
    singleCharacterTokenRatio > 0.35 &&
    technicalStructureRatio < 0.15
  ) {
    reasons.push(
      "Extracted text contains many single-character tokens",
    );
  }

  if (
    suspiciousWordRatio > 0.25 &&
    technicalStructureRatio < 0.15
  ) {
    reasons.push(
      "Extracted text contains unusually structured words",
    );
  }

  if (
    wordCount >= 3 &&
    averageWordLength < 1.5
  ) {
    reasons.push(
      "Extracted words are unusually short",
    );
  }

  if (
    longTokenRatio > 0.20
  ) {
    reasons.push(
      "Extracted text contains unusually long tokens",
    );
  }

  if (
    repeatedTokenRatio > 0.60
  ) {
    reasons.push(
      "Extracted text contains excessive token repetition",
    );
  }

  if (
    vowelRatio < 0.08 &&
    alphabeticWordRatio > 0.50 &&
    technicalStructureRatio < 0.15
  ) {
    reasons.push(
      "Extracted language has unusually low vowel content",
    );
  }

  if (
    qualityScore <
    SUSPICIOUS_SCORE_THRESHOLD
  ) {
    reasons.push(
      `Text quality score is low (${qualityScore.toFixed(2)})`,
    );
  }

  const isEmpty =
    characterCount <
      MIN_MEANINGFUL_CHARACTERS ||
    wordCount <
      MIN_MEANINGFUL_WORDS;

  const isSuspicious =
    isEmpty ||
    qualityScore <
      SUSPICIOUS_SCORE_THRESHOLD;

  return {
    text: normalizedText,

    characterCount,
    wordCount,

    alphanumericRatio,
    printableRatio,
    suspiciousCharacterRatio,

    averageWordLength,
    wordLikeRatio,

    singleCharacterTokenRatio,
    technicalStructureRatio,
    suspiciousWordRatio,

    singleCharacterRatio,
    longTokenRatio,
    repeatedTokenRatio,
    vowelRatio,
    alphabeticWordRatio,

    qualityScore,

    isEmpty,
    isSuspicious,

    reasons,
  };
}
