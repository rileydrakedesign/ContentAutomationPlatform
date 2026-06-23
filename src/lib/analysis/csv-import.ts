/**
 * X Analytics CSV import — parse + merge-store into `user_analytics`, keyed by
 * a user id. Shared by the in-app upload (POST /api/analytics/csv) and the
 * agency per-client import (which passes a client's data-island id). Pure parse
 * + a Supabase store step; gating/auth/validation stay at the call sites.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PostAnalytics, UserAnalyticsData } from "@/types/analytics";
import { weightedEngagement } from "@/lib/utils/engagement";
import { capPostsByRecency } from "@/lib/utils/analytics-retention";

interface CsvRow {
  id: string;
  date: string;
  text: string;
  link: string;
  impressions: number;
  likes: number;
  engagements: number;
  bookmarks: number;
  shares: number;
  newFollows: number;
  replies: number;
  reposts: number;
  profileVisits: number;
  detailExpands: number;
  urlClicks: number;
}

function isReply(text: string): boolean {
  return text.trim().startsWith("@");
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function parseDate(dateStr: string): Date | null {
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    // ignore
  }
  const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (m) {
    const [, mm, dd, yyyy, hh, min, ap] = m;
    let hour = Number(hh);
    const minute = Number(min);
    const isPm = ap.toUpperCase() === "PM";
    if (hour === 12) hour = isPm ? 12 : 0;
    else hour = isPm ? hour + 12 : hour;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), hour, minute, 0, 0);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export function parseXAnalyticsCsv(csvContent: string): PostAnalytics[] {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idIndex = header.findIndex((h) => h.includes("post id") || h === "id");
  const dateIndex = header.findIndex((h) => h.includes("date"));
  const timeIndex = header.findIndex((h) => h === "time" || h.includes("time"));
  const textIndex = header.findIndex((h) => h.includes("post text") || h.includes("text"));
  const linkIndex = header.findIndex((h) => h.includes("link"));
  const impressionsIndex = header.findIndex((h) => h.includes("impressions"));
  const likesIndex = header.findIndex((h) => h.includes("likes"));
  const engagementsIndex = header.findIndex((h) => h.includes("engagements"));
  const bookmarksIndex = header.findIndex((h) => h.includes("bookmarks"));
  const sharesIndex = header.findIndex((h) => h.includes("shares"));
  const newFollowsIndex = header.findIndex((h) => h.includes("new follows") || h.includes("follows"));
  const repliesIndex = header.findIndex((h) => h.includes("replies"));
  const repostsIndex = header.findIndex((h) => h.includes("reposts") || h.includes("retweets"));
  const profileVisitsIndex = header.findIndex((h) => h.includes("profile visits"));
  const detailExpandsIndex = header.findIndex((h) => h.includes("detail expands"));
  const urlClicksIndex = header.findIndex((h) => h.includes("url clicks"));

  const num = (values: string[], idx: number) => (idx >= 0 ? parseInt(values[idx]) || 0 : 0);
  const posts: PostAnalytics[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      if (values.length < 5) continue;
      const text = textIndex >= 0 ? values[textIndex] : "";
      if (!text || text.length < 5) continue;

      const date = dateIndex >= 0 ? values[dateIndex] : "";
      const time = timeIndex >= 0 ? values[timeIndex] : "";
      const combinedDate = date && time && !date.includes(":") ? `${date} ${time}` : date;

      const row: CsvRow = {
        id: idIndex >= 0 ? values[idIndex] : String(i),
        date: combinedDate,
        text,
        link: linkIndex >= 0 ? values[linkIndex] : "",
        impressions: num(values, impressionsIndex),
        likes: num(values, likesIndex),
        engagements: num(values, engagementsIndex),
        bookmarks: num(values, bookmarksIndex),
        shares: num(values, sharesIndex),
        newFollows: num(values, newFollowsIndex),
        replies: num(values, repliesIndex),
        reposts: num(values, repostsIndex),
        profileVisits: num(values, profileVisitsIndex),
        detailExpands: num(values, detailExpandsIndex),
        urlClicks: num(values, urlClicksIndex),
      };

      const parsed = parseDate(row.date);
      posts.push({
        id: row.id,
        post_id: row.id,
        text: row.text,
        date: parsed ? parsed.toISOString() : row.date,
        post_url: row.link,
        impressions: row.impressions,
        likes: row.likes,
        replies: row.replies,
        reposts: row.reposts,
        bookmarks: row.bookmarks,
        shares: row.shares,
        new_follows: row.newFollows,
        profile_visits: row.profileVisits,
        detail_expands: row.detailExpands,
        url_clicks: row.urlClicks,
        engagement_score: weightedEngagement(row as unknown as Record<string, number | undefined>),
        is_reply: isReply(row.text),
      });
    } catch {
      continue;
    }
  }
  return posts;
}

export interface CsvImportSummary {
  total_posts: number;
  total_replies: number;
  total_rows: number;
  csv_rows: number;
  newly_added: number;
  updated_metrics: number;
  date_range: { start: string; end: string };
}

export interface CsvImportResult {
  data: UserAnalyticsData;
  summary: CsvImportSummary;
}

/**
 * Merge-store parsed posts into user_analytics for a user/client id,
 * deduplicating by post_id (new rows overwrite — they may carry fresher metrics).
 */
export async function storeAnalyticsCsv(
  supabase: SupabaseClient,
  userId: string,
  posts: PostAnalytics[],
  filename: string
): Promise<CsvImportResult> {
  const dateRangeFrom = (ps: PostAnalytics[]) => {
    const dates = ps
      .map((p) => parseDate(p.date))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());
    return {
      start: dates.length > 0 ? dates[0].toISOString() : new Date().toISOString(),
      end: dates.length > 0 ? dates[dates.length - 1].toISOString() : new Date().toISOString(),
    };
  };

  const { data: existing } = await supabase
    .from("user_analytics")
    .select("*")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingPosts: PostAnalytics[] = existing?.posts ?? [];
  const postMap = new Map<string, PostAnalytics>();
  for (const p of existingPosts) postMap.set(p.post_id, p);
  for (const p of posts) postMap.set(p.post_id, p);

  const mergedPosts = capPostsByRecency(Array.from(postMap.values()));
  const analyticsData: Omit<UserAnalyticsData, "id"> = {
    user_id: userId,
    posts: mergedPosts,
    total_posts: mergedPosts.filter((p) => !p.is_reply).length,
    total_replies: mergedPosts.filter((p) => p.is_reply).length,
    date_range: dateRangeFrom(mergedPosts),
    uploaded_at: new Date().toISOString(),
    csv_filename: filename,
  };

  const result = existing
    ? await supabase.from("user_analytics").update(analyticsData).eq("id", existing.id).select().single()
    : await supabase.from("user_analytics").insert(analyticsData).select().single();

  if (result.error) throw result.error;

  const existingIds = new Set(existingPosts.map((p) => p.post_id));
  const finalData = result.data as UserAnalyticsData;
  return {
    data: finalData,
    summary: {
      total_posts: finalData.total_posts,
      total_replies: finalData.total_replies,
      total_rows: finalData.posts.length,
      csv_rows: posts.length,
      newly_added: posts.filter((p) => !existingIds.has(p.post_id)).length,
      updated_metrics: posts.filter((p) => existingIds.has(p.post_id)).length,
      date_range: finalData.date_range,
    },
  };
}

export async function importAnalyticsCsv(
  supabase: SupabaseClient,
  userId: string,
  csvContent: string,
  filename: string
): Promise<CsvImportResult> {
  const posts = parseXAnalyticsCsv(csvContent);
  if (posts.length === 0) {
    throw new Error("No valid posts found in CSV");
  }
  return storeAnalyticsCsv(supabase, userId, posts, filename);
}
