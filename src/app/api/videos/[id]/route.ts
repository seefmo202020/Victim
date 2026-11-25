import fs from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { videos, videoCaptions } from "@/db/schema";
import { calculateSeoBreakdown } from "@/lib/youtube-constants";

export const dynamic = "force-dynamic";

type RouteCtx = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { id: rawId } = await ctx.params;
    const id = parseId(rawId);
    if (!id) {
      return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });
    }

    const [video] = await db.select().from(videos).where(eq(videos.id, id));
    if (!video) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const captions = await db
      .select()
      .from(videoCaptions)
      .where(eq(videoCaptions.videoId, id))
      .orderBy(asc(videoCaptions.id));

    return NextResponse.json({
      video: {
        ...video,
        hasLocalFile: Boolean(video.storedPath),
      },
      captions,
    });
  } catch (err) {
    console.error("GET /api/videos/[id] error:", err);
    return NextResponse.json({ error: "تعذّر جلب بيانات الفيديو" }, { status: 500 });
  }
}

const tagSchema = z.object({
  text: z.string().trim().min(1).max(120),
  type: z.enum(["long_tail", "core", "trending"]).default("long_tail"),
  volume: z.enum(["عالي جداً", "عالي", "متوسط"]).default("عالي"),
  competition: z.enum(["منخفضة", "متوسطة", "عالية"]).default("منخفضة"),
  score: z.number().int().min(1).max(100).default(88),
});

const patchVideoSchema = z.object({
  title: z.string().max(120).optional(),
  description: z.string().max(5000).optional(),
  userPrompt: z.string().max(2500).optional(),
  transcriptHint: z.string().max(12000).optional(),
  contentTone: z.string().max(40).optional(),
  focusKeyword: z.string().max(120).optional(),
  hashtags: z.array(z.string().trim().max(80)).max(15).optional(),
  tags: z.array(tagSchema).max(40).optional(),
  thumbnailUrl: z.string().max(2_000_000).optional(),
  videoLanguage: z.string().max(12).optional(),
  metadataLanguage: z.string().max(12).optional(),
  categoryId: z.string().max(6).optional(),
  privacyStatus: z.enum(["public", "unlisted", "private", "scheduled"]).optional(),
  scheduledAt: z.string().nullable().optional(),
  madeForKids: z.boolean().optional(),
  license: z.enum(["youtube", "creativeCommon"]).optional(),
  playlistName: z.string().max(120).optional(),
  allowComments: z.boolean().optional(),
  allowEmbedding: z.boolean().optional(),
  notifySubscribers: z.boolean().optional(),
  recordingLocation: z.string().max(140).optional(),
  recordingDate: z.string().max(30).optional(),
  status: z.enum(["uploaded", "analyzed", "ready", "published", "scheduled"]).optional(),
});

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { id: rawId } = await ctx.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

    const [existing] = await db.select().from(videos).where(eq(videos.id, id));
    if (!existing) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = patchVideoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات التحديث غير صالحة" },
        { status: 400 }
      );
    }

    const d = parsed.data;
    const nextTitle = d.title ?? existing.title;
    const nextDescription = d.description ?? existing.description;
    const nextHashtags = d.hashtags
      ? d.hashtags.map((h) => (h.startsWith("#") ? h : `#${h.replace(/\s+/g, "_")}`))
      : existing.hashtags;
    const nextTags = d.tags ?? existing.tags;
    const nextLang = d.videoLanguage ?? existing.videoLanguage;
    const nextCat = d.categoryId ?? existing.categoryId;
    const nextFocus = d.focusKeyword ?? existing.focusKeyword;

    const caps = await db
      .select({ id: videoCaptions.id })
      .from(videoCaptions)
      .where(eq(videoCaptions.videoId, id));

    const seo = calculateSeoBreakdown({
      title: nextTitle,
      description: nextDescription,
      hashtags: nextHashtags,
      tags: nextTags,
      captionsCount: caps.length,
      videoLanguage: nextLang,
      categoryId: nextCat,
      focusKeyword: nextFocus,
    });

    const scheduledAtValue =
      d.scheduledAt === undefined
        ? existing.scheduledAt
        : d.scheduledAt
          ? new Date(d.scheduledAt)
          : null;

    const [updated] = await db
      .update(videos)
      .set({
        ...(d.title !== undefined ? { title: d.title } : {}),
        ...(d.description !== undefined ? { description: d.description } : {}),
        ...(d.userPrompt !== undefined ? { userPrompt: d.userPrompt } : {}),
        ...(d.transcriptHint !== undefined ? { transcriptHint: d.transcriptHint } : {}),
        ...(d.contentTone !== undefined ? { contentTone: d.contentTone } : {}),
        ...(d.focusKeyword !== undefined ? { focusKeyword: d.focusKeyword } : {}),
        ...(d.hashtags !== undefined ? { hashtags: nextHashtags } : {}),
        ...(d.tags !== undefined ? { tags: nextTags } : {}),
        ...(d.thumbnailUrl !== undefined ? { thumbnailUrl: d.thumbnailUrl } : {}),
        ...(d.videoLanguage !== undefined ? { videoLanguage: d.videoLanguage } : {}),
        ...(d.metadataLanguage !== undefined ? { metadataLanguage: d.metadataLanguage } : {}),
        ...(d.categoryId !== undefined ? { categoryId: d.categoryId } : {}),
        ...(d.privacyStatus !== undefined ? { privacyStatus: d.privacyStatus } : {}),
        ...(d.scheduledAt !== undefined ? { scheduledAt: scheduledAtValue } : {}),
        ...(d.madeForKids !== undefined ? { madeForKids: d.madeForKids } : {}),
        ...(d.license !== undefined ? { license: d.license } : {}),
        ...(d.playlistName !== undefined ? { playlistName: d.playlistName } : {}),
        ...(d.allowComments !== undefined ? { allowComments: d.allowComments } : {}),
        ...(d.allowEmbedding !== undefined ? { allowEmbedding: d.allowEmbedding } : {}),
        ...(d.notifySubscribers !== undefined ? { notifySubscribers: d.notifySubscribers } : {}),
        ...(d.recordingLocation !== undefined ? { recordingLocation: d.recordingLocation } : {}),
        ...(d.recordingDate !== undefined ? { recordingDate: d.recordingDate } : {}),
        ...(d.status !== undefined ? { status: d.status } : {}),
        seoScore: seo.total,
        updatedAt: new Date(),
      })
      .where(eq(videos.id, id))
      .returning();

    return NextResponse.json({
      video: { ...updated, hasLocalFile: Boolean(updated.storedPath) },
      seo,
    });
  } catch (err) {
    console.error("PATCH /api/videos/[id] error:", err);
    return NextResponse.json({ error: "تعذّر حفظ التعديلات" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, ctx: RouteCtx) {
  try {
    const { id: rawId } = await ctx.params;
    const id = parseId(rawId);
    if (!id) return NextResponse.json({ error: "معرّف غير صالح" }, { status: 400 });

    const [deleted] = await db
      .delete(videos)
      .where(eq(videos.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "الفيديو غير موجود" }, { status: 404 });
    }

    // Safely delete local file inside uploads/ only
    if (deleted.storedPath) {
      const safeFile = path.basename(deleted.storedPath);
      const target = path.join(process.cwd(), "uploads", safeFile);
      if (safeFile && fs.existsSync(target)) {
        fs.unlinkSync(target);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/videos/[id] error:", err);
    return NextResponse.json({ error: "تعذّر حذف الفيديو" }, { status: 500 });
  }
}
