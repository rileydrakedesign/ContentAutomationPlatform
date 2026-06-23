"use client";

import { useState, useEffect, use } from "react";
import { DraftEditor, type DraftType, type DraftStatus } from "@/components/drafts/DraftEditor";

type Draft = {
  id: string;
  type: DraftType;
  status: DraftStatus;
  content: Record<string, unknown>;
  source_ids: string[] | null;
  edited_content: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export default function DraftEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDraft() {
      try {
        const res = await fetch(`/api/drafts/${id}`);
        if (res.ok) {
          setDraft(await res.json());
        }
      } finally {
        setLoading(false);
      }
    }
    fetchDraft();
  }, [id]);

  if (loading) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Loading draft...</div>;
  }

  if (!draft) {
    return <div className="text-center py-12 text-[var(--color-text-secondary)]">Draft not found</div>;
  }

  return (
    <DraftEditor
      draftId={draft.id}
      type={draft.type}
      initialContent={draft.edited_content || draft.content}
      status={draft.status}
      createdAt={draft.created_at}
    />
  );
}
