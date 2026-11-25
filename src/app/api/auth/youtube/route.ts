import { NextResponse } from "next/server";
import { createOAuthState } from "@/lib/crypto";
import { buildGoogleAuthUrl } from "@/lib/youtube-api";

export const dynamic = "force-dynamic";

function getPublicOrigin(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const forwardedProto = req.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  if (forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const origin = getPublicOrigin(req);

  try {
    const state = createOAuthState();
    const authUrl = await buildGoogleAuthUrl(origin, state);
    if (!authUrl) {
      return NextResponse.redirect(
        `${origin}/?view=channels&oauth=missing_config`
      );
    }

    const res = NextResponse.redirect(authUrl);
    res.cookies.set("yt_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https://"),
      maxAge: 60 * 15,
      path: "/",
    });
    return res;
  } catch (err) {
    console.error("OAuth init error:", err);
    return NextResponse.redirect(`${origin}/?view=channels&oauth=error`);
  }
}
