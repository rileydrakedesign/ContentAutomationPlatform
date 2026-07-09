"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { DraftEditor, type DraftType } from "@/components/drafts/DraftEditor";
import { readPersistedValue, removePersistedValue } from "@/hooks/usePersistentState";

// The seed the Create page hands off so a generated/composed post can be edited
// and published WITHOUT first being written to the drafts table. It only becomes
// a row if the user clicks "Save Draft".
type DraftSeed = {
  type: DraftType;
  content: Record<string, unknown>;
  topic?: string | null;
  appliedPatterns?: string[];
  metadata?: Record<string, unknown>;
};

export const SEED_KEY = "draft:new:seed";

export default function NewDraftPage() {
  const router = useRouter();
  const [raw, setRaw] = useState<DraftSeed | null>(null);
  const [ready, setReady] = useState(false);

  // Read the one-shot handoff from sessionStorage only after mount so SSR and
  // the first client render agree (both render the loading state). This is an
  // intentional read-once-on-mount of an external store; the set-state-in-effect
  // rule flags it as if it were derivable render state, which it isn't.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRaw(readPersistedValue<DraftSeed | null>(SEED_KEY, null));
    setReady(true);
  }, []);

  const seed = raw && raw.type && raw.content ? raw : null;

  if (!ready) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading…</div>;
  }

  if (!seed) {
    return (
      <div className="text-center py-12 space-y-3">
        <p className="text-[var(--color-text-secondary)]">Nothing to edit here.</p>
        <button
          onClick={() => router.push("/create")}
          className="text-sm text-[var(--color-accent-400)] hover:text-[var(--color-accent-400)]"
        >
          Go to Create
        </button>
      </div>
    );
  }

  return (
    <DraftEditor
      draftId={null}
      type={seed.type}
      initialContent={seed.content}
      topic={seed.topic}
      appliedPatterns={seed.appliedPatterns}
      metadata={seed.metadata}
      onPersisted={() => {
        // Save Draft / publish succeeded — the seed and its edit buffer are done.
        removePersistedValue(SEED_KEY);
        removePersistedValue("draft:new:buf");
      }}
    />
  );
}
