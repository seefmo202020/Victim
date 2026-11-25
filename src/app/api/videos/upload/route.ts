import fs from "fs";
import path from "path";
import crypto from "crypto";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { videos, youtubeChannels } from "@/db/schema";

export const dynamic = "force-dynamic";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const ALLOWED_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi", ".m4v"]);

function ensureUploadDir() {
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
}

export async function POST(req: Request) {
  try {
    const [activeChannel] = await db
      .select()
      .from(youtubeChannels)
      .where(eq(youtubeChannels.isActive, true))
      .limit(1);

    const contentType = req.headers.get("content-type") || "";

    // Mode 1: Sample / Quick-Start JSON creation
    if (contentType.includes("application/json")) {
      const body = (await req.json()) as {
        filename?: string;
        userPrompt?: string;
        transcriptHint?: string;
        durationSeconds?: number;
        resolution?: string;
        thumbnailUrl?: string;
        videoLanguage?: string;
        categoryId?: string;
        contentTone?: string;
        fileSizeBytes?: number;
      };

      const filename = String(body.filename || "sample-youtube-video.mp4").slice(0, 180);
      const thumb =
        typeof body.thumbnailUrl === "string" &&
        (body.thumbnailUrl.startsWith("/images/") ||
          body.thumbnailUrl.startsWith("data:image/"))
          ? body.thumbnailUrl
          : "/images/thumb-ai-studio.jpg";

      const [created] = await db
        .insert(videos)
        .values({
          channelId: activeChannel?.id ?? null,
          status: "uploaded",
          originalFilename: filename,
          storedPath: null,
          fileSizeBytes: Number(body.fileSizeBytes) || 184_500_000,
          mimeType: "video/mp4",
          durationSeconds: Math.max(15, Number(body.durationSeconds) || 540),
          resolution: String(body.resolution || "1920×1080").slice(0, 30),
          thumbnailUrl: thumb,
          userPrompt: String(body.userPrompt || "").trim().slice(0, 2000),
          transcriptHint: String(body.transcriptHint || "").trim().slice(0, 8000),
          contentTone: String(body.contentTone || "engaging"),
          videoLanguage: String(body.videoLanguage || activeChannel?.defaultLanguage || "ar"),
          metadataLanguage: String(body.videoLanguage || activeChannel?.defaultLanguage || "ar"),
          categoryId: String(body.categoryId || activeChannel?.defaultCategoryId || "28"),
          privacyStatus: activeChannel?.defaultPrivacy || "public",
          madeForKids: false,
          license: "youtube",
          recordingDate: new Date().toISOString().slice(0, 10),
        })
        .returning();

      return NextResponse.json({ video: created }, { status: 201 });
    }

    // Mode 2: Real multipart/form-data file upload saved directly to disk
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: "يرجى اختيار ملف فيديو صالح للرفع." },
        { status: 400 }
      );
    }

    const originalName = path.basename(file.name || "video.mp4").slice(0, 180);
    const rawExt = path.extname(originalName).toLowerCase();
    const ext = ALLOWED_EXT.has(rawExt) ? rawExt : ".mp4";

    if (
      file.type &&
      !file.type.startsWith("video/") &&
      file.type !== "application/octet-stream"
    ) {
      return NextResponse.json(
        { error: "صيغة الملف غير مدعومة — يرجى رفع MP4 أو MOV أو WebM أو MKV." },
        { status: 400 }
      );
    }

    ensureUploadDir();
    const uniqueName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${ext}`;
    const fullDiskPath = path.join(UPLOAD_DIR, uniqueName);
    const relativePath = path.join("uploads", uniqueName);

    const webStream = file.stream();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeStream = Readable.fromWeb(webStream as any);
    await pipeline(nodeStream, fs.createWriteStream(fullDiskPath));

    const userPrompt = String(formData.get("userPrompt") || "").trim().slice(0, 2000);
    const transcriptHint = String(formData.get("transcriptHint") || "").trim().slice(0, 10000);
    const contentTone = String(formData.get("contentTone") || "engaging");
    const videoLanguage = String(
      formData.get("videoLanguage") || activeChannel?.defaultLanguage || "ar"
    );
    const categoryId = String(
      formData.get("categoryId") || activeChannel?.defaultCategoryId || "28"
    );
    const durationSeconds = Math.max(
      0,
      Math.round(Number(formData.get("durationSeconds") || 0))
    );
    const resolution = String(formData.get("resolution") || "1920×1080").slice(0, 30);
    const rawThumb = String(formData.get("thumbnailDataUrl") || "");
    const thumbnailUrl =
      rawThumb.startsWith("data:image/") && rawThumb.length < 1_800_000
        ? rawThumb
        : "/images/thumb-youtube-seo.jpg";

    const [created] = await db
      .insert(videos)
      .values({
        channelId: activeChannel?.id ?? null,
        status: "uploaded",
        originalFilename: originalName,
        storedPath: relativePath,
        fileSizeBytes: file.size,
        mimeType: file.type || "video/mp4",
        durationSeconds,
        resolution,
        thumbnailUrl,
        userPrompt,
        transcriptHint,
        contentTone,
        videoLanguage,
        metadataLanguage: videoLanguage,
        categoryId,
        privacyStatus: activeChannel?.defaultPrivacy || "public",
        madeForKids: false,
        license: "youtube",
        recordingDate: new Date().toISOString().slice(0, 10),
      })
      .returning();

    return NextResponse.json({ video: created }, { status: 201 });
  } catch (err) {
    console.error("POST /api/videos/upload error:", err);
    return NextResponse.json(
      { error: "حدث خطأ أثناء رفع الفيديو وحفظه على الخادم." },
      { status: 500 }
    );
  }
}
