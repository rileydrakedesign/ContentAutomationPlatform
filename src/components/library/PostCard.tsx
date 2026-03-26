"use client";

import { CapturedPost } from "@/types/captured";
import { Card } from "@/components/ui/Card";
import { Badge, TypeBadge } from "@/components/ui/Badge";
import { formatMetrics, formatRelativeTime } from "@/lib/utils/formatting";

interface PostCardProps {
  post: CapturedPost;
  onDelete: (id: string) => void;
  onPromoteToInspiration?: (id: string) => void;
}

export function PostCard({
  post,
  onDelete,
  onPromoteToInspiration,
}: PostCardProps) {
  const isMyPost = post.triaged_as === "my_post";

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <span className="font-medium text-[var(--color-text-primary)]">@{post.author_handle}</span>
            <TypeBadge type={post.triaged_as || "my_post"} />
            {post.is_own_post && <Badge variant="primary">You</Badge>}
          </div>

          {/* Content */}
          <p className="text-[var(--color-text-secondary)] whitespace-pre-wrap mb-3">
            {post.text_content}
          </p>

          {/* Metrics */}
          {Object.keys(post.metrics).length > 0 && (
            <p className="text-sm text-[var(--color-text-muted)] mb-3">
              {formatMetrics(post.metrics)}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-[var(--color-text-muted)]">{formatRelativeTime(post.captured_at)}</span>

            {isMyPost && onPromoteToInspiration && (
              <button
                onClick={() => onPromoteToInspiration(post.id)}
                className="text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition"
              >
                Use as inspiration
              </button>
            )}

            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition"
            >
              View on X
            </a>

            <button
              onClick={() => onDelete(post.id)}
              className="text-[var(--color-danger-400)] hover:text-[var(--color-danger-300)] transition"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
