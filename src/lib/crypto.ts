import crypto from "crypto";

function getDerivedKey(): Buffer {
  const secret =
    process.env.APP_ENCRYPTION_KEY ||
    process.env.NEXTAUTH_SECRET ||
    `tubesmart-local-key:${process.env.DATABASE_URL || "default-dev-salt"}`;
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptText(plain: string): string {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptText(payload: string | null | undefined): string {
  if (!payload) return "";
  try {
    const parts = payload.split(".");
    if (parts.length !== 3) return payload;
    const [ivB64, tagB64, dataB64] = parts;
    const key = getDerivedKey();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return "";
  }
}

export function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "••••••••";
  return `${value.slice(0, 4)}••••••${value.slice(-4)}`;
}

export function createOAuthState(): string {
  const nonce = crypto.randomBytes(16).toString("hex");
  const ts = Date.now().toString();
  const payload = `${nonce}.${ts}`;
  const sig = crypto
    .createHmac("sha256", getDerivedKey())
    .update(payload)
    .digest("hex");
  return `${payload}.${sig}`;
}

export function verifyOAuthState(state: string): boolean {
  const parts = state.split(".");
  if (parts.length !== 3) return false;
  const [nonce, ts, sig] = parts;
  const ageMs = Date.now() - Number(ts);
  if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 20 * 60 * 1000) {
    return false;
  }
  const expected = crypto
    .createHmac("sha256", getDerivedKey())
    .update(`${nonce}.${ts}`)
    .digest("hex");
  if (sig.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}
