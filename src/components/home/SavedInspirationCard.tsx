"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { CapturedPost } from "@/types/captured";
import { formatRelativeTime } from "@/lib/utils/formatting";
import { Lightbulb, Sparkles, ExternalLink } from "lucide-react";

interface SavedInspirationCardProps {
  posts: CapturedPost[];
}

export function SavedInspirationCard({ posts }: SavedInspirationCardProps) {
  // Get newest saves first
  const recentSaves = [...posts]
    .sort((a, b) => new Date(b.captured_at).getTime() - new Date(a.captured_at).getTime())
    .slice(0, 3);

  // Count new saves (last 24 hours)
  const oneDayAgo = new Date();
  oneDayAgo.setDate(oneDayAgo.getDate() - 1);
  const newCount = posts.filter(
    (p) => new Date(p.captured_at) > oneDayAgo
  ).length;

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-3">
              <Lightbulb className="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              No saved inspiration yet
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] max-w-[200px] mx-auto">
              Use the Chrome extension to save posts from other accounts as inspiration
            </p>
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
              Saved Inspiration
            </h3>
            {newCount > 0 && (
              <Badge variant="primary" size="sm">
                {newCount} new
              </Badge>
            )}
          </div>
          <Link
            href="/library?filter=inspiration"
            className="text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
          >
            View All
          </Link>
        </div>

        <div className="space-y-2">
          {recentSaves.map((post) => (
            <div
              key={post.id}
              className="p-3 bg-[var(--color-bg-elevated)] rounded-lg group"
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-[var(--color-text-secondary)]">
                    @{post.author_handle}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)]">
                    · Saved {formatRelativeTime(post.captured_at)}
                  </span>
                </div>
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-3">
                {post.text_content}
              </p>

              <Link
                href={`/create?inspiration=${encodeURIComponent(post.id)}`}
              >
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Sparkles className="w-3.5 h-3.5" />}
                  className="w-full justify-center text-xs hover:bg-[var(--color-primary-500)]/10 hover:text-[var(--color-primary-400)]"
                >
                  Use as Inspiration
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
