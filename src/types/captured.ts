export interface PostMetrics {
  likes?: number;
  retweets?: number;
  replies?: number;
  quotes?: number;
  views?: number;
  bookmarks?: number;
}

export interface CapturedPost {
  id: string;
  user_id: string;
  x_post_id: string | null;
  post_url: string;
  author_handle: string;
  author_name: string | null;
  text_content: string;
  is_own_post: boolean;
  metrics: PostMetrics;
  captured_at: string;
  post_timestamp: string | null;
  inbox_status: "inbox" | "triaged";
  triaged_as: "my_post" | "inspiration" | null;
  created_at: string;
  updated_at: string;
}

export interface XConnection {
  id: string;
  user_id: string;
  x_user_id: string;
  x_username: string;
  last_sync_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  id: string;
  user_id: string;
  x_handles: string[];
  created_at: string;
  updated_at: string;
}

// Request types for API endpoints
export interface CaptureRequest {
  post_url: string;
  author_handle: string;
  author_name?: string;
  text_content: string;
  metrics?: PostMetrics;
  post_timestamp?: string;
}

export interface TriageRequest {
  inbox_status?: "inbox" | "triaged";
  triaged_as?: "my_post" | "inspiration" | null;
}

export interface UpdateSettingsRequest {
  x_handles?: string[];
}
