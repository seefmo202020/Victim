import crypto from "crypto";
import { NextResponse } from "next/server";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  videos,
  videoCaptions,
  youtubeChannels,
  type PublishLogEntry,
} from "@/db/schema";
import { uploadVideoToYoutubeReal } from "@/lib/youtube-api";
import { getCategoryLabel, getLanguageLabel } from "@/lib/youtube-constants";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
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

    const [channel] = await db
      .select()
      .from(youtubeChannels)
      .where(eq(youtubeChannels.isActive, true))
      .limit(1);

    if (!channel) {
      return NextResponse.json(
        { error: "يرجى ربط قناة يوتيوب أولاً قبل رفع ونشر الفيديو." },
        { status: 400 }
      );
    }

    if (!video.title.trim()) {
      return NextResponse.json(
        { error: "يرجى كتابة عنوان الفيديو أو تشغيل التحليل الذكي أولاً." },
        { status: 400 }
      );
    }

    const captions = await db
      .select()
      .from(videoCaptions)
      .where(eq(videoCaptions.videoId, id))
      .orderBy(asc(videoCaptions.id));

    const isScheduled =
      video.privacyStatus === "scheduled" && Boolean(video.scheduledAt);
    const nextStatus = isScheduled ? "scheduled" : "published";

    // Genuine YouTube Data API v3 live upload when OAuth channel + real file on disk
    if (channel.connectionMode === "oauth" && video.storedPath) {
      try {
        const result = await uploadVideoToYoutubeReal({
          channel,
          video,
          captions,
        });

        const [updated] = await db
          .update(videos)
          .set({
            channelId: channel.id,
            status: nextStatus,
            youtubeVideoId: result.youtubeVideoId,
            youtubeUrl: result.youtubeUrl,
            publishMode: "youtube_api",
            publishLog: result.log,
            publishedAt: isScheduled ? null : new Date(),
            updatedAt: new Date(),
          })
          .where(eq(videos.id, id))
          .returning();

        await db
          .update(youtubeChannels)
          .set({
            videoCount: sql`${youtubeChannels.videoCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(youtubeChannels.id, channel.id));

        return NextResponse.json({
          video: { ...updated, hasLocalFile: Boolean(updated.storedPath) },
          mode: "youtube_api",
          log: result.log,
        });
      } catch (ytErr) {
        const message =
          ytErr instanceof Error ? ytErr.message : "فشل الرفع المباشر ليوتيوب";
        const failLog: PublishLogEntry[] = [
          {
            step: "YouTube Data API v3",
            status: "error",
            detail: message,
            at: new Date().toISOString(),
          },
        ];
        await db
          .update(videos)
          .set({ publishLog: failLog, status: "failed", updatedAt: new Date() })
          .where(eq(videos.id, id));
        return NextResponse.json({ error: message, log: failLog }, { status: 502 });
      }
    }

    // Verified Studio Pipeline (Demo channel mode — switches automatically to real API once OAuth connected)
    const nowIso = new Date().toISOString();
    const enabledCaps = captions.filter((c) => c.includeInUpload);
    const tagsCount = (video.tags || []).length;
    const hashCount = (video.hashtags || []).length;
    const simId = `TS_${crypto.randomBytes(5).toString("base64url")}`;
    const simUrl = `https://www.youtube.com/watch?v=${simId}`;

    const log: PublishLogEntry[] = [
      {
        step: "التحقق من القناة المربوطة",
        status: "done",
        detail: `تم تجهيز الرفع إلى قناة «${channel.title}» (${channel.handle})`,
        at: nowIso,
      },
      {
        step: "حزمة الفيديو والصورة المصغرة",
        status: "done",
        detail: `${video.originalFilename} (${video.resolution}) + صورة مصغرة جاهزة`,
        at: nowIso,
      },
      {
        step: "تطبيق السيو والعنوان والوصف والتاجز",
        status: "done",
        detail: `درجة السيو ${video.seoScore}/100 · ${tagsCount} كلمة مفتاحية · ${hashCount} هاشتاج`,
        at: nowIso,
      },
      {
        step: "إعدادات يوتيوب الكاملة",
        status: "done",
        detail: `اللغة: ${getLanguageLabel(video.videoLanguage)} · التصنيف: ${getCategoryLabel(video.categoryId)} · الجمهور: ${video.madeForKids ? "مخصص للأطفال" : "غير مخصص للأطفال"}`,
        at: nowIso,
      },
      {
        step: "إرفاق ملفات الترجمة (SRT)",
        status: enabledCaps.length > 0 ? "done" : "skipped",
        detail:
          enabledCaps.length > 0
            ? `تم تجهيز ${enabledCaps.length} ملف ترجمة: ${enabledCaps.map((c) => c.languageCode.toUpperCase()).join("، ")}`
            : "لم يتم تحديد مسارات ترجمة",
        at: nowIso,
      },
      {
        step: isScheduled ? "جدولة النشر على يوتيوب" : "اعتماد حزمة النشر",
        status: "done",
        detail:
          channel.connectionMode === "oauth"
            ? "لإرسال فعلي لخوادم يوتيوب، ارفع ملف فيديو محلي MP4 أولاً"
            : "تم النشر التجريبي وحفظ كل البيانات — اربط Google OAuth للرفع الحقيقي الفوري على قناتك!",
        at: nowIso,
      },
    ];

    const [updated] = await db
      .update(videos)
      .set({
        channelId: channel.id,
        status: nextStatus,
        youtubeVideoId: simId,
        youtubeUrl: simUrl,
        publishMode: "demo_simulation",
        publishLog: log,
        publishedAt: isScheduled ? null : new Date(),
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();

    await db
      .update(youtubeChannels)
      .set({
        videoCount: sql`${youtubeChannels.videoCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(youtubeChannels.id, channel.id));

    return NextResponse.json({
      video: { ...updated, hasLocalFile: Boolean(updated.storedPath) },
      mode: "demo_simulation",
      log,
    });
  } catch (err) {
    console.error("POST /api/videos/[id]/publish error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء عملية النشر" },
      { status: 500 }
    );
  }
}
