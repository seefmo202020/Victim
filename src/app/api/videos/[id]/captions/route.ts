import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { videos, videoCaptions } from "@/db/schema";
import {
  buildGeneratedCaptions,
  cuesToSrt,
  cuesToVtt,
} from "@/lib/captions";
import { calculateSeoBreakdown } from "@/lib/youtube-constants";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

async function recalcVideoSeo(videoId: number) {
  const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
  if (!video) return;
  const caps = await db
    .select({ id: videoCaptions.id })
    .from(videoCaptions)
    .where(eq(videoCaptions.videoId, videoId));
  const seo = calculateSeoBreakdown({
    title: video.title,
    description: video.description,
    hashtags: video.hashtags || [],
    tags: video.tags || [],
    captionsCount: caps.length,
    videoLanguage: video.videoLanguage,
    categoryId: video.categoryId,
    focusKeyword: video.focusKeyword,
  });
  await db
    .update(videos)
    .set({ seoScore: seo.total, updatedAt: new Date() })
    .where(eq(videos.id, videoId));
}

export async function GET(req: Request, ctx: RouteCtx) {
  const { id: rawId } = await ctx.params;
  const videoId = Number(rawId);
  if (!Number.isInteger(videoId) || videoId <= 0) {
    return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const captionId = Number(searchParams.get("captionId") || 0);
  const format = searchParams.get("format") === "vtt" ? "vtt" : "srt";

  if (captionId > 0) {
    const [cap] = await db
      .select()
      .from(videoCaptions)
      .where(
        and(eq(videoCaptions.id, captionId), eq(videoCaptions.videoId, videoId))
      );
    if (!cap) {
      return NextResponse.json({ error: "الترجمة غير موجودة" }, { status: 404 });
    }
    const content =
      format === "vtt"
        ? cuesToVtt(cap.cues || [])
        : cap.srtContent || cuesToSrt(cap.cues || []);
    const mime =
      format === "vtt" ? "text/vtt; charset=utf-8" : "application/x-subrip; charset=utf-8";
    return new Response(content, {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="video-${videoId}-${cap.languageCode}.${format}"`,
      },
    });
  }

  const list = await db
    .select()
    .from(videoCaptions)
    .where(eq(videoCaptions.videoId, videoId))
    .orderBy(asc(videoCaptions.id));

  return NextResponse.json({ captions: list });
}

export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const { id: rawId } = await ctx.params;
    const videoId = Number(rawId);
    if (!Number.isInteger(videoId) || videoId <= 0) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const [video] = await db.select().from(videos).where(eq(videos.id, videoId));
    if (!video) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const body = (await req.json()) as { languageCode?: string };
    const code = String(body.languageCode || "en").trim().toLowerCase().slice(0, 8);

    const existing = await db
      .select()
      .from(videoCaptions)
      .where(
        and(
          eq(videoCaptions.videoId, videoId),
          eq(videoCaptions.languageCode, code)
        )
      );

    const gen = buildGeneratedCaptions({
      languageCode: code,
      topic: video.detectedTopic || video.userPrompt || video.title || video.originalFilename,
      title: video.title,
      durationSeconds: video.durationSeconds || 420,
      chapters: video.chapters || [],
      transcriptHint: code === video.videoLanguage ? video.transcriptHint : undefined,
    });

    if (existing[0]) {
      const [updated] = await db
        .update(videoCaptions)
        .set({
          languageName: gen.languageName,
          cues: gen.cues,
          srtContent: gen.srtContent,
          updatedAt: new Date(),
        })
        .where(eq(videoCaptions.id, existing[0].id))
        .returning();
      await recalcVideoSeo(videoId);
      return NextResponse.json({ caption: updated });
    }

    const [created] = await db
      .insert(videoCaptions)
      .values({
        videoId,
        languageCode: code,
        languageName: gen.languageName,
        isAutoSync: true,
        includeInUpload: true,
        cues: gen.cues,
        srtContent: gen.srtContent,
      })
      .returning();

    await recalcVideoSeo(videoId);
    return NextResponse.json({ caption: created }, { status: 201 });
  } catch (err) {
    console.error("POST captions error:", err);
    return NextResponse.json({ error: "تعذّر توليد الترجمة" }, { status: 500 });
  }
}

const patchCaptionSchema = z.object({
  captionId: z.coerce.number().int().positive(),
  includeInUpload: z.boolean().optional(),
  isAutoSync: z.boolean().optional(),
  cues: z
    .array(
      z.object({
        index: z.number().int().positive(),
        start: z.string().min(4).max(20),
        end: z.string().min(4).max(20),
        text: z.string().max(400),
      })
    )
    .optional(),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id: rawId } = await ctx.params;
    const videoId = Number(rawId);
    const body = await req.json();
    const parsed = patchCaptionSchema.safeParse(body);
    if (!parsed.success || !Number.isInteger(videoId)) {
      return NextResponse.json({ error: "بيانات الترجمة غير صالحة" }, { status: 400 });
    }
    const { captionId, includeInUpload, isAutoSync, cues } = parsed.data;
    const [updated] = await db
      .update(videoCaptions)
      .set({
        ...(includeInUpload !== undefined ? { includeInUpload } : {}),
        ...(isAutoSync !== undefined ? { isAutoSync } : {}),
        ...(cues !== undefined ? { cues, srtContent: cuesToSrt(cues) } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(eq(videoCaptions.id, captionId), eq(videoCaptions.videoId, videoId))
      )
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "مسار الترجمة غير موجود" }, { status: 404 });
    }
    return NextResponse.json({ caption: updated });
  } catch (err) {
    console.error("PATCH caption error:", err);
    return NextResponse.json({ error: "تعذّر تحديث الترجمة" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteCtx) {
  try {
    const { id: rawId } = await ctx.params;
    const videoId = Number(rawId);
    const { searchParams } = new URL(req.url);
    const captionId = Number(searchParams.get("captionId") || 0);
    if (!Number.isInteger(videoId) || !Number.isInteger(captionId) || captionId <= 0) {
      return NextResponse.json({ error: "بيانات غير صالحة" }, { status: 400 });
    }

    await db
      .delete(videoCaptions)
      .where(
        and(eq(videoCaptions.id, captionId), eq(videoCaptions.videoId, videoId))
      );

    await recalcVideoSeo(videoId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE caption error:", err);
    return NextResponse.json({ error: "تعذّر حذف الترجمة" }, { status: 500 });
  }
}
