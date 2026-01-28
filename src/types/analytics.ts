export interface TimeSlot {
  dayOfWeek: number; // 0 = Sunday, 6 = Saturday
  hour: number; // 0-23
  postCount: number;
  avgEngagement: number;
  totalEngagement: number;
}

export interface BestTimeRecommendation {
  dayOfWeek: number;
  hour: number;
  dayName: string;
  timeDisplay: string;
  avgEngagement: number;
  postCount: number;
  confidence: "high" | "medium" | "low";
}

export interface HeatmapCell {
  dayOfWeek: number;
  hour: number;
  value: number; // normalized 0-1
  postCount: number;
}

export interface PostingAnalytics {
  bestTimes: BestTimeRecommendation[];
  heatmapData: HeatmapCell[];
  totalPostsAnalyzed: number;
  hasEnoughData: boolean;
}
