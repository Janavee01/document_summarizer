import { describe, expect, it } from "vitest";

import { extractJson, toStringArray } from "./json-utils";

describe("extractJson", () => {
  it("parses a plain JSON object directly", () => {
    expect(extractJson('{"a": 1}')).toEqual({ a: 1 });
  });

  it("parses a JSON object wrapped in markdown code fences", () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('```\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("strips closed <think> blocks around the payload", () => {
    const raw = '<think>let me reason about this {"fake": true}</think>{"a": 1}';

    expect(extractJson(raw)).toEqual({ a: 1 });
  });

  it("unclosed think block: scan returns the first balanced object", () => {
    // Deliberate tradeoff of the extractor (see json-utils.ts header): an
    // unclosed think block is not stripped, so braces inside reasoning can
    // win the first-balanced-object scan.
    const raw = '<think>reasoning that never ends {"distractor": [1,2]} ... {"a": 1}';

    expect(extractJson(raw)).toEqual({ distractor: [1, 2] });
  });

  it("extracts the first balanced object embedded in surrounding prose", () => {
    const raw = 'Sure! Here is your summary:\n{"title": "Doc"}\nHope this helps!';

    expect(extractJson(raw)).toEqual({ title: "Doc" });
  });

  it("skips unparseable candidates and keeps scanning", () => {
    // The first {...} contains raw newlines inside a string literal — invalid
    // JSON — so the scan should move on to the next balanced candidate.
    const raw = '{"bad": "line\nbreak"} then {"good": true}';

    expect(extractJson(raw)).toEqual({ good: true });
  });

  it("handles nested objects and braces inside strings", () => {
    const raw = '{"outer": {"inner": "has } brace"}, "ok": false}';

    expect(extractJson(raw)).toEqual({
      outer: { inner: "has } brace" },
      ok: false,
    });
  });

  it("handles escaped quotes inside strings during balance detection", () => {
    const raw = '{"quote": "ends with \\" } still string"}';

    expect(extractJson(raw)).toEqual({
      quote: 'ends with " } still string',
    });
  });

  it("throws when there is no JSON object anywhere", () => {
    expect(() => extractJson("no json here")).toThrow();
    expect(() => extractJson("")).toThrow();
  });

  it("throws when an opening brace is never closed", () => {
    expect(() => extractJson('{"truncated": ')).toThrow();
  });
});

describe("toStringArray", () => {
  it("returns arrays of non-empty strings unchanged", () => {
    expect(toStringArray(["a", "b"])).toEqual(["a", "b"]);
  });

  it("drops empty and whitespace-only entries", () => {
    expect(toStringArray(["a", "", "   ", "b"])).toEqual(["a", "b"]);
  });

  it("drops non-string entries", () => {
    expect(toStringArray(["a", 1, null, { x: 1 }, true])).toEqual(["a"]);
  });

  it("returns an empty array for non-array input", () => {
    expect(toStringArray(undefined)).toEqual([]);
    expect(toStringArray(null)).toEqual([]);
    expect(toStringArray("text")).toEqual([]);
    expect(toStringArray({ 0: "a", length: 1 })).toEqual([]);
  });

  it("returns an empty array for an empty array", () => {
    expect(toStringArray([])).toEqual([]);
  });
});
