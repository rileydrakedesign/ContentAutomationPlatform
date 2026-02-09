"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatRelativeTime, formatNumber } from "@/lib/utils/formatting";
import { CapturedPost } from "@/types/captured";
import { PostAnalytics } from "@/types/analytics";
import {
  FileText,
  ArrowRight,
  ChevronDown,
  Lightbulb,
  CheckCircle,
  TrendingUp,
  Eye,
  Heart,
  MessageCircle,
  ExternalLink,
  Copy,
  Pencil,
} from "lucide-react";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
};

type ContentType = "drafts" | "top_posts" | "inspiration" | "approved";

interface ContentSidebarProps {
  drafts: Draft[];
  posts: PostAnalytics[];
  inspirationPosts: CapturedPost[];
  onUploadClick: () => void;
}

const contentOptions: { value: ContentType; label: string; icon: React.ElementType }[] = [
  { value: "drafts", label: "Drafts to Review", icon: FileText },
  { value: "top_posts", label: "Top Posts", icon: TrendingUp },
  { value: "inspiration", label: "Saved Inspiration", icon: Lightbulb },
  { value: "approved", label: "Approved & Ready", icon: CheckCircle },
];

function getPreview(draft: Draft): string {
  const content = draft.edited_content || draft.content;
  if ("text" in content) return content.text as string;
  if ("tweets" in content) return (content.tweets as string[])[0];
  return "";
}

export function ContentSidebar({
  drafts,
  posts,
  inspirationPosts,
  onUploadClick,
}: ContentSidebarProps) {
  const [contentType, setContentType] = useState<ContentType>("drafts");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const pendingDrafts = drafts.filter((d) => d.status === "GENERATED");
  const approvedDrafts = drafts.filter((d) => d.status === "APPROVED");
  const topPosts = [...posts]
    .filter((p) => !p.is_reply)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 5);

  const currentOption = contentOptions.find((o) => o.value === contentType)!;
  const CurrentIcon = currentOption.icon;

  const getCount = () => {
    switch (contentType) {
      case "drafts":
        return pendingDrafts.length;
      case "top_posts":
        return topPosts.length;
      case "inspiration":
        return inspirationPosts.length;
      case "approved":
        return approvedDrafts.length;
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
  };

  return (
    <Card className="h-full flex flex-col">
      <CardContent className="flex-1 flex flex-col overflow-hidden">
        {/* Dropdown Header */}
        <div className="relative mb-4">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="w-full flex items-center justify-between p-2 -m-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <CurrentIcon className="w-4 h-4 text-[var(--color-primary-400)]" />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                {currentOption.label}
              </span>
              {getCount() > 0 && (
                <Badge variant="warning" size="sm">
                  {getCount()}
                </Badge>
              )}
            </div>
            <ChevronDown
              className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform ${
                isDropdownOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 right-0 mt-1 py-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border)] rounded-lg shadow-lg z-10">
              {contentOptions.map((option) => {
                const Icon = option.icon;
                const count =
                  option.value === "drafts"
                    ? pendingDrafts.length
                    : option.value === "top_posts"
                    ? topPosts.length
                    : option.value === "inspiration"
                    ? inspirationPosts.length
                    : approvedDrafts.length;

                return (
                  <button
                    key={option.value}
                    onClick={() => {
                      setContentType(option.value);
                      setIsDropdownOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--color-bg-hover)] transition-colors ${
                      contentType === option.value
                        ? "bg-[var(--color-bg-hover)]"
                        : ""
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        contentType === option.value
                          ? "text-[var(--color-primary-400)]"
                          : "text-[var(--color-text-muted)]"
                      }`}
                    />
                    <span
                      className={`text-sm ${
                        contentType === option.value
                          ? "text-[var(--color-text-primary)] font-medium"
                          : "text-[var(--color-text-secondary)]"
                      }`}
                    >
                      {option.label}
                    </span>
                    {count > 0 && (
                      <Badge
                        variant={contentType === option.value ? "warning" : "default"}
                        size="sm"
                        className="ml-auto"
                      >
                        {count}
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto -mx-4 px-4">
          {contentType === "drafts" && (
            <DraftsContent drafts={pendingDrafts} />
          )}
          {contentType === "top_posts" && (
            <TopPostsContent posts={topPosts} onUploadClick={onUploadClick} />
          )}
          {contentType === "inspiration" && (
            <InspirationContent posts={inspirationPosts} />
          )}
          {contentType === "approved" && (
            <ApprovedContent drafts={approvedDrafts} onCopy={handleCopy} />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// Sub-components for each content type

function DraftsContent({ drafts }: { drafts: Draft[] }) {
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center mb-3">
          <FileText className="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          No drafts to review
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Generate drafts from inspiration or topics
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.map((draft) => (
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
              {formatRelativeTime(draft.created_at)}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
            {getPreview(draft)}
          </p>
          <div className="flex items-center gap-1 mt-2 text-xs text-[var(--color-primary-400)] opacity-0 group-hover:opacity-100 transition-opacity">
            Review <ArrowRight className="w-3 h-3" />
          </div>
        </Link>
      ))}
      <Link
        href="/create?tab=drafts"
        className="block text-center text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] py-2 transition-colors"
      >
        View All Drafts
      </Link>
    </div>
  );
}

function TopPostsContent({
  posts,
  onUploadClick,
}: {
  posts: PostAnalytics[];
  onUploadClick: () => void;
}) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center mb-3">
          <TrendingUp className="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          No analytics data yet
        </p>
        <Button
          variant="primary"
          size="sm"
          className="mt-3"
          onClick={onUploadClick}
        >
          Upload CSV
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post, index) => (
        <div
          key={post.post_id}
          className="p-3 bg-[var(--color-bg-elevated)] rounded-lg"
        >
          <div className="flex items-start gap-2">
            <span className="w-5 h-5 rounded-full bg-[var(--color-primary-500)]/20 text-[var(--color-primary-400)] text-xs font-medium flex items-center justify-center shrink-0">
              {index + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
                {post.text}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs text-[var(--color-text-muted)]">
                <span className="flex items-center gap-1" title="Impressions">
                  <Eye className="w-3 h-3" />
                  {formatNumber(post.impressions)}
                </span>
                <span className="flex items-center gap-1" title="Likes">
                  <Heart className="w-3 h-3" />
                  {post.likes}
                </span>
                <span className="flex items-center gap-1" title="Replies">
                  <MessageCircle className="w-3 h-3" />
                  {post.replies}
                </span>
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ml-auto text-[var(--color-text-muted)] hover:text-[var(--color-primary-400)] transition-colors"
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
  );
}

function InspirationContent({ posts }: { posts: CapturedPost[] }) {
  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center mb-3">
          <Lightbulb className="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          No saved inspiration yet
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Use the Chrome extension to save posts
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.slice(0, 5).map((post) => (
        <div
          key={post.id}
          className="p-3 bg-[var(--color-bg-elevated)] rounded-lg group"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-medium text-[var(--color-primary-400)]">
              @{post.author_handle}
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              {formatRelativeTime(post.created_at)}
            </span>
          </div>
          <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
            {post.text_content}
          </p>
          <Link
            href={`/create?inspiration=${post.id}`}
            className="flex items-center gap-1 mt-2 text-xs text-[var(--color-primary-400)] opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Use as Inspiration <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      ))}
      <Link
        href="/library?filter=inspiration"
        className="block text-center text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] py-2 transition-colors"
      >
        View All Inspiration
      </Link>
    </div>
  );
}

function ApprovedContent({
  drafts,
  onCopy,
}: {
  drafts: Draft[];
  onCopy: (text: string) => void;
}) {
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-bg-elevated)] flex items-center justify-center mb-3">
          <CheckCircle className="w-6 h-6 text-[var(--color-text-muted)]" />
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">
          No approved drafts yet
        </p>
        <p className="text-xs text-[var(--color-text-muted)] mt-1">
          Review and approve drafts to see them here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {drafts.slice(0, 5).map((draft) => {
        const text = getPreview(draft);
        return (
          <div
            key={draft.id}
            className="p-3 bg-[var(--color-bg-elevated)] rounded-lg"
          >
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success" size="sm">
                {draft.type === "X_POST" ? "Post" : "Thread"}
              </Badge>
              <span className="text-xs text-[var(--color-text-muted)]">
                Approved {formatRelativeTime(draft.created_at)}
              </span>
            </div>
            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">
              {text}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="w-3 h-3" />}
                onClick={() => onCopy(text)}
              >
                Copy
              </Button>
              <Link href={`/drafts/${draft.id}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Pencil className="w-3 h-3" />}
                >
                  Edit
                </Button>
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
