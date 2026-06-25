/**
 * ProseMirror document model for the writing assistant's plain-text editor.
 *
 * Tweets are plain text (no rich formatting), so the schema is deliberately
 * minimal — doc > paragraph+ > text — with newlines modeled as paragraph breaks.
 * The whole point of moving off the textarea overlay is that ProseMirror gives
 * us real, robust inline decorations (no pixel-alignment hack); these helpers
 * convert between the plain-text string our findings use and ProseMirror's
 * position space, which is what makes the underlines land exactly.
 *
 * Pure (no DOM) and unit-tested.
 */
import { Schema, Slice, type Node as PMNode } from "prosemirror-model";

export const schema = new Schema({
  nodes: {
    doc: { content: "paragraph+" },
    paragraph: {
      content: "text*",
      group: "block",
      parseDOM: [{ tag: "p" }],
      toDOM: () => ["p", 0],
    },
    text: {},
  },
  marks: {},
});

/** Build a doc from plain text — one paragraph per line (newline = paragraph). */
export function textToDoc(text: string): PMNode {
  const lines = text.split("\n");
  const paragraphs = lines.map((line) =>
    schema.nodes.paragraph.create(null, line.length ? schema.text(line) : null)
  );
  return schema.nodes.doc.create(null, paragraphs);
}

/**
 * Build a paste Slice from plain text so pasted multi-line drafts survive (#4).
 * Newlines become paragraph breaks — exactly the model textToDoc/docToText use —
 * so a paste round-trips through the same plain-text serialization. Both ends are
 * opened one level so the first/last pasted lines merge into the paragraph at the
 * cursor instead of forcing hard block boundaries. Used as the editor's
 * clipboardTextParser; without it ProseMirror's default collapses single newlines.
 */
export function textToSlice(text: string): Slice {
  // Normalize CRLF / CR so Windows / old-Mac line endings don't leave stray \r.
  const normalized = text.replace(/\r\n?/g, "\n");
  const doc = textToDoc(normalized);
  return new Slice(doc.content, 1, 1);
}

/** Serialize a doc back to plain text (paragraphs joined by newlines). */
export function docToText(doc: PMNode): string {
  const parts: string[] = [];
  doc.forEach((block) => parts.push(block.textContent));
  return parts.join("\n");
}

/**
 * Map a plain-text offset to a ProseMirror position. Accounts for the +2 PM
 * positions consumed at each paragraph boundary vs the 1 "\n" string char.
 */
export function offsetToPM(doc: PMNode, offset: number): number {
  let strPos = 0;
  let result = -1;
  doc.forEach((block, blockOffset, index) => {
    if (result !== -1) return;
    if (index > 0) {
      if (offset === strPos) {
        result = blockOffset + 1; // boundary → start of this paragraph's content
        return;
      }
      strPos += 1; // the newline char
    }
    const innerStart = blockOffset + 1;
    const len = block.content.size; // text length in this paragraph
    if (offset <= strPos + len) {
      result = innerStart + (offset - strPos);
      return;
    }
    strPos += len;
  });
  return result === -1 ? doc.content.size : result;
}

/** Inverse: a ProseMirror position → plain-text offset (for hover hit-testing). */
export function pmToOffset(doc: PMNode, pos: number): number {
  let strPos = 0;
  let result = -1;
  doc.forEach((block, blockOffset, index) => {
    if (result !== -1) return;
    if (index > 0) strPos += 1; // newline
    const innerStart = blockOffset + 1;
    const len = block.content.size;
    if (pos <= innerStart + len) {
      result = strPos + Math.max(0, pos - innerStart);
      return;
    }
    strPos += len;
  });
  return result === -1 ? strPos : result;
}
