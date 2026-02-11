"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { PostAnalytics, PostSortField } from "@/types/analytics";
import { formatNumber } from "@/lib/utils/formatting";
import { Eye, Heart, MessageCircle, Repeat2, Bookmark, Upload, ChevronDown, ExternalLink } from "lucide-react";

interface TopPostsCardProps {
  posts: PostAnalytics[];
  uploadedAt?: string;
  onUploadClick: () => void;
}

const sortOptions: { value: PostSortField; label: string }[] = [
  { value: "impressions", label: "Impressions" },
  { value: "likes", label: "Likes" },
  { value: "replies", label: "Replies" },
  { value: "reposts", label: "Reposts" },
  { value: "bookmarks", label: "Bookmarks" },
  { value: "engagement_score", label: "Engagement" },
];

export function TopPostsCard({ posts, uploadedAt, onUploadClick }: TopPostsCardProps) {
  const [sortBy, setSortBy] = useState<PostSortField>("impressions");
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  // Filter to only original posts (not replies) and sort
  const sortedPosts = [...posts]
    .filter((p) => !p.is_reply)
    .sort((a, b) => b[sortBy] - a[sortBy])
    .slice(0, 5);

  const formatUploadDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center">
            <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center mx-auto mb-3">
              <Upload className="w-6 h-6 text-[var(--color-text-muted)]" />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-1">
              No analytics data yet
            </h3>
            <p className="text-xs text-[var(--color-text-muted)] mb-4 max-w-[200px] mx-auto">
              Upload your X analytics CSV to see your top performing posts
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<Upload className="w-4 h-4" />}
              onClick={onUploadClick}
            >
              Upload CSV
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              Top Posts
            </h3>
            {uploadedAt && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                Last updated: {formatUploadDate(uploadedAt)}
              </p>
            )}
          </div>


          {/* Sort dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] rounded-md transition-colors"
            >
              {sortOptions.find((o) => o.value === sortBy)?.label}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showSortDropdown && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowSortDropdown(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-20 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-lg shadow-lg py-1 min-w-[120px]">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setSortBy(option.value);
                        setShowSortDropdown(false);
                      }}
                      className={`w-full px-3 py-1.5 text-xs text-left hover:bg-[var(--color-bg-hover)] transition-colors ${
                        sortBy === option.value
                          ? "text-[var(--color-primary-400)]"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {sortedPosts.map((post, index) => (
            <div
              key={post.id}
              className="p-3 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors group"
            >
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 rounded-full bg-[var(--color-bg-hover)] flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-xs font-medium text-[var(--color-text-muted)]">
                    {index + 1}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2 mb-2">
                    {post.text}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                    <span className="flex items-center gap-1" title="Impressions">
                      <Eye className="w-3 h-3" />
                      {formatNumber(post.impressions)}
                    </span>
                    <span className="flex items-center gap-1" title="Likes">
                      <Heart className="w-3 h-3" />
                      {formatNumber(post.likes)}
                    </span>
                    <span className="flex items-center gap-1" title="Replies">
                      <MessageCircle className="w-3 h-3" />
                      {formatNumber(post.replies)}
                    </span>
                    {post.bookmarks > 0 && (
                      <span className="flex items-center gap-1" title="Bookmarks">
                        <Bookmark className="w-3 h-3" />
                        {formatNumber(post.bookmarks)}
                      </span>
                    )}
                    {post.post_url && (
                      <a
                        href={post.post_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onUploadClick}
          className="w-full mt-3 py-2 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
        >
          Update Analytics →
        </button>
      </CardContent>
    </Card>
  );
}
