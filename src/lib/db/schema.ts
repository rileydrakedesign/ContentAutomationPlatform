import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

// Enums
export const sourceTypeEnum = pgEnum("source_type", [
  "VOICE_MEMO",
  "INSPIRATION",
  "NEWS",
]);

export const draftTypeEnum = pgEnum("draft_type", [
  "X_POST",
  "X_THREAD",
  "REEL_SCRIPT",
]);

export const draftStatusEnum = pgEnum("draft_status", [
  "PENDING",
  "GENERATED",
  "APPROVED",
  "REJECTED",
]);

// Sources table - voice memos, inspirations, news articles
export const sources = pgTable("sources", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: sourceTypeEnum("type").notNull(),
  // Original content: transcription for voice memos, URL/text for inspiration, article content for news
  rawContent: text("raw_content"),
  // URL for inspirations and news sources
  sourceUrl: text("source_url"),
  // Path to audio file in Supabase Storage (for voice memos)
  audioPath: text("audio_path"),
  // Additional metadata (e.g., article title, author, publication)
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Drafts table - generated content for X and Instagram
export const drafts = pgTable("drafts", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: draftTypeEnum("type").notNull(),
  status: draftStatusEnum("status").default("PENDING").notNull(),
  // The generated content
  content: jsonb("content").notNull(),
  // Reference to the source(s) that inspired this draft
  sourceIds: uuid("source_ids").array(),
  // Human edits to the draft
  editedContent: jsonb("edited_content"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Types for TypeScript
export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
export type Draft = typeof drafts.$inferSelect;
export type NewDraft = typeof drafts.$inferInsert;

export type SourceType = "VOICE_MEMO" | "INSPIRATION" | "NEWS";
export type DraftType = "X_POST" | "X_THREAD" | "REEL_SCRIPT";
export type DraftStatus = "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
