export interface DayOfWeekStats {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  dayName: string;
  postCount: number;
  avgEngagement: number;
  avgImpressions: number;
  avgLikes: number;
  avgReposts: number;
  avgReplies: number;
  totalEngagement: number;
  value: number; // normalized 0-1 for bar height
  confidence: "high" | "medium" | "low";
}

export interface DayOfWeekAnalytics {
  days: DayOfWeekStats[];
  bestDay: DayOfWeekStats | null;
  totalPostsAnalyzed: number;
  hasEnoughData: boolean;
}

// Uploaded CSV analytics data
export interface PostAnalytics {
  id: string;
  post_id: string;
  text: string;
  date: string;
  post_url?: string;
  impressions: number;
  likes: number;
  replies: number;
  reposts: number;
  bookmarks: number;
  shares: number;
  new_follows: number;
  profile_visits: number;
  detail_expands: number;
  url_clicks: number;
  engagement_score: number;
  is_reply: boolean;
}

export interface UserAnalyticsData {
  id: string;
  user_id: string;
  posts: PostAnalytics[];
  total_posts: number;
  total_replies: number;
  date_range: {
    start: string;
    end: string;
  };
  uploaded_at: string;
  csv_filename?: string;
}

export interface AnalyticsSummary {
  total_impressions: number;
  total_likes: number;
  total_replies: number;
  total_reposts: number;
  total_bookmarks: number;
  avg_impressions_per_post: number;
  avg_engagement_rate: number;
  top_posts: PostAnalytics[];
  posts_by_day: Record<string, { posts: number; replies: number }>;
}

// Consistency tracker types
export interface DayActivity {
  date: string;
  posts: number;
  replies: number;
  total: number;
}

export interface WeekActivity {
  weekStart: string;
  days: DayActivity[];
}

export interface ConsistencyData {
  weeks: WeekActivity[];
  totalPosts: number;
  totalReplies: number;
  currentStreak: number;
  longestStreak: number;
}

// Insights derived from analytics
export interface AnalyticsInsight {
  id: string;
  type: "performance" | "comparison" | "pattern" | "timing" | "growth";
  title: string;
  description: string;
  value?: string | number;
  trend?: "up" | "down" | "neutral";
  priority: number;
}

// Sort options for top posts
export type PostSortField = "impressions" | "likes" | "replies" | "reposts" | "bookmarks" | "engagement_score";
