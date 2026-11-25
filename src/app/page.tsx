import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { youtubeChannels, videos, videoCaptions } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getPublicSettingsSummary } from "@/lib/settings";
import { TubeSmartApp } from "@/components/TubeSmartApp";
import type { ChannelDTO, LibraryStatsDTO, NavView, VideoDTO } from "@/types/studio";

export const dynamic = "force-dynamic";

interface HomeProps {
  searchParams?: Promise<{ view?: string; oauth?: string }>;
}

export default async function HomePage({ searchParams }: HomeProps) {
  await ensureSeeded();

  const resolvedParams = searchParams ? await searchParams : {};
  const validViews: NavView[] = ["studio", "library", "channels", "deploy"];
  const initialView: NavView = validViews.includes(resolvedParams.view as NavView)
    ? (resolvedParams.view as NavView)
    : "studio";
  const initialOauthNotice = resolvedParams.oauth || null;

  const [rawChannels, rawVideos, capCounts, settings] = await Promise.all([
    db
      .select()
      .from(youtubeChannels)
      .orderBy(desc(youtubeChannels.isActive), desc(youtubeChannels.connectedAt)),
    db
      .select()
      .from(videos)
      .orderBy(desc(videos.updatedAt), desc(videos.id)),
    db
      .select({
        videoId: videoCaptions.videoId,
        codes: sql<string[]>`array_agg(${videoCaptions.languageCode})`,
      })
      .from(videoCaptions)
      .groupBy(videoCaptions.videoId),
    getPublicSettingsSummary(),
  ]);

  const safeChannels: ChannelDTO[] = rawChannels.map((ch) => ({
    id: ch.id,
    youtubeChannelId: ch.youtubeChannelId,
    title: ch.title,
    handle: ch.handle,
    description: ch.description,
    avatarUrl: ch.avatarUrl,
    subscriberCount: ch.subscriberCount,
    videoCount: ch.videoCount,
    viewCount: ch.viewCount,
    connectionMode: ch.connectionMode,
    hasRefreshToken: Boolean(ch.refreshTokenEnc),
    defaultLanguage: ch.defaultLanguage,
    defaultCategoryId: ch.defaultCategoryId,
    defaultPrivacy: ch.defaultPrivacy,
    isActive: ch.isActive,
    connectedAt: ch.connectedAt.toISOString(),
    updatedAt: ch.updatedAt.toISOString(),
  }));

  const capMap = new Map(capCounts.map((c) => [c.videoId, c.codes || []]));
  const chMap = new Map(rawChannels.map((c) => [c.id, c]));

  const safeVideos: VideoDTO[] = rawVideos.map((v) => {
    const ch = v.channelId ? chMap.get(v.channelId) : undefined;
    return {
      ...v,
      scheduledAt: v.scheduledAt ? v.scheduledAt.toISOString() : null,
      publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
      createdAt: v.createdAt.toISOString(),
      updatedAt: v.updatedAt.toISOString(),
      hasLocalFile: Boolean(v.storedPath),
      captionLanguages: capMap.get(v.id) || [],
      channelTitle: ch?.title || null,
      channelHandle: ch?.handle || null,
    };
  });

  const stats: LibraryStatsDTO = {
    total: rawVideos.length,
    published: rawVideos.filter((v) => v.status === "published").length,
    scheduled: rawVideos.filter((v) => v.status === "scheduled").length,
    ready: rawVideos.filter((v) =>
      ["ready", "analyzed", "uploaded"].includes(v.status)
    ).length,
    avgSeo:
      rawVideos.length > 0
        ? Math.round(
            rawVideos.reduce((acc, v) => acc + (v.seoScore || 0), 0) /
              rawVideos.length
          )
        : 0,
  };

  return (
    <TubeSmartApp
      initialChannels={safeChannels}
      initialVideos={safeVideos}
      initialStats={stats}
      initialSettings={settings}
      initialView={initialView}
      initialOauthNotice={initialOauthNotice}
    />
  );
}
