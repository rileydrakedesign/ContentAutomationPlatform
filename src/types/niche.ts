export type TopicCluster = {
  name: string;
  keywords: string[];
  post_count: number;
  avg_engagement: number;
  top_post_ids: string[];
  share_pct: number; // % of analysed posts in this cluster
};

export type NichePositioning = {
  target_audience: string;
  unique_angle: string;
  positioning_statement: string; // one sentence
};

export type NicheProfile = {
  id: string;
  user_id: string;
  topic_clusters: TopicCluster[];
  content_pillars: string[];
  niche_summary: string | null;
  positioning: NichePositioning | null;
  last_analyzed_at: string | null;
  total_posts_analyzed: number;
  created_at: string;
  updated_at: string;
};
