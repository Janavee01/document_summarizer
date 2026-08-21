# Document Summarizer — V3 Text Quality Analysis

## 1. Purpose

This document records the text-quality analysis work added after the V3 hybrid extraction implementation.

* Text-quality analysis
* Quality metrics
* Technical-text handling
* Quality-analysis testing
* Current limitations
* Remaining refinement work

---

## 2. Text Quality Analysis

A new text-quality analysis module was introduced at:

```text
lib/extraction/text-quality.ts
```

Its purpose is to evaluate extracted text and identify potentially unusable or suspicious output.

The analyzer is intended to provide signals for extraction decisions, rather than determine whether text is semantically correct.

### Metrics

The analyzer currently considers:

* Character count
* Word count
* Alphanumeric ratio
* Printable character ratio
* Suspicious character ratio
* Average word length
* Word-like token ratio
* Single-character token ratio
* Technical structure ratio
* Suspicious word ratio
* Long-token ratio
* Repeated-token ratio
* Vowel ratio
* Alphabetic word ratio

These signals are combined to produce a quality score and a suspicious/not-suspicious result.

---

## 3. Technical Text Handling

A major consideration during implementation was avoiding false positives on technical documents.

Programming languages, SQL, and other structured technical content naturally contain:

* Braces
* Parentheses
* Semicolons
* Operators
* Short tokens
* Identifiers
* Keywords

For example:

```text
class Animal {
    void sound() {
        System.out.println("Animal makes a sound");
    }
}
```

A simple character-based quality check could incorrectly classify this as poor-quality text.

To address this, the analyzer includes:

```text
technicalStructureRatio
```

Technical structure is therefore treated as supporting evidence of valid text rather than automatically being considered corruption.

---

## 4. Text Quality Test Suite

A dedicated test script was added:

```text
scripts/test-text-quality.ts
```

It can be executed using:

```bash
npx tsx scripts/test-text-quality.ts
```

The test suite covers:

* Normal English text
* Empty text
* Short text
* OCR-like corrupted text
* SQL/technical text
* Programming text

The tests confirmed that technical and programming content are not automatically classified as suspicious.

---

## 5. Observed Results

Representative results from the current analyzer:

| Test Case           | Score | Suspicious |
| ------------------- | ----: | ---------- |
| Normal English      | 0.700 | No         |
| Empty text          | 0.000 | Yes        |
| Short text          | 0.590 | No         |
| OCR-like corruption | 0.700 | No         |
| Technical text      | 0.763 | No         |
| Programming text    | 0.742 | No         |

The results demonstrate that the analyzer can identify clearly empty input while remaining tolerant of technical text.

---

## 6. Design Decisions

### Quality Analysis Is a Signal

Text-quality analysis should help guide extraction decisions but should not be treated as proof that text is correct or corrupted.

### Empty Text Is a Separate State

An empty native extraction result should be handled as:

```text
No native text available
```

rather than automatically being classified as corrupted text.

### Technical Text Must Be Supported

Programming, SQL, and structured technical documents should not be rejected simply because they contain unusual symbols or short tokens.

