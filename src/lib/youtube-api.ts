import fs from "fs";
import path from "path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  youtubeChannels,
  type YoutubeChannel,
  type VideoRecord,
  type VideoCaption,
  type PublishLogEntry,
} from "@/db/schema";
import { decryptText, encryptText } from "./crypto";
import { getRuntimeConfig } from "./settings";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const YT_API_BASE = "https://www.googleapis.com/youtube/v3";
const YT_UPLOAD_BASE = "https://www.googleapis.com/upload/youtube/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.upload",
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/youtube.force-ssl",
];

export function resolveRedirectUri(requestOrigin: string, configuredBase?: string): string {
  const base = (configuredBase || requestOrigin).replace(/\/+$/, "");
  return `${base}/api/auth/youtube/callback`;
}

export async function buildGoogleAuthUrl(requestOrigin: string, state: string): Promise<string | null> {
  const cfg = await getRuntimeConfig();
  if (!cfg.isGoogleConfigured) return null;

  const redirectUri = resolveRedirectUri(requestOrigin, cfg.appBaseUrl);
  const params = new URLSearchParams({
    client_id: cfg.googleClientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, requestOrigin: string) {
  const cfg = await getRuntimeConfig();
  if (!cfg.isGoogleConfigured) {
    throw new Error("Google OAuth credentials are not configured.");
  }
  const redirectUri = resolveRedirectUri(requestOrigin, cfg.appBaseUrl);
  const body = new URLSearchParams({
    code,
    client_id: cfg.googleClientId,
    client_secret: cfg.googleClientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const data = (await resp.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || data.error || "Failed to exchange OAuth code");
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || "",
    expiresAt: new Date(Date.now() + (data.expires_in || 3500) * 1000),
  };
}

export async function getValidAccessToken(channel: YoutubeChannel): Promise<string> {
  const current = decryptText(channel.accessTokenEnc);
  const refresh = decryptText(channel.refreshTokenEnc);

  const isExpired =
    !channel.tokenExpiresAt ||
    channel.tokenExpiresAt.getTime() < Date.now() + 90_000;

  if (current && !isExpired) return current;

  if (!refresh) {
    throw new Error("انتهت صلاحية جلسة يوتيوب — يرجى إعادة ربط القناة عبر Google OAuth.");
  }

  const cfg = await getRuntimeConfig();
  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: cfg.googleClientId,
      client_secret: cfg.googleClientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });

  const data = (await resp.json()) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!resp.ok || !data.access_token) {
    throw new Error(data.error_description || "تعذّر تجديد توكن قناة يوتيوب");
  }

  const expiresAt = new Date(Date.now() + (data.expires_in || 3500) * 1000);
  await db
    .update(youtubeChannels)
    .set({
      accessTokenEnc: encryptText(data.access_token),
      tokenExpiresAt: expiresAt,
      updatedAt: new Date(),
    })
    .where(eq(youtubeChannels.id, channel.id));

  return data.access_token;
}

export async function fetchAuthenticatedChannel(accessToken: string) {
  const resp = await fetch(
    `${YT_API_BASE}/channels?part=snippet,statistics&mine=true`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!resp.ok) {
    throw new Error("تعذر قراءة بيانات قناة اليوتيوب من Google API");
  }
  const data = (await resp.json()) as {
    items?: Array<{
      id: string;
      snippet?: {
        title?: string;
        customUrl?: string;
        description?: string;
        defaultLanguage?: string;
        thumbnails?: { high?: { url?: string }; default?: { url?: string } };
      };
      statistics?: {
        subscriberCount?: string;
        videoCount?: string;
        viewCount?: string;
      };
    }>;
  };

  const ch = data.items?.[0];
  if (!ch) {
    throw new Error("لم يتم العثور على قناة يوتيوب مرتبطة بهذا الحساب.");
  }

  return {
    youtubeChannelId: ch.id,
    title: ch.snippet?.title || "قناتي على يوتيوب",
    handle: ch.snippet?.customUrl || `@channel_${ch.id.slice(-6)}`,
    description: ch.snippet?.description || "",
    avatarUrl:
      ch.snippet?.thumbnails?.high?.url ||
      ch.snippet?.thumbnails?.default?.url ||
      "/images/channel-avatar.jpg",
    subscriberCount: Number(ch.statistics?.subscriberCount || 0),
    videoCount: Number(ch.statistics?.videoCount || 0),
    viewCount: Number(ch.statistics?.viewCount || 0),
    defaultLanguage: ch.snippet?.defaultLanguage || "ar",
  };
}

function fitTagsForYoutube(rawTags: string[]): string[] {
  const out: string[] = [];
  let sum = 0;
  for (const tag of rawTags) {
    const clean = tag.replace(/[<>]/g, "").trim();
    if (!clean) continue;
    const add = clean.length + (out.length ? 1 : 0);
    if (sum + add > 495) break;
    sum += add;
    out.push(clean);
  }
  return out;
}

export async function uploadVideoToYoutubeReal(params: {
  channel: YoutubeChannel;
  video: VideoRecord;
  captions: VideoCaption[];
}): Promise<{ youtubeVideoId: string; youtubeUrl: string; log: PublishLogEntry[] }> {
  const log: PublishLogEntry[] = [];
  const now = () => new Date().toISOString();

  const accessToken = await getValidAccessToken(params.channel);
  log.push({
    step: "التحقق من ربط القناة",
    status: "done",
    detail: `تم التحقق من صلاحيات قناة ${params.channel.title}`,
    at: now(),
  });

  if (!params.video.storedPath) {
    throw new Error("ملف الفيديو غير موجود على الخادم — ارفع ملف فيديو حقيقي أولاً.");
  }

  const safeFile = path.basename(params.video.storedPath);
  const absolutePath = path.join(process.cwd(), "uploads", safeFile);
  if (!safeFile || !fs.existsSync(absolutePath)) {
    throw new Error("تعذر العثور على ملف الفيديو المخزّن على القرص.");
  }
  const stat = fs.statSync(absolutePath);
  const fileBuffer = fs.readFileSync(absolutePath);

  const isScheduled =
    params.video.privacyStatus === "scheduled" && Boolean(params.video.scheduledAt);
  const privacyStatus = isScheduled ? "private" : params.video.privacyStatus || "public";

  const tags = fitTagsForYoutube((params.video.tags || []).map((t) => t.text));

  // Ensure hashtags appear cleanly in description
  let fullDesc = params.video.description || "";
  const missingTags = (params.video.hashtags || []).filter(
    (h) => !fullDesc.includes(h)
  );
  if (missingTags.length > 0) {
    fullDesc = `${fullDesc.trim()}\n\n${missingTags.join(" ")}`.trim();
  }

  const metadata: Record<string, unknown> = {
    snippet: {
      title: (params.video.title || params.video.originalFilename).slice(0, 100),
      description: fullDesc.slice(0, 5000),
      tags,
      categoryId: params.video.categoryId || "28",
      defaultLanguage: params.video.metadataLanguage || params.video.videoLanguage || "ar",
      defaultAudioLanguage: params.video.videoLanguage || "ar",
    },
    status: {
      privacyStatus,
      embeddable: params.video.allowEmbedding,
      license: params.video.license === "creativeCommon" ? "creativeCommon" : "youtube",
      publicStatsViewable: true,
      selfDeclaredMadeForKids: Boolean(params.video.madeForKids),
      ...(isScheduled && params.video.scheduledAt
        ? { publishAt: params.video.scheduledAt.toISOString() }
        : {}),
    },
  };

  if (params.video.recordingLocation || params.video.recordingDate) {
    metadata.recordingDetails = {
      ...(params.video.recordingLocation
        ? { locationDescription: params.video.recordingLocation }
        : {}),
      ...(params.video.recordingDate
        ? { recordingDate: new Date(params.video.recordingDate).toISOString() }
        : {}),
    };
  }

  // Step 1: Start YouTube resumable upload session
  const initResp = await fetch(
    `${YT_UPLOAD_BASE}/videos?uploadType=resumable&part=snippet,status,recordingDetails&notifySubscribers=${params.video.notifySubscribers ? "true" : "false"}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Length": String(stat.size),
        "X-Upload-Content-Type": params.video.mimeType || "video/mp4",
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!initResp.ok) {
    const errText = await initResp.text();
    throw new Error(`فشل بدء رفع الفيديو إلى يوتيوب: ${errText.slice(0, 260)}`);
  }

  const uploadUrl = initResp.headers.get("location");
  if (!uploadUrl) {
    throw new Error("لم يُرجع YouTube API رابط الرفع القابل للاستئناف.");
  }

  // Step 2: Upload binary file content
  const putResp = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": String(stat.size),
      "Content-Type": params.video.mimeType || "video/mp4",
    },
    body: fileBuffer,
  });

  const uploaded = (await putResp.json()) as { id?: string; error?: { message?: string } };
  if (!putResp.ok || !uploaded.id) {
    throw new Error(uploaded.error?.message || "حدث خطأ أثناء رفع ملف الفيديو إلى يوتيوب");
  }

  const youtubeVideoId = uploaded.id;
  log.push({
    step: "رفع الفيديو وتطبيق بيانات السيو",
    status: "done",
    detail: `تم رفع الفيديو بنجاح (${tags.length} كلمة مفتاحية + الإعدادات واللغة) — ID: ${youtubeVideoId}`,
    at: now(),
  });

  // Step 3: Optional custom thumbnail upload
  if (params.video.thumbnailUrl?.startsWith("data:image/")) {
    try {
      const match = params.video.thumbnailUrl.match(/^data:(image\/(?:jpeg|png));base64,(.+)$/);
      if (match) {
        const mime = match[1];
        const buf = Buffer.from(match[2], "base64");
        const tResp = await fetch(
          `${YT_UPLOAD_BASE}/thumbnails/set?videoId=${encodeURIComponent(youtubeVideoId)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": mime,
            },
            body: buf,
          }
        );
        log.push({
          step: "رفع الصورة المصغرة",
          status: tResp.ok ? "done" : "skipped",
          detail: tResp.ok
            ? "تم تعيين الصورة المصغرة المخصصة بنجاح"
            : "تتطلب الصورة المصغرة تفعيل القناة (حساب يوتيوب موثّق)",
          at: now(),
        });
      }
    } catch {
      log.push({
        step: "رفع الصورة المصغرة",
        status: "skipped",
        detail: "تم التخطي — يمكن رفعها من YouTube Studio",
        at: now(),
      });
    }
  }

  // Step 4: Upload all enabled SRT subtitle tracks
  const enabledCaptions = params.captions.filter(
    (c) => c.includeInUpload && c.srtContent.trim().length > 0
  );
  for (const cap of enabledCaptions) {
    try {
      const boundary = `tubesmart_${Date.now()}_${cap.languageCode}`;
      const snippetJson = JSON.stringify({
        snippet: {
          videoId: youtubeVideoId,
          language: cap.languageCode,
          name: cap.languageName,
          isDraft: false,
        },
      });
      const multipartBody = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        snippetJson,
        `--${boundary}`,
        "Content-Type: application/octet-stream",
        "",
        cap.srtContent,
        `--${boundary}--`,
      ].join("\r\n");

      const capResp = await fetch(
        `${YT_UPLOAD_BASE}/captions?uploadType=multipart&part=snippet&sync=${cap.isAutoSync ? "true" : "false"}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": `multipart/related; boundary=${boundary}`,
          },
          body: multipartBody,
        }
      );

      log.push({
        step: `رفع ترجمة (${cap.languageCode.toUpperCase()})`,
        status: capResp.ok ? "done" : "skipped",
        detail: capResp.ok
          ? `تمت إضافة ملف ترجمة ${cap.languageName} بنجاح`
          : `تعذّر رفع ترجمة ${cap.languageName} تلقائياً`,
        at: now(),
      });
    } catch {
      log.push({
        step: `رفع ترجمة (${cap.languageCode.toUpperCase()})`,
        status: "skipped",
        detail: `تم حفظ ملف SRT ${cap.languageName} للتنزيل اليدوي`,
        at: now(),
      });
    }
  }

  return {
    youtubeVideoId,
    youtubeUrl: `https://www.youtube.com/watch?v=${youtubeVideoId}`,
    log,
  };
}
