import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, videoCaptions, youtubeChannels } from "@/db/schema";
import { analyzeVideoWithAi, generateMoreLongTailTags } from "@/lib/seo-engine";
import { calculateSeoBreakdown } from "@/lib/youtube-constants";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rawId } = await ctx.params;
    const id = Number(rawId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      mode?: "full" | "more_tags";
      seedKeyword?: string;
      userPrompt?: string;
      transcriptHint?: string;
      contentTone?: string;
      videoLanguage?: string;
      categoryId?: string;
    };

    // Quick long-tail tag expansion
    if (body.mode === "more_tags") {
      const seed = (body.seedKeyword || video.focusKeyword || video.detectedTopic || video.title).trim();
      const extra = generateMoreLongTailTags(seed, video.tags || [], video.videoLanguage);

      // Fit safely within YouTube's 500-char limit
      const current = [...(video.tags || [])];
      let len = current.map((t) => t.text).join(",").length;
      const added: typeof current = [];
      for (const item of extra) {
        const nextLen = len + (current.length ? 1 : 0) + item.text.length;
        if (nextLen > 495) continue;
        len = nextLen;
        current.push(item);
        added.push(item);
      }

      const caps = await db
        .select({ id: videoCaptions.id })
        .from(videoCaptions)
        .where(eq(videoCaptions.videoId, id));

      const seo = calculateSeoBreakdown({
        title: video.title,
        description: video.description,
        hashtags: video.hashtags || [],
        tags: current,
        captionsCount: caps.length,
        videoLanguage: video.videoLanguage,
        categoryId: video.categoryId,
        focusKeyword: video.focusKeyword,
      });

      const [updated] = await db
        .update(videos)
        .set({ tags: current, seoScore: seo.total, updatedAt: new Date() })
        .where(eq(videos.id, id))
        .returning();

      return NextResponse.json({
        video: { ...updated, hasLocalFile: Boolean(updated.storedPath) },
        addedCount: added.length,
        seo,
      });
    }

    // Full AI analysis (topic, 5 titles, description, chapters, hashtags, long-tail tags, settings, AR+EN captions)
    let channelTitle: string | undefined;
    if (video.channelId) {
      const [ch] = await db
        .select()
        .from(youtubeChannels)
        .where(eq(youtubeChannels.id, video.channelId));
      channelTitle = ch?.title;
    }

    const userPrompt = body.userPrompt !== undefined ? body.userPrompt : video.userPrompt;
    const transcriptHint =
      body.transcriptHint !== undefined ? body.transcriptHint : video.transcriptHint;
    const contentTone = body.contentTone || video.contentTone || "engaging";
    const videoLanguage = body.videoLanguage || video.videoLanguage || "ar";
    const categoryId = body.categoryId || video.categoryId || "";

    const analysis = await analyzeVideoWithAi({
      filename: video.originalFilename,
      userPrompt,
      transcriptHint,
      durationSeconds: video.durationSeconds || 480,
      language: videoLanguage,
      categoryId,
      contentTone,
      channelTitle,
    });

    const [updated] = await db
      .update(videos)
      .set({
        status: video.status === "published" ? "published" : "ready",
        userPrompt,
        transcriptHint,
        contentTone,
        detectedTopic: analysis.detectedTopic,
        detectedAudience: analysis.detectedAudience,
        bestPublishTime: analysis.bestPublishTime,
        aiProviderUsed: analysis.aiProviderUsed,
        focusKeyword: analysis.focusKeyword,
        title: analysis.title,
        titleCandidates: analysis.titleCandidates,
        description: analysis.description,
        chapters: analysis.chapters,
        hashtags: analysis.hashtags,
        tags: analysis.tags,
        categoryId: analysis.suggestedCategoryId,
        videoLanguage: analysis.suggestedLanguage,
        metadataLanguage: analysis.suggestedLanguage,
        seoScore: analysis.seoScore,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();

    // Replace existing auto-generated captions cleanly with fresh ones
    await db.delete(videoCaptions).where(eq(videoCaptions.videoId, id));

    if (analysis.captions.length > 0) {
      await db.insert(videoCaptions).values(
        analysis.captions.map((c) => ({
          videoId: id,
          languageCode: c.languageCode,
          languageName: c.languageName,
          isAutoSync: true,
          includeInUpload: true,
          cues: c.cues,
          srtContent: c.srtContent,
        }))
      );
    }

    const savedCaptions = await db
      .select()
      .from(videoCaptions)
      .where(eq(videoCaptions.videoId, id))
      .orderBy(asc(videoCaptions.id));

    return NextResponse.json({
      video: { ...updated, hasLocalFile: Boolean(updated.storedPath) },
      captions: savedCaptions,
      provider: analysis.aiProviderUsed,
    });
  } catch (err) {
    console.error("POST /api/videos/[id]/analyze error:", err);
    return NextResponse.json(
      { error: "تعذّر تحليل الفيديو بالذكاء الاصطناعي" },
      { status: 500 }
    );
  }
}
