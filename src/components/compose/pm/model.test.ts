import { describe, it, expect } from "vitest";
import { schema, textToDoc, textToSlice, docToText, offsetToPM, pmToOffset } from "./model";

describe("ProseMirror plain-text model", () => {
  it("round-trips text → doc → text", () => {
    for (const t of ["hello world", "line one\nline two", "a\n\nb", "", "single"]) {
      expect(docToText(textToDoc(t))).toBe(t);
    }
  });

  it("offset↔PM round-trips for every offset (single line)", () => {
    const text = "check https://x.com now";
    const doc = textToDoc(text);
    for (let o = 0; o <= text.length; o++) {
      expect(pmToOffset(doc, offsetToPM(doc, o))).toBe(o);
    }
  });

  it("offset↔PM round-trips across paragraph boundaries", () => {
    const text = "first line\nsecond line\nthird";
    const doc = textToDoc(text);
    for (let o = 0; o <= text.length; o++) {
      expect(pmToOffset(doc, offsetToPM(doc, o))).toBe(o);
    }
  });

  it("maps a substring range to PM positions that select that substring", () => {
    const text = "the quick brown fox";
    const doc = textToDoc(text);
    const start = text.indexOf("brown");
    const end = start + "brown".length;
    const from = offsetToPM(doc, start);
    const to = offsetToPM(doc, end);
    expect(doc.textBetween(from, to)).toBe("brown");
  });

  it("maps a range that spans a newline", () => {
    const text = "alpha\nbeta";
    const doc = textToDoc(text);
    // "beta" lives on the second line
    const start = text.indexOf("beta");
    const from = offsetToPM(doc, start);
    const to = offsetToPM(doc, start + 4);
    expect(doc.textBetween(from, to)).toBe("beta");
  });

  // #4: pasting multi-line text must keep its line breaks (newlines → paragraph
  // breaks), not collapse them. textToSlice is the editor's clipboardTextParser.
  it("paste slice preserves newlines as paragraph breaks (#4)", () => {
    for (const t of ["one\ntwo\nthree", "a\n\nb", "single line", "trailing\n"]) {
      const slice = textToSlice(t);
      const doc = schema.nodes.doc.create(null, slice.content);
      expect(docToText(doc)).toBe(t);
    }
  });

  it("normalizes CRLF / CR line endings on paste", () => {
    const slice = textToSlice("a\r\nb\rc");
    const doc = schema.nodes.doc.create(null, slice.content);
    expect(docToText(doc)).toBe("a\nb\nc");
  });
});
