import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { youtubeChannels, type YoutubeChannel } from "@/db/schema";
import { ensureSeeded } from "@/db/seed";
import { getPublicSettingsSummary } from "@/lib/settings";

export const dynamic = "force-dynamic";

function sanitizeChannel(ch: YoutubeChannel) {
  return {
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
    connectedAt: ch.connectedAt,
    updatedAt: ch.updatedAt,
  };
}

export async function GET() {
  try {
    await ensureSeeded();
    const list = await db
      .select()
      .from(youtubeChannels)
      .orderBy(desc(youtubeChannels.isActive), desc(youtubeChannels.connectedAt));
    const settings = await getPublicSettingsSummary();
    return NextResponse.json({
      channels: list.map(sanitizeChannel),
      activeChannel: list.find((c) => c.isActive)
        ? sanitizeChannel(list.find((c) => c.isActive)!)
        : null,
      isGoogleConfigured: settings.isGoogleConfigured,
    });
  } catch (err) {
    console.error("GET /api/channels error:", err);
    return NextResponse.json(
      { error: "تعذّر تحميل بيانات القنوات المربوطة" },
      { status: 500 }
    );
  }
}

const createChannelSchema = z.object({
  title: z.string().trim().min(2, "اسم القناة مطلوب").max(80),
  handle: z.string().trim().max(50).optional(),
  description: z.string().trim().max(400).optional(),
  subscriberCount: z.coerce.number().int().min(0).max(500_000_000).optional(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
  defaultCategoryId: z.string().trim().min(1).max(4).optional(),
  defaultPrivacy: z.enum(["public", "unlisted", "private"]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = createChannelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "بيانات القناة غير صالحة" },
        { status: 400 }
      );
    }

    const data = parsed.data;
    const rawHandle = (data.handle || "").trim().replace(/^@+/, "");
    const safeSlug = rawHandle
      ? rawHandle.replace(/\s+/g, "")
      : `channel_${Date.now().toString(36)}`;
    const youtubeChannelId = `UC_DEMO_${Date.now().toString(36).toUpperCase()}`;

    await db.update(youtubeChannels).set({ isActive: false });

    const [created] = await db
      .insert(youtubeChannels)
      .values({
        youtubeChannelId,
        title: data.title,
        handle: `@${safeSlug}`,
        description:
          data.description || `قناة ${data.title} المتصلة عبر استوديو TubeSmart AI`,
        avatarUrl: "/images/channel-avatar.jpg",
        subscriberCount: data.subscriberCount ?? 12400,
        videoCount: 0,
        viewCount: (data.subscriberCount ?? 12400) * 18,
        connectionMode: "demo",
        defaultLanguage: data.defaultLanguage || "ar",
        defaultCategoryId: data.defaultCategoryId || "28",
        defaultPrivacy: data.defaultPrivacy || "public",
        isActive: true,
      })
      .returning();

    return NextResponse.json({ channel: sanitizeChannel(created) }, { status: 201 });
  } catch (err) {
    console.error("POST /api/channels error:", err);
    return NextResponse.json({ error: "تعذّر ربط القناة الجديدة" }, { status: 500 });
  }
}

const patchChannelSchema = z.object({
  id: z.coerce.number().int().positive(),
  isActive: z.boolean().optional(),
  title: z.string().trim().min(2).max(80).optional(),
  defaultLanguage: z.string().trim().min(2).max(10).optional(),
  defaultCategoryId: z.string().trim().min(1).max(4).optional(),
  defaultPrivacy: z.enum(["public", "unlisted", "private"]).optional(),
});

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const parsed = patchChannelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات التحديث غير صالحة" }, { status: 400 });
    }
    const { id, isActive, ...rest } = parsed.data;

    if (isActive) {
      await db.update(youtubeChannels).set({ isActive: false });
    }

    const updates: Partial<typeof youtubeChannels.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (isActive !== undefined) updates.isActive = isActive;
    if (rest.title !== undefined) updates.title = rest.title;
    if (rest.defaultLanguage !== undefined) updates.defaultLanguage = rest.defaultLanguage;
    if (rest.defaultCategoryId !== undefined) updates.defaultCategoryId = rest.defaultCategoryId;
    if (rest.defaultPrivacy !== undefined) updates.defaultPrivacy = rest.defaultPrivacy;

    const [updated] = await db
      .update(youtubeChannels)
      .set(updates)
      .where(eq(youtubeChannels.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "القناة غير موجودة" }, { status: 404 });
    }

    return NextResponse.json({ channel: sanitizeChannel(updated) });
  } catch (err) {
    console.error("PATCH /api/channels error:", err);
    return NextResponse.json({ error: "تعذّر تحديث القناة" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = Number(searchParams.get("id"));
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "معرّف القناة غير صالح" }, { status: 400 });
    }

    const [deleted] = await db
      .delete(youtubeChannels)
      .where(eq(youtubeChannels.id, id))
      .returning();

    if (!deleted) {
      return NextResponse.json({ error: "القناة غير موجودة" }, { status: 404 });
    }

    if (deleted.isActive) {
      const remaining = await db
        .select()
        .from(youtubeChannels)
        .orderBy(desc(youtubeChannels.connectedAt))
        .limit(1);
      if (remaining[0]) {
        await db
          .update(youtubeChannels)
          .set({ isActive: true })
          .where(eq(youtubeChannels.id, remaining[0].id));
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/channels error:", err);
    return NextResponse.json({ error: "تعذّر فصل القناة" }, { status: 500 });
  }
}
