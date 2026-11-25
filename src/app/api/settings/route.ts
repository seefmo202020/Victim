import { NextResponse } from "next/server";
import { z } from "zod";
import { getPublicSettingsSummary, upsertSetting } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await getPublicSettingsSummary();
    return NextResponse.json({ settings: summary });
  } catch (err) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json({ error: "تعذّر قراءة الإعدادات" }, { status: 500 });
  }
}

const updateSettingsSchema = z.object({
  googleClientId: z.string().trim().max(300).optional(),
  googleClientSecret: z.string().trim().max(300).optional(),
  clearGoogleSecret: z.boolean().optional(),
  appBaseUrl: z.string().trim().max(300).optional(),
  aiProvider: z.enum(["auto", "openai", "gemini", "builtin"]).optional(),
  openaiApiKey: z.string().trim().max(300).optional(),
  clearOpenaiKey: z.boolean().optional(),
  geminiApiKey: z.string().trim().max(300).optional(),
  clearGeminiKey: z.boolean().optional(),
});

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const parsed = updateSettingsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "بيانات الإعدادات غير صالحة" }, { status: 400 });
    }
    const d = parsed.data;

    if (d.googleClientId !== undefined) {
      await upsertSetting("google_client_id", d.googleClientId);
    }
    if (d.clearGoogleSecret) {
      await upsertSetting("google_client_secret", null);
    } else if (d.googleClientSecret && d.googleClientSecret.length > 0) {
      await upsertSetting("google_client_secret", d.googleClientSecret);
    }
    if (d.appBaseUrl !== undefined) {
      await upsertSetting("app_base_url", d.appBaseUrl);
    }
    if (d.aiProvider !== undefined) {
      await upsertSetting("ai_provider", d.aiProvider);
    }
    if (d.clearOpenaiKey) {
      await upsertSetting("openai_api_key", null);
    } else if (d.openaiApiKey && d.openaiApiKey.length > 0) {
      await upsertSetting("openai_api_key", d.openaiApiKey);
    }
    if (d.clearGeminiKey) {
      await upsertSetting("gemini_api_key", null);
    } else if (d.geminiApiKey && d.geminiApiKey.length > 0) {
      await upsertSetting("gemini_api_key", d.geminiApiKey);
    }

    const summary = await getPublicSettingsSummary();
    return NextResponse.json({ settings: summary, ok: true });
  } catch (err) {
    console.error("PUT /api/settings error:", err);
    return NextResponse.json({ error: "تعذّر حفظ الإعدادات" }, { status: 500 });
  }
}
