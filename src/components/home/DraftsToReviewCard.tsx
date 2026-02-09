"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/utils/formatting";
import { FileText, ArrowRight } from "lucide-react";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

interface DraftsToReviewCardProps {
  drafts: Draft[];
}

function getPreview(draft: Draft): string {
  const content = draft.edited_content || draft.content;
  if ("text" in content) return content.text as string;
  if ("tweets" in content) return (content.tweets as string[])[0];
  return "";
}

export function DraftsToReviewCard({ drafts }: DraftsToReviewCardProps) {
  // Filter to only GENERATED status (pending review)
  const pendingDrafts = drafts.filter((d) => d.status === "GENERATED");

  if (pendingDrafts.length === 0) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center">
              <FileText className="w-5 h-5 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
                No drafts to review
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Generate drafts from inspiration or topics
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Drafts to Review
            </h3>
            <Badge variant="warning" size="sm">
              {pendingDrafts.length}
            </Badge>
          </div>
          <Link
            href="/create?tab=drafts"
            className="text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
          >
            View All
          </Link>
        </div>

        <div className="flex-1 space-y-2 overflow-y-auto">
          {pendingDrafts.slice(0, 5).map((draft) => (
            <Link
              key={draft.id}
              href={`/drafts/${draft.id}`}
              className="block p-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors group"
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="default" size="sm">
                  {draft.type === "X_POST" ? "Post" : "Thread"}
                </Badge>
                <span className="text-xs text-[var(--color-text-muted)]">
                  Generated {formatRelativeTime(draft.created_at)}
                </span>
              </div>
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                {getPreview(draft)}
              </p>
              <div className="flex items-center gap-1 mt-2 text-xs text-[var(--color-primary-400)] opacity-0 group-hover:opacity-100 transition-opacity">
                Review
                <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
