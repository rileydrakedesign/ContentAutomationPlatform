import type { PostMetrics } from "@/types/captured";
import { weightedEngagement } from "@/lib/utils/engagement";

/**
 * Format a number with K/M suffixes for display
 */
export function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
  if (n >= 1000) return (n / 1000).toFixed(1) + "K";
  return n.toString();
}

/**
 * Format post metrics into a readable string
 */
export function formatMetrics(metrics: PostMetrics): string {
  const parts: string[] = [];
  if (metrics.views) parts.push(`${formatNumber(metrics.views)} views`);
  if (metrics.likes) parts.push(`${formatNumber(metrics.likes)} likes`);
  if (metrics.retweets) parts.push(`${formatNumber(metrics.retweets)} RTs`);
  if (metrics.replies) parts.push(`${formatNumber(metrics.replies)} replies`);
  if (metrics.quotes) parts.push(`${formatNumber(metrics.quotes)} quotes`);
  return parts.join(" · ");
}

/**
 * Format a date relative to now (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return d.toLocaleDateString();
}

/**
 * Format a date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString();
}

/**
 * Format a date with time for display
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleString();
}

/**
 * Truncate text with ellipsis
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + "...";
}

/**
 * Calculate engagement rate from metrics
 */
export function calculateEngagementRate(metrics: PostMetrics): number {
  const views = metrics.views || 0;
  if (views === 0) return 0;

  const engagements =
    (metrics.likes || 0) +
    (metrics.retweets || 0) +
    (metrics.replies || 0) +
    (metrics.quotes || 0);

  return (engagements / views) * 100;
}

/**
 * Calculate an engagement score for sorting.
 * Delegates to the canonical weightedEngagement formula.
 */
export function calculateEngagementScore(metrics: PostMetrics): number {
  return weightedEngagement(metrics as Record<string, number | undefined>);
}
