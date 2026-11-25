"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle2,
  Link2,
  ShieldCheck,
  Sparkles,
  KeyRound,
  Copy,
  Check,
  Plus,
  Trash2,
  ExternalLink,
  Loader2,
  Radio,
} from "lucide-react";
import type { ChannelDTO, SettingsSummaryDTO } from "@/types/studio";
import {
  VIDEO_LANGUAGES,
  YOUTUBE_CATEGORIES,
  formatCompactNumber,
  getCategoryLabel,
  getLanguageLabel,
} from "@/lib/youtube-constants";

interface ChannelSettingsViewProps {
  channels: ChannelDTO[];
  settings: SettingsSummaryDTO;
  oauthNotice: string | null;
  onRefreshAll: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function ChannelSettingsView({
  channels,
  settings,
  oauthNotice,
  onRefreshAll,
  notify,
}: ChannelSettingsViewProps) {
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Add custom/demo channel form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [newSubs, setNewSubs] = useState("25000");
  const [newLang, setNewLang] = useState("ar");
  const [newCat, setNewCat] = useState("28");
  const [savingChannel, setSavingChannel] = useState(false);

  // Credentials form
  const [googleClientId, setGoogleClientId] = useState(settings.googleClientId);
  const [googleClientSecret, setGoogleClientSecret] = useState("");
  const [appBaseUrl, setAppBaseUrl] = useState(settings.appBaseUrl);
  const [aiProvider, setAiProvider] = useState(settings.aiProvider);
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  useEffect(() => {
    setGoogleClientId(settings.googleClientId);
    setAppBaseUrl(settings.appBaseUrl);
    setAiProvider(settings.aiProvider);
  }, [settings]);

  const redirectUri = `${(appBaseUrl || origin).replace(/\/+$/, "")}/api/auth/youtube/callback`;

  const copyRedirect = async () => {
    await navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    notify("تم نسخ رابط Redirect URI لاستخدامه في Google Cloud Console.", "success");
    setTimeout(() => setCopiedRedirect(false), 1800);
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSavingSettings(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          googleClientId: googleClientId.trim(),
          ...(googleClientSecret.trim()
            ? { googleClientSecret: googleClientSecret.trim() }
            : {}),
          appBaseUrl: appBaseUrl.trim(),
          aiProvider,
          ...(openaiKey.trim() ? { openaiApiKey: openaiKey.trim() } : {}),
          ...(geminiKey.trim() ? { geminiApiKey: geminiKey.trim() } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر حفظ المفاتيح");
      setGoogleClientSecret("");
      setOpenaiKey("");
      setGeminiKey("");
      await onRefreshAll();
      notify("تم حفظ المفاتيح مشفّرةً بنجاح (AES-256-GCM)!", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "خطأ في الحفظ", "error");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleClearSecret = async (
    field: "clearGoogleSecret" | "clearOpenaiKey" | "clearGeminiKey"
  ) => {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: true }),
    });
    if (res.ok) {
      await onRefreshAll();
      notify("تم مسح المفتاح بأمان.", "info");
    }
  };

  const handleAddDemoChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      setSavingChannel(true);
      const res = await fetch("/api/channels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          handle: newHandle.trim(),
          subscriberCount: Number(newSubs) || 0,
          defaultLanguage: newLang,
          defaultCategoryId: newCat,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر ربط القناة");
      setNewTitle("");
      setNewHandle("");
      setShowAddForm(false);
      await onRefreshAll();
      notify(`تم ربط وتفعيل قناة «${data.channel.title}» بنجاح!`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "خطأ", "error");
    } finally {
      setSavingChannel(false);
    }
  };

  const handleActivateChannel = async (id: number) => {
    const res = await fetch("/api/channels", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, isActive: true }),
    });
    if (res.ok) {
      await onRefreshAll();
      notify("تم تفعيل القناة كالقناة الافتراضية للنشر.", "success");
    }
  };

  const handleDeleteChannel = async (id: number) => {
    const res = await fetch(`/api/channels?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      await onRefreshAll();
      notify("تم فصل القناة بنجاح.", "info");
    }
  };

  return (
    <div className="mx-auto max-w-[1040px] space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111216]">
          ربط قناة اليوتيوب ومفاتيح API
        </h1>
        <p className="mt-1 text-sm text-[#606470]">
          اربط قناتك الرسمية عبر Google OAuth 2.0 لرفع الفيديوهات والترجمات مباشرة، واضبط محرك الذكاء الاصطناعي المفضّل لديك.
        </p>
      </div>

      {oauthNotice && (
        <div
          className={`rounded-2xl border px-5 py-3.5 text-sm font-semibold ${
            oauthNotice === "connected"
              ? "border-[#B7F0D8] bg-[#ECFDF5] text-[#066E49]"
              : "border-[#FDE68A] bg-[#FFFBEB] text-[#92400E]"
          }`}
        >
          {oauthNotice === "connected"
            ? "تم ربط قناة اليوتيوب الخاصة بك بنجاح عبر Google OAuth 2.0! يمكنك الآن رفع الفيديوهات ونشرها مباشرة."
            : oauthNotice === "missing_config"
              ? "أدخل Google Client ID و Client Secret بالأسفل أولاً، ثم اضغط «ربط عبر Google» لتوصيل قناتك الحقيقية."
              : "لم تكتمل عملية الربط عبر Google — تأكد من صحة Redirect URI وأعد المحاولة."}
        </div>
      )}

      {/* Primary OAuth CTA Banner + Connected Channels */}
      <section className="studio-card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#F0F0F4] p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF1F2] text-[#E5192D]">
              <Radio className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-[#111216]">
                القنوات المرتبطة ({channels.length})
              </h2>
              <p className="text-xs text-[#6B707D]">
                صلاحيات: youtube.upload · youtube.force-ssl (الترجمات) · youtube.readonly
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E3EA] bg-white px-3.5 py-2.5 text-xs font-bold text-[#2A2D36] hover:bg-[#F5F5F8]"
            >
              <Plus className="h-3.5 w-3.5" />
              إضافة قناة للاختبار
            </button>

            {settings.isGoogleConfigured ? (
              <a
                href="/api/auth/youtube"
                className="inline-flex items-center gap-2 rounded-xl bg-[#E5192D] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#C81224]"
              >
                <Link2 className="h-4 w-4" />
                ربط قناتك عبر Google OAuth
              </a>
            ) : (
              <a
                href="#google-api-box"
                className="inline-flex items-center gap-2 rounded-xl bg-[#E5192D] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#C81224]"
              >
                <KeyRound className="h-4 w-4" />
                فعّل مفاتيح Google للربط المباشر
              </a>
            )}
          </div>
        </div>

        {/* Inline add demo channel form */}
        {showAddForm && (
          <form
            onSubmit={handleAddDemoChannel}
            className="grid gap-3 border-b border-[#F0F0F4] bg-[#FAFAFC] p-5 sm:grid-cols-6"
          >
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-bold text-[#525560]">
                اسم القناة *
              </label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="مثال: قناة أحمد التقنية"
                className="studio-input px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#525560]">
                المعرّف Handle
              </label>
              <input
                type="text"
                dir="ltr"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                placeholder="@AhmadTech"
                className="studio-input px-3 py-2 text-xs"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#525560]">
                المشتركون
              </label>
              <input
                type="number"
                min={0}
                value={newSubs}
                onChange={(e) => setNewSubs(e.target.value)}
                className="studio-input px-3 py-2 text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold text-[#525560]">
                اللغة والتصنيف
              </label>
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
                className="studio-input px-2.5 py-2 text-xs"
              >
                {VIDEO_LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <select
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                className="hidden"
              >
                {YOUTUBE_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={savingChannel}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#111216] px-4 py-2 text-xs font-bold text-white hover:bg-[#2A2D36] disabled:opacity-60"
              >
                {savingChannel && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                حفظ وربط
              </button>
            </div>
          </form>
        )}

        {/* Channels list */}
        <div className="divide-y divide-[#F0F0F4]">
          {channels.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#6B707D]">
              لا توجد قنوات مربوطة حالياً — اضغط «ربط قناتك عبر Google OAuth» أو أضف قناة للاختبار.
            </div>
          ) : (
            channels.map((ch) => (
              <div
                key={ch.id}
                className="flex flex-wrap items-center justify-between gap-4 px-6 py-4"
              >
                <div className="flex items-center gap-3.5">
                  <img
                    src={ch.avatarUrl || "/images/channel-avatar.jpg"}
                    alt={ch.title}
                    className="h-12 w-12 rounded-full border border-[#E6E7EE] object-cover"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-extrabold text-[#111216]">
                        {ch.title}
                      </span>
                      <span dir="ltr" className="text-xs text-[#7B7F8C]">
                        {ch.handle}
                      </span>
                      {ch.isActive && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#066E49]">
                          <CheckCircle2 className="h-3 w-3" />
                          القناة النشطة
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          ch.connectionMode === "oauth"
                            ? "bg-[#FFF1F2] text-[#C81224]"
                            : "bg-[#F3F4F6] text-[#525560]"
                        }`}
                      >
                        {ch.connectionMode === "oauth" ? "YouTube OAuth حقيقي" : "تجريبي"}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-[#6B707D] tabular-nums">
                      {formatCompactNumber(ch.subscriberCount)} مشترك · {ch.videoCount} فيديو ·{" "}
                      {formatCompactNumber(ch.viewCount)} مشاهدة ·{" "}
                      {getLanguageLabel(ch.defaultLanguage)} ·{" "}
                      {getCategoryLabel(ch.defaultCategoryId)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {!ch.isActive && (
                    <button
                      type="button"
                      onClick={() => void handleActivateChannel(ch.id)}
                      className="rounded-xl border border-[#E2E3EA] bg-white px-3 py-1.5 text-xs font-bold text-[#111216] hover:bg-[#F4F4F7]"
                    >
                      تفعيل للنشر
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleDeleteChannel(ch.id)}
                    aria-label="فصل القناة"
                    className="rounded-xl border border-[#F2E4E6] p-2 text-[#B91C1C] hover:bg-[#FFF1F2]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Google OAuth + AI Credentials Form */}
      <form
        id="google-api-box"
        onSubmit={handleSaveSettings}
        className="grid gap-6 lg:grid-cols-2"
      >
        {/* Google YouTube Data API v3 */}
        <section className="studio-card flex flex-col justify-between space-y-4 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FFF1F2] text-[#E5192D]">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#111216]">
                    YouTube Data API v3 (OAuth 2.0)
                  </h3>
                  <p className="text-[11px] text-[#7B7F8C]">
                    من Google Cloud Console — تُحفظ مشفّرة بالكامل
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                  settings.isGoogleConfigured
                    ? "bg-[#ECFDF5] text-[#066E49]"
                    : "bg-[#F3F4F6] text-[#6B707D]"
                }`}
              >
                {settings.isGoogleConfigured ? "مُفعّل" : "غير مضبوط"}
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#2A2D36]">
                Authorized Redirect URI (انسخه إلى Google Cloud)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  dir="ltr"
                  value={redirectUri}
                  className="studio-input bg-[#F8F8FA] px-3 py-2 font-mono text-[11px] text-[#3A3D47]"
                />
                <button
                  type="button"
                  onClick={() => void copyRedirect()}
                  className="shrink-0 rounded-xl border border-[#E2E3EA] bg-white p-2 text-[#2A2D36] hover:bg-[#F4F4F7]"
                  title="نسخ"
                >
                  {copiedRedirect ? (
                    <Check className="h-4 w-4 text-[#0B875B]" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#2A2D36]">
                Google Client ID
              </label>
              <input
                type="text"
                dir="ltr"
                value={googleClientId}
                onChange={(e) => setGoogleClientId(e.target.value)}
                placeholder="1234567890-xxxx.apps.googleusercontent.com"
                className="studio-input px-3 py-2.5 font-mono text-xs"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-bold text-[#2A2D36]">
                  Google Client Secret
                </label>
                {settings.hasGoogleClientSecret && (
                  <button
                    type="button"
                    onClick={() => void handleClearSecret("clearGoogleSecret")}
                    className="text-[11px] font-semibold text-[#C81224] hover:underline"
                  >
                    مسح ({settings.googleClientSecretMasked})
                  </button>
                )}
              </div>
              <input
                type="password"
                dir="ltr"
                value={googleClientSecret}
                onChange={(e) => setGoogleClientSecret(e.target.value)}
                placeholder={
                  settings.hasGoogleClientSecret
                    ? "محفوظ ومشفّر — اكتب قيمة جديدة للتحديث"
                    : "GOCSPX-..."
                }
                className="studio-input px-3 py-2.5 font-mono text-xs"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#2A2D36]">
                رابط الموقع العام (مثل https://your-app.bonto.page)
              </label>
              <input
                type="url"
                dir="ltr"
                value={appBaseUrl}
                onChange={(e) => setAppBaseUrl(e.target.value)}
                placeholder="https://studio.yourdomain.com"
                className="studio-input px-3 py-2.5 font-mono text-xs"
              />
            </div>
          </div>

          <a
            href="https://console.cloud.google.com/apis/library/youtube.googleapis.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B3DF5] hover:underline"
          >
            فتح Google Cloud Console لتفعيل YouTube API v3
            <ExternalLink className="h-3 w-3" />
          </a>
        </section>

        {/* AI Engine Configuration */}
        <section className="studio-card flex flex-col justify-between space-y-4 p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#F3F0FF] text-[#5B3DF5]">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-[#111216]">
                    محرك الذكاء الاصطناعي والسيو
                  </h3>
                  <p className="text-[11px] text-[#7B7F8C]">
                    يعمل تلقائياً بدون مفتاح، ويمكن ربط OpenAI أو Gemini لقوة أكبر
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-[#F3F0FF] px-2.5 py-0.5 text-[10px] font-bold text-[#5B3DF5]">
                {settings.activeAiEngine === "openai"
                  ? "OpenAI"
                  : settings.activeAiEngine === "gemini"
                    ? "Gemini"
                    : "مدمج مجاني"}
              </span>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-[#2A2D36]">
                اختيار المحرك النشط
              </label>
              <select
                value={aiProvider}
                onChange={(e) =>
                  setAiProvider(e.target.value as SettingsSummaryDTO["aiProvider"])
                }
                className="studio-input px-3 py-2.5 text-xs font-semibold"
              >
                <option value="auto">تلقائي (OpenAI ← Gemini ← المدمج)</option>
                <option value="openai">OpenAI (GPT-4o mini)</option>
                <option value="gemini">Google Gemini (2.0 Flash)</option>
                <option value="builtin">المحرك العربي المدمج (مجاني بدون API)</option>
              </select>
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-bold text-[#2A2D36]">
                  OpenAI API Key (اختياري)
                </label>
                {settings.hasOpenaiKey && (
                  <button
                    type="button"
                    onClick={() => void handleClearSecret("clearOpenaiKey")}
                    className="text-[11px] font-semibold text-[#C81224] hover:underline"
                  >
                    مسح ({settings.openaiKeyMasked})
                  </button>
                )}
              </div>
              <input
                type="password"
                dir="ltr"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder={
                  settings.hasOpenaiKey ? "محفوظ ومشفّر — أدخل مفتاحاً جديداً" : "sk-..."
                }
                className="studio-input px-3 py-2.5 font-mono text-xs"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-bold text-[#2A2D36]">
                  Google Gemini API Key (اختياري — مجاني جزئياً)
                </label>
                {settings.hasGeminiKey && (
                  <button
                    type="button"
                    onClick={() => void handleClearSecret("clearGeminiKey")}
                    className="text-[11px] font-semibold text-[#C81224] hover:underline"
                  >
                    مسح ({settings.geminiKeyMasked})
                  </button>
                )}
              </div>
              <input
                type="password"
                dir="ltr"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder={
                  settings.hasGeminiKey ? "محفوظ ومشفّر — أدخل مفتاحاً جديداً" : "AIza..."
                }
                className="studio-input px-3 py-2.5 font-mono text-xs"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111216] px-5 py-3 text-xs font-bold text-white transition hover:bg-[#2A2D36] disabled:opacity-60"
          >
            {savingSettings ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            حفظ جميع الإعدادات والمفاتيح
          </button>
        </section>
      </form>
    </div>
  );
}
