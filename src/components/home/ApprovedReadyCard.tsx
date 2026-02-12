"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/utils/formatting";
import { CheckCircle, Copy, Check, ExternalLink } from "lucide-react";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
  status: "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

interface ApprovedReadyCardProps {
  drafts: Draft[];
  onMarkPosted?: (draftId: string) => void;
}

function getContent(draft: Draft): string {
  const content = draft.edited_content || draft.content;
  if ("text" in content) return content.text as string;
  if ("tweets" in content) return (content.tweets as string[]).join("\n\n---\n\n");
  return "";
}

function getPreview(draft: Draft): string {
  const content = draft.edited_content || draft.content;
  if ("text" in content) return content.text as string;
  if ("tweets" in content) return (content.tweets as string[])[0];
  return "";
}

export function ApprovedReadyCard({ drafts, onMarkPosted }: ApprovedReadyCardProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const approvedDrafts = drafts.filter((d) => d.status === "DRAFT");

  const handleCopy = async (draft: Draft) => {
    const text = getContent(draft);
    await navigator.clipboard.writeText(text);
    setCopiedId(draft.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (approvedDrafts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                No approved posts
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Review and approve drafts to queue them
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Approved & Ready
            </h3>
            <Badge variant="success" size="sm">
              {approvedDrafts.length}
            </Badge>
          </div>
        </div>

        <div className="space-y-2">
          {approvedDrafts.slice(0, 2).map((draft) => (
            <div
              key={draft.id}
              className="p-3 bg-[var(--color-bg-elevated)] rounded-lg"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="success" size="sm">
                  {draft.type === "X_POST" ? "Post" : "Thread"}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Approved {formatRelativeTime(draft.updated_at || draft.created_at)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-3">
                {getPreview(draft)}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={
                    copiedId === draft.id ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )
                  }
                  onClick={() => handleCopy(draft)}
                  className="flex-1"
                >
                  {copiedId === draft.id ? "Copied!" : "Copy"}
                </Button>
                {onMarkPosted && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onMarkPosted(draft.id)}
                    className="text-xs"
                  >
                    Mark Posted
                  </Button>
                )}
                <Link href={`/drafts/${draft.id}`}>
                  <Button variant="ghost" size="sm" icon={<ExternalLink className="w-3.5 h-3.5" />}>
                    Edit
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
