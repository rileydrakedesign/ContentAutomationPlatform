/**
 * ProseMirror decorations plugin — renders the assistant's underlines as real
 * inline decorations (no overlay/alignment hack). Color = finding class, style =
 * severity (dotted/wavy/double), carried as inline style on the decoration span.
 */
import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";
import type { Node as PMNode } from "prosemirror-model";
import { offsetToPM } from "./model";
import { CLASS_STYLE, SEVERITY_DECORATION } from "@/lib/analysis/assistant";
import type { Finding } from "@/lib/analysis/assistant";

export const decoKey = new PluginKey<DecorationSet>("afxDeco");

export function buildDecorations(doc: PMNode, findings: Finding[]): DecorationSet {
  const decos: Decoration[] = [];
  for (const f of findings) {
    if (!f.span) continue;
    const from = offsetToPM(doc, f.span.start);
    const to = offsetToPM(doc, f.span.end);
    if (to <= from) continue;
    const style = CLASS_STYLE[f.class];
    decos.push(
      Decoration.inline(from, to, {
        "data-fid": f.id,
        style: `text-decoration-line:underline;text-decoration-style:${SEVERITY_DECORATION[f.severity]};text-decoration-color:${style.color};text-decoration-thickness:2px;text-underline-offset:2px;`,
      })
    );
  }
  return DecorationSet.create(doc, decos);
}

/** Plugin holding the current DecorationSet; updated via a setMeta(decoKey, set). */
export function decorationsPlugin() {
  return new Plugin<DecorationSet>({
    key: decoKey,
    state: {
      init: () => DecorationSet.empty,
      apply(tr, old) {
        const meta = tr.getMeta(decoKey) as DecorationSet | undefined;
        if (meta) return meta;
        return old.map(tr.mapping, tr.doc);
      },
    },
    props: {
      decorations(state) {
        return decoKey.getState(state);
      },
    },
  });
}
