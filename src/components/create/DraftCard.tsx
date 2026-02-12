"use client";

import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { StatusBadge, TypeBadge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils/formatting";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD" | "REEL_SCRIPT";
  status: "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

interface DraftCardProps {
  draft: Draft;
  onDelete?: (id: string) => void;
}

export function DraftCard({ draft, onDelete }: DraftCardProps) {
  function getPreview() {
    const content = draft.edited_content || draft.content;
    if ("text" in content) return content.text as string;
    if ("tweets" in content) return (content.tweets as string[])[0];
    if ("hook" in content) return content.hook as string;
    return JSON.stringify(content);
  }

  return (
    <Card className="p-4" hover>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <TypeBadge type={draft.type} />
          <StatusBadge status={draft.status} />
        </div>
        <span className="text-xs text-slate-500">
          {formatRelativeTime(draft.created_at)}
        </span>
      </div>

      <Link href={`/drafts/${draft.id}`}>
        <p className="text-sm text-slate-300 line-clamp-3 mb-3 hover:text-white transition">
          {getPreview()}
        </p>
      </Link>

      <div className="flex items-center gap-3">
        <Link
          href={`/drafts/${draft.id}`}
          className="text-sm text-amber-400 hover:text-amber-300 transition"
        >
          Edit
        </Link>

        {onDelete && (
          <button
            onClick={() => onDelete(draft.id)}
            className="text-sm text-slate-500 hover:text-red-400 transition"
          >
            Delete
          </button>
        )}
      </div>
    </Card>
  );
}
