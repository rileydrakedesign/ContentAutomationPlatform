// Content output types for drafts
export interface XPostContent {
  text: string;
}

export interface XThreadContent {
  tweets: string[];
}

export interface ReelScriptContent {
  hook: string;
  body: string;
  callToAction: string;
  estimatedDuration: string;
}

export type DraftContent = XPostContent | XThreadContent | ReelScriptContent;

// Source metadata types
export interface VoiceMemoMetadata {
  duration?: number;
  fileName?: string;
}

export interface InspirationMetadata {
  author?: string;
  platform?: string;
  originalText?: string;
}

export interface NewsMetadata {
  title?: string;
  author?: string;
  publication?: string;
  publishedAt?: string;
}

export type SourceMetadata =
  | VoiceMemoMetadata
  | InspirationMetadata
  | NewsMetadata;
