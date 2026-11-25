import type {
  CaptionCue,
  KeywordTag,
  PublishLogEntry,
  TitleCandidate,
  VideoChapter,
} from "@/db/schema";

export type NavView = "studio" | "library" | "channels" | "deploy";
export type StudioStep = "upload" | "optimize" | "publish";

export interface ChannelDTO {
  id: number;
  youtubeChannelId: string;
  title: string;
  handle: string;
  description: string;
  avatarUrl: string;
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
  connectionMode: "oauth" | "demo" | string;
  hasRefreshToken?: boolean;
  defaultLanguage: string;
  defaultCategoryId: string;
  defaultPrivacy: string;
  isActive: boolean;
  connectedAt: string | Date;
  updatedAt: string | Date;
}

export interface VideoDTO {
  id: number;
  channelId: number | null;
  status: string;
  originalFilename: string;
  storedPath: string | null;
  hasLocalFile?: boolean;
  fileSizeBytes: number;
  mimeType: string;
  durationSeconds: number;
  resolution: string;
  thumbnailUrl: string;
  userPrompt: string;
  transcriptHint: string;
  contentTone: string;
  detectedTopic: string;
  detectedAudience: string;
  bestPublishTime: string;
  aiProviderUsed: string;
  focusKeyword: string;
  title: string;
  titleCandidates: TitleCandidate[];
  description: string;
  chapters: VideoChapter[];
  hashtags: string[];
  tags: KeywordTag[];
  seoScore: number;
  videoLanguage: string;
  metadataLanguage: string;
  categoryId: string;
  privacyStatus: string;
  scheduledAt: string | Date | null;
  madeForKids: boolean;
  license: string;
  playlistName: string;
  allowComments: boolean;
  allowEmbedding: boolean;
  notifySubscribers: boolean;
  recordingLocation: string;
  recordingDate: string;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  publishMode: string | null;
  publishLog: PublishLogEntry[];
  publishedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  captionLanguages?: string[];
  channelTitle?: string | null;
  channelHandle?: string | null;
}

export interface CaptionDTO {
  id: number;
  videoId: number;
  languageCode: string;
  languageName: string;
  isAutoSync: boolean;
  includeInUpload: boolean;
  cues: CaptionCue[];
  srtContent: string;
  uploadedCaptionId: string | null;
}

export interface SettingsSummaryDTO {
  googleClientId: string;
  hasGoogleClientSecret: boolean;
  googleClientSecretMasked: string;
  appBaseUrl: string;
  aiProvider: "auto" | "openai" | "gemini" | "builtin";
  hasOpenaiKey: boolean;
  openaiKeyMasked: string;
  hasGeminiKey: boolean;
  geminiKeyMasked: string;
  isGoogleConfigured: boolean;
  activeAiEngine: "openai" | "gemini" | "builtin";
}

export interface LibraryStatsDTO {
  total: number;
  published: number;
  scheduled: number;
  ready: number;
  avgSeo: number;
}
