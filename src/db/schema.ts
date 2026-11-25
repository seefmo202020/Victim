import {
  pgTable,
  serial,
  text,
  integer,
  bigint,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";

export interface TitleCandidate {
  title: string;
  ctrScore: number;
  seoScore: number;
  angle: string;
  reason: string;
}

export interface VideoChapter {
  time: string;
  label: string;
}

export interface KeywordTag {
  text: string;
  type: "long_tail" | "core" | "trending";
  volume: "عالي جداً" | "عالي" | "متوسط";
  competition: "منخفضة" | "متوسطة" | "عالية";
  score: number;
}

export interface PublishLogEntry {
  step: string;
  status: "done" | "skipped" | "error";
  detail: string;
  at: string;
}

export interface CaptionCue {
  index: number;
  start: string;
  end: string;
  text: string;
}

export const youtubeChannels = pgTable("youtube_channels", {
  id: serial("id").primaryKey(),
  youtubeChannelId: text("youtube_channel_id").notNull().unique(),
  title: text("title").notNull(),
  handle: text("handle").notNull(),
  description: text("description").notNull().default(""),
  avatarUrl: text("avatar_url").notNull().default("/images/channel-avatar.jpg"),
  subscriberCount: integer("subscriber_count").notNull().default(0),
  videoCount: integer("video_count").notNull().default(0),
  viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),
  connectionMode: text("connection_mode").notNull().default("demo"), // 'oauth' | 'demo'
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at"),
  defaultLanguage: text("default_language").notNull().default("ar"),
  defaultCategoryId: text("default_category_id").notNull().default("28"),
  defaultPrivacy: text("default_privacy").notNull().default("public"),
  isActive: boolean("is_active").notNull().default(true),
  connectedAt: timestamp("connected_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  channelId: integer("channel_id").references(() => youtubeChannels.id, {
    onDelete: "set null",
  }),
  status: text("status").notNull().default("uploaded"), // 'uploaded' | 'analyzed' | 'ready' | 'uploading' | 'published' | 'scheduled' | 'failed'
  originalFilename: text("original_filename").notNull(),
  storedPath: text("stored_path"),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }).notNull().default(0),
  mimeType: text("mime_type").notNull().default("video/mp4"),
  durationSeconds: integer("duration_seconds").notNull().default(0),
  resolution: text("resolution").notNull().default("1920×1080"),
  thumbnailUrl: text("thumbnail_url").notNull().default("/images/thumb-youtube-seo.jpg"),
  userPrompt: text("user_prompt").notNull().default(""),
  transcriptHint: text("transcript_hint").notNull().default(""),
  contentTone: text("content_tone").notNull().default("engaging"),
  detectedTopic: text("detected_topic").notNull().default(""),
  detectedAudience: text("detected_audience").notNull().default(""),
  bestPublishTime: text("best_publish_time").notNull().default("الخميس 7:00 مساءً"),
  aiProviderUsed: text("ai_provider_used").notNull().default("builtin"),
  focusKeyword: text("focus_keyword").notNull().default(""),
  title: text("title").notNull().default(""),
  titleCandidates: jsonb("title_candidates").$type<TitleCandidate[]>().notNull().default([]),
  description: text("description").notNull().default(""),
  chapters: jsonb("chapters").$type<VideoChapter[]>().notNull().default([]),
  hashtags: jsonb("hashtags").$type<string[]>().notNull().default([]),
  tags: jsonb("tags").$type<KeywordTag[]>().notNull().default([]),
  seoScore: integer("seo_score").notNull().default(0),
  videoLanguage: text("video_language").notNull().default("ar"),
  metadataLanguage: text("metadata_language").notNull().default("ar"),
  categoryId: text("category_id").notNull().default("28"),
  privacyStatus: text("privacy_status").notNull().default("public"), // 'public' | 'unlisted' | 'private' | 'scheduled'
  scheduledAt: timestamp("scheduled_at"),
  madeForKids: boolean("made_for_kids").notNull().default(false),
  license: text("license").notNull().default("youtube"), // 'youtube' | 'creativeCommon'
  playlistName: text("playlist_name").notNull().default(""),
  allowComments: boolean("allow_comments").notNull().default(true),
  allowEmbedding: boolean("allow_embedding").notNull().default(true),
  notifySubscribers: boolean("notify_subscribers").notNull().default(true),
  recordingLocation: text("recording_location").notNull().default(""),
  recordingDate: text("recording_date").notNull().default(""),
  youtubeVideoId: text("youtube_video_id"),
  youtubeUrl: text("youtube_url"),
  publishMode: text("publish_mode"), // 'youtube_api' | 'demo_simulation'
  publishLog: jsonb("publish_log").$type<PublishLogEntry[]>().notNull().default([]),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const videoCaptions = pgTable("video_captions", {
  id: serial("id").primaryKey(),
  videoId: integer("video_id")
    .notNull()
    .references(() => videos.id, { onDelete: "cascade" }),
  languageCode: text("language_code").notNull(),
  languageName: text("language_name").notNull(),
  isAutoSync: boolean("is_auto_sync").notNull().default(true),
  includeInUpload: boolean("include_in_upload").notNull().default(true),
  cues: jsonb("cues").$type<CaptionCue[]>().notNull().default([]),
  srtContent: text("srt_content").notNull().default(""),
  uploadedCaptionId: text("uploaded_caption_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const appSettings = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  valueEnc: text("value_enc").notNull(),
  isSecret: boolean("is_secret").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type YoutubeChannel = typeof youtubeChannels.$inferSelect;
export type VideoRecord = typeof videos.$inferSelect;
export type VideoCaption = typeof videoCaptions.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
