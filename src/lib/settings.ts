import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";
import { decryptText, encryptText, maskSecret } from "./crypto";

export const SETTING_KEYS = [
  "google_client_id",
  "google_client_secret",
  "app_base_url",
  "ai_provider",
  "openai_api_key",
  "gemini_api_key",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

const SECRET_KEYS = new Set<SettingKey>([
  "google_client_secret",
  "openai_api_key",
  "gemini_api_key",
]);

const ENV_MAP: Record<SettingKey, string> = {
  google_client_id: "GOOGLE_CLIENT_ID",
  google_client_secret: "GOOGLE_CLIENT_SECRET",
  app_base_url: "APP_BASE_URL",
  ai_provider: "AI_PROVIDER",
  openai_api_key: "OPENAI_API_KEY",
  gemini_api_key: "GEMINI_API_KEY",
};

export interface RuntimeConfig {
  googleClientId: string;
  googleClientSecret: string;
  appBaseUrl: string;
  aiProvider: "auto" | "openai" | "gemini" | "builtin";
  openaiApiKey: string;
  geminiApiKey: string;
  isGoogleConfigured: boolean;
  activeAiEngine: "openai" | "gemini" | "builtin";
}

export async function getRuntimeConfig(): Promise<RuntimeConfig> {
  const rows = await db.select().from(appSettings);
  const map = new Map<string, string>();
  for (const row of rows) {
    const val = row.isSecret ? decryptText(row.valueEnc) : row.valueEnc;
    if (val) map.set(row.key, val);
  }

  const pick = (key: SettingKey): string => {
    const dbVal = map.get(key);
    if (dbVal && dbVal.trim().length > 0) return dbVal.trim();
    const envName = ENV_MAP[key];
    return (process.env[envName] || "").trim();
  };

  const googleClientId = pick("google_client_id");
  const googleClientSecret = pick("google_client_secret");
  const appBaseUrl = pick("app_base_url").replace(/\/+$/, "");
  const rawProvider = pick("ai_provider") || "auto";
  const aiProvider = (
    ["auto", "openai", "gemini", "builtin"].includes(rawProvider)
      ? rawProvider
      : "auto"
  ) as RuntimeConfig["aiProvider"];
  const openaiApiKey = pick("openai_api_key");
  const geminiApiKey = pick("gemini_api_key");

  let activeAiEngine: RuntimeConfig["activeAiEngine"] = "builtin";
  if (aiProvider === "openai" && openaiApiKey) activeAiEngine = "openai";
  else if (aiProvider === "gemini" && geminiApiKey) activeAiEngine = "gemini";
  else if (aiProvider === "auto") {
    if (openaiApiKey) activeAiEngine = "openai";
    else if (geminiApiKey) activeAiEngine = "gemini";
    else activeAiEngine = "builtin";
  }

  return {
    googleClientId,
    googleClientSecret,
    appBaseUrl,
    aiProvider,
    openaiApiKey,
    geminiApiKey,
    isGoogleConfigured: Boolean(googleClientId && googleClientSecret),
    activeAiEngine,
  };
}

export async function getPublicSettingsSummary() {
  const cfg = await getRuntimeConfig();
  return {
    googleClientId: cfg.googleClientId,
    hasGoogleClientSecret: Boolean(cfg.googleClientSecret),
    googleClientSecretMasked: maskSecret(cfg.googleClientSecret),
    appBaseUrl: cfg.appBaseUrl,
    aiProvider: cfg.aiProvider,
    hasOpenaiKey: Boolean(cfg.openaiApiKey),
    openaiKeyMasked: maskSecret(cfg.openaiApiKey),
    hasGeminiKey: Boolean(cfg.geminiApiKey),
    geminiKeyMasked: maskSecret(cfg.geminiApiKey),
    isGoogleConfigured: cfg.isGoogleConfigured,
    activeAiEngine: cfg.activeAiEngine,
  };
}

export async function upsertSetting(key: SettingKey, value: string | null) {
  const trimmed = (value ?? "").trim();
  if (!trimmed) {
    await db.delete(appSettings).where(eq(appSettings.key, key));
    return;
  }
  const isSecret = SECRET_KEYS.has(key);
  const stored = isSecret ? encryptText(trimmed) : trimmed;

  const existing = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.key, key));

  if (existing.length > 0) {
    await db
      .update(appSettings)
      .set({ valueEnc: stored, isSecret, updatedAt: new Date() })
      .where(eq(appSettings.key, key));
  } else {
    await db.insert(appSettings).values({
      key,
      valueEnc: stored,
      isSecret,
      updatedAt: new Date(),
    });
  }
}
