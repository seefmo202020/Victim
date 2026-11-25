import { NextResponse } from "next/server";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { videos, videoCaptions, youtubeChannels } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await ensureSeeded();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = (searchParams.get("q") || "").trim().toLowerCase();

    const rows = await db
      .select()
      .from(videos)
      .orderBy(desc(videos.updatedAt), desc(videos.id));

    const capCounts = await db
      .select({
        videoId: videoCaptions.videoId,
        codes: sql<string[]>`array_agg(${videoCaptions.languageCode})`,
      })
      .from(videoCaptions)
      .groupBy(videoCaptions.videoId);

    const channelList = await db.select().from(youtubeChannels);
    const channelMap = new Map(channelList.map((c) => [c.id, c]));
    const capMap = new Map(capCounts.map((c) => [c.videoId, c.codes || []]));

    let result = rows.map((v) => {
      const ch = v.channelId ? channelMap.get(v.channelId) : undefined;
      return {
        ...v,
        captionLanguages: capMap.get(v.id) || [],
        channelTitle: ch?.title || null,
        channelHandle: ch?.handle || null,
        hasLocalFile: Boolean(v.storedPath),
      };
    });

    if (status && status !== "all") {
      if (status === "draft") {
        result = result.filter((v) =>
          ["uploaded", "analyzed", "ready"].includes(v.status)
        );
      } else {
        result = result.filter((v) => v.status === status);
      }
    }

    if (q) {
      result = result.filter(
        (v) =>
          v.title.toLowerCase().includes(q) ||
          v.originalFilename.toLowerCase().includes(q) ||
          v.detectedTopic.toLowerCase().includes(q) ||
          v.userPrompt.toLowerCase().includes(q) ||
          (v.tags || []).some((t) => t.text.toLowerCase().includes(q))
      );
    }

    return NextResponse.json({
      videos: result,
      stats: {
        total: rows.length,
        published: rows.filter((v) => v.status === "published").length,
        scheduled: rows.filter((v) => v.status === "scheduled").length,
        ready: rows.filter((v) => ["ready", "analyzed", "uploaded"].includes(v.status)).length,
        avgSeo:
          rows.length > 0
            ? Math.round(
                rows.reduce((acc, v) => acc + (v.seoScore || 0), 0) / rows.length
              )
            : 0,
      },
    });
  } catch (err) {
    console.error("GET /api/videos error:", err);
    return NextResponse.json(
      { error: "تعذّر تحميل مكتبة الفيديوهات" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  // Duplicate an existing video as new draft if requested
  try {
    const body = (await req.json()) as { duplicateId?: number };
    const sourceId = Number(body.duplicateId);
    if (!Number.isInteger(sourceId) || sourceId <= 0) {
      return NextResponse.json({ error: "طلب غير صالح" }, { status: 400 });
    }
    const [src] = await db.select().from(videos).where(eq(videos.id, sourceId));
    if (!src) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const [created] = await db
      .insert(videos)
      .values({
        channelId: src.channelId,
        status: "ready",
        originalFilename: src.originalFilename,
        storedPath: null,
        fileSizeBytes: src.fileSizeBytes,
        mimeType: src.mimeType,
        durationSeconds: src.durationSeconds,
        resolution: src.resolution,
        thumbnailUrl: src.thumbnailUrl,
        userPrompt: src.userPrompt,
        transcriptHint: src.transcriptHint,
        contentTone: src.contentTone,
        detectedTopic: src.detectedTopic,
        detectedAudience: src.detectedAudience,
        bestPublishTime: src.bestPublishTime,
        aiProviderUsed: src.aiProviderUsed,
        focusKeyword: src.focusKeyword,
        title: `${src.title} (نسخة)`,
        titleCandidates: src.titleCandidates,
        description: src.description,
        chapters: src.chapters,
        hashtags: src.hashtags,
        tags: src.tags,
        seoScore: src.seoScore,
        videoLanguage: src.videoLanguage,
        metadataLanguage: src.metadataLanguage,
        categoryId: src.categoryId,
        privacyStatus: "private",
        madeForKids: src.madeForKids,
        license: src.license,
        playlistName: src.playlistName,
        allowComments: src.allowComments,
        allowEmbedding: src.allowEmbedding,
        notifySubscribers: src.notifySubscribers,
      })
      .returning();

    const srcCaps = await db
      .select()
      .from(videoCaptions)
      .where(eq(videoCaptions.videoId, src.id));

    if (srcCaps.length > 0) {
      await db.insert(videoCaptions).values(
        srcCaps.map((c) => ({
          videoId: created.id,
          languageCode: c.languageCode,
          languageName: c.languageName,
          isAutoSync: c.isAutoSync,
          includeInUpload: c.includeInUpload,
          cues: c.cues,
          srtContent: c.srtContent,
        }))
      );
    }

    return NextResponse.json({ video: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/videos error:", err);
    return NextResponse.json({ error: "تعذّر نسخ الفيديو" }, { status: 500 });
  }
}
