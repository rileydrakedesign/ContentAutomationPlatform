import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { ParsedCsvPost, VoiceType } from "@/types/voice";

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
  replies: number;
  reposts: number;
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

  // Parse header to find column indices
  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());

  // X Analytics CSV columns (may vary):
  // Post id, Date, Post text, Post Link, Impressions, Likes, Engagements, Bookmarks, Shares, Replies, Reposts
  const idIndex = header.findIndex((h) => h.includes("post id") || h === "id");
  const dateIndex = header.findIndex((h) => h.includes("date"));
  const textIndex = header.findIndex((h) => h.includes("post text") || h.includes("text"));
  const linkIndex = header.findIndex((h) => h.includes("link"));
  const impressionsIndex = header.findIndex((h) => h.includes("impressions"));
  const likesIndex = header.findIndex((h) => h.includes("likes"));
  const engagementsIndex = header.findIndex((h) => h.includes("engagements"));
  const bookmarksIndex = header.findIndex((h) => h.includes("bookmarks"));
  const sharesIndex = header.findIndex((h) => h.includes("shares"));
  const repliesIndex = header.findIndex((h) => h.includes("replies"));
  const repostsIndex = header.findIndex((h) => h.includes("reposts") || h.includes("retweets"));

  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    try {
      const values = parseCsvLine(lines[i]);
      if (values.length < 5) continue;

      const text = textIndex >= 0 ? values[textIndex] : "";
      if (!text || text.length < 10) continue; // Skip empty or very short posts

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
        replies: repliesIndex >= 0 ? parseInt(values[repliesIndex]) || 0 : 0,
        reposts: repostsIndex >= 0 ? parseInt(values[repostsIndex]) || 0 : 0,
      });
    } catch {
      // Skip malformed rows
      continue;
    }
  }

  return rows;
}

// POST /api/voice/csv-upload - Parse X Analytics CSV and return top performers
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
    const voiceType = (formData.get("voice_type") as VoiceType) || "reply";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice_type" }, { status: 400 });
    }

    const csvContent = await file.text();
    const rows = parseXAnalyticsCsv(csvContent);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No valid posts found in CSV" },
        { status: 400 }
      );
    }

    // Calculate engagement scores and filter by type
    const parsedPosts: ParsedCsvPost[] = rows
      .map((row) => ({
        id: row.id,
        text: row.text,
        date: row.date,
        impressions: row.impressions,
        likes: row.likes,
        replies: row.replies,
        reposts: row.reposts,
        bookmarks: row.bookmarks,
        engagementScore: calculateEngagementScore(row),
        isReply: isReply(row.text),
        selected: false,
      }))
      // Filter by voice type: posts for 'post', replies for 'reply'
      .filter((post) => (voiceType === "reply" ? post.isReply : !post.isReply))
      // Sort by engagement score (highest first)
      .sort((a, b) => b.engagementScore - a.engagementScore)
      // Take top 20
      .slice(0, 20)
      // Pre-select top 5
      .map((post, index) => ({
        ...post,
        selected: index < 5,
      }));

    return NextResponse.json({
      posts: parsedPosts,
      total_parsed: rows.length,
      filtered_count: parsedPosts.length,
      voice_type: voiceType,
    });
  } catch (error) {
    console.error("Failed to parse CSV:", error);
    return NextResponse.json(
      { error: "Failed to parse CSV file" },
      { status: 500 }
    );
  }
}
