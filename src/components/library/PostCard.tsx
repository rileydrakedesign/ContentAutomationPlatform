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
            <span className="font-medium text-white">@{post.author_handle}</span>
            <TypeBadge type={post.triaged_as || "my_post"} />
            {post.is_own_post && <Badge variant="primary">You</Badge>}
          </div>

          {/* Content */}
          <p className="text-slate-300 whitespace-pre-wrap mb-3">
            {post.text_content}
          </p>

          {/* Metrics */}
          {Object.keys(post.metrics).length > 0 && (
            <p className="text-sm text-slate-500 mb-3">
              {formatMetrics(post.metrics)}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center gap-4 text-sm">
            <span className="text-slate-600">{formatRelativeTime(post.captured_at)}</span>

            {isMyPost && onPromoteToInspiration && (
              <button
                onClick={() => onPromoteToInspiration(post.id)}
                className="text-purple-400 hover:text-purple-300 transition"
              >
                Use as inspiration
              </button>
            )}

            <a
              href={post.post_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-500 hover:text-slate-300 transition"
            >
              View on X
            </a>

            <button
              onClick={() => onDelete(post.id)}
              className="text-red-400 hover:text-red-300 transition"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </Card>
  );
}
