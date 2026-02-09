import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { PostAnalytics, UserAnalyticsData } from "@/types/analytics";

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

function calculateEngagementScore(row: CsvRow): number {
  return (
    row.likes * 3 +
    row.reposts * 5 +
    row.replies * 2 +
    row.bookmarks * 4 +
    row.impressions * 0.001
  );
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

function parseXAnalyticsCsv(csvContent: string): CsvRow[] {
  const lines = csvContent.split("\n").filter((line) => line.trim());
  if (lines.length < 2) return [];

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

  // Find column indices
  const idIndex = header.findIndex((h) => h.includes("post id") || h === "id");
  const dateIndex = header.findIndex((h) => h.includes("date"));
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

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      if (values.length < 5) continue;

      const text = textIndex >= 0 ? values[textIndex] : "";
      if (!text || text.length < 5) continue;

      rows.push({
        id: idIndex >= 0 ? values[idIndex] : String(i),
        date: dateIndex >= 0 ? values[dateIndex] : "",
        text,
        link: linkIndex >= 0 ? values[linkIndex] : "",
        impressions: impressionsIndex >= 0 ? parseInt(values[impressionsIndex]) || 0 : 0,
        likes: likesIndex >= 0 ? parseInt(values[likesIndex]) || 0 : 0,
        engagements: engagementsIndex >= 0 ? parseInt(values[engagementsIndex]) || 0 : 0,
        bookmarks: bookmarksIndex >= 0 ? parseInt(values[bookmarksIndex]) || 0 : 0,
        shares: sharesIndex >= 0 ? parseInt(values[sharesIndex]) || 0 : 0,
        newFollows: newFollowsIndex >= 0 ? parseInt(values[newFollowsIndex]) || 0 : 0,
        replies: repliesIndex >= 0 ? parseInt(values[repliesIndex]) || 0 : 0,
        reposts: repostsIndex >= 0 ? parseInt(values[repostsIndex]) || 0 : 0,
        profileVisits: profileVisitsIndex >= 0 ? parseInt(values[profileVisitsIndex]) || 0 : 0,
        detailExpands: detailExpandsIndex >= 0 ? parseInt(values[detailExpandsIndex]) || 0 : 0,
        urlClicks: urlClicksIndex >= 0 ? parseInt(values[urlClicksIndex]) || 0 : 0,
      });
    } catch {
      continue;
    }
  }

  return rows;
}

function parseDate(dateStr: string): Date | null {
  // Handle format: "Thu, Jan 22, 2026"
  try {
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) return parsed;
  } catch {
    // Continue to other formats
  }
  return null;
}

// GET /api/analytics/csv - Get stored analytics data
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_analytics")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// POST /api/analytics/csv - Upload and store CSV analytics
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const csvContent = await file.text();
    const rows = parseXAnalyticsCsv(csvContent);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid posts found in CSV" },
        { status: 400 }
      );
    }

    // Convert to PostAnalytics format
    const posts: PostAnalytics[] = rows.map((row) => ({
      id: row.id,
      post_id: row.id,
      text: row.text,
      date: row.date,
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
      engagement_score: calculateEngagementScore(row),
      is_reply: isReply(row.text),
    }));

    // Calculate date range
    const dates = posts
      .map((p) => parseDate(p.date))
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime());

    const dateRange = {
      start: dates.length > 0 ? dates[0].toISOString() : new Date().toISOString(),
      end: dates.length > 0 ? dates[dates.length - 1].toISOString() : new Date().toISOString(),
    };

    const analyticsData: Omit<UserAnalyticsData, "id"> = {
      user_id: user.id,
      posts,
      total_posts: posts.filter((p) => !p.is_reply).length,
      total_replies: posts.filter((p) => p.is_reply).length,
      date_range: dateRange,
      uploaded_at: new Date().toISOString(),
      csv_filename: file.name,
    };

    // Upsert analytics data (replace existing)
    const { data: existing } = await supabase
      .from("user_analytics")
      .select("id")
      .eq("user_id", user.id)
      .single();

    let result;
    if (existing) {
      result = await supabase
        .from("user_analytics")
        .update(analyticsData)
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("user_analytics")
        .insert(analyticsData)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      data: result.data,
      summary: {
        total_posts: analyticsData.total_posts,
        total_replies: analyticsData.total_replies,
        total_rows: posts.length,
        date_range: dateRange,
      },
    });
  } catch (error) {
    console.error("Failed to upload analytics:", error);
    return NextResponse.json(
      { error: "Failed to upload analytics" },
      { status: 500 }
    );
  }
}
