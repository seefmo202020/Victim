import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { youtubeChannels } from "@/db/schema";
import { encryptText, verifyOAuthState } from "@/lib/crypto";
import {
  exchangeCodeForTokens,
  fetchAuthenticatedChannel,
} from "@/lib/youtube-api";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  const origin = forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : `${url.protocol}//${url.host}`;
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state") || "";
  const cookieState = req.cookies.get("yt_oauth_state")?.value || "";

  if (error || !code) {
    return NextResponse.redirect(
      `${origin}/?view=channels&oauth=${encodeURIComponent(error || "denied")}`
    );
  }

  if (!verifyOAuthState(state) || (cookieState && cookieState !== state)) {
    return NextResponse.redirect(`${origin}/?view=channels&oauth=invalid_state`);
  }

  try {
    const tokens = await exchangeCodeForTokens(code, origin);
    const channelData = await fetchAuthenticatedChannel(tokens.accessToken);

    await db.update(youtubeChannels).set({ isActive: false });

    const existing = await db
      .select()
      .from(youtubeChannels)
      .where(eq(youtubeChannels.youtubeChannelId, channelData.youtubeChannelId));

    const encAccess = encryptText(tokens.accessToken);
    const encRefresh = tokens.refreshToken
      ? encryptText(tokens.refreshToken)
      : existing[0]?.refreshTokenEnc || null;

    if (existing[0]) {
      await db
        .update(youtubeChannels)
        .set({
          title: channelData.title,
          handle: channelData.handle,
          description: channelData.description,
          avatarUrl: channelData.avatarUrl,
          subscriberCount: channelData.subscriberCount,
          videoCount: channelData.videoCount,
          viewCount: channelData.viewCount,
          connectionMode: "oauth",
          accessTokenEnc: encAccess,
          refreshTokenEnc: encRefresh,
          tokenExpiresAt: tokens.expiresAt,
          defaultLanguage: channelData.defaultLanguage || "ar",
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(youtubeChannels.id, existing[0].id));
    } else {
      await db.insert(youtubeChannels).values({
        youtubeChannelId: channelData.youtubeChannelId,
        title: channelData.title,
        handle: channelData.handle,
        description: channelData.description,
        avatarUrl: channelData.avatarUrl,
        subscriberCount: channelData.subscriberCount,
        videoCount: channelData.videoCount,
        viewCount: channelData.viewCount,
        connectionMode: "oauth",
        accessTokenEnc: encAccess,
        refreshTokenEnc: encRefresh,
        tokenExpiresAt: tokens.expiresAt,
        defaultLanguage: channelData.defaultLanguage || "ar",
        defaultCategoryId: "28",
        defaultPrivacy: "public",
        isActive: true,
      });
    }

    const res = NextResponse.redirect(`${origin}/?view=channels&oauth=connected`);
    res.cookies.delete("yt_oauth_state");
    return res;
  } catch (err) {
    console.error("OAuth callback error:", err);
    const msg = err instanceof Error ? err.message : "oauth_failed";
    return NextResponse.redirect(
      `${origin}/?view=channels&oauth=failed&msg=${encodeURIComponent(msg.slice(0, 120))}`
    );
  }
}
