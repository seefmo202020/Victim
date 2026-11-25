"use client";

import { useState } from "react";
import {
  Copy,
  Check,
  GitBranch,
  Database,
  KeyRound,
  Rocket,
  ExternalLink,
  AlertTriangle,
  Terminal,
} from "lucide-react";

interface BontoDeployViewProps {
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

export function BontoDeployView({ notify }: BontoDeployViewProps) {
  const [appName, setAppName] = useState("tubesmart");
  const [repoUrl, setRepoUrl] = useState("https://github.com/username/tubesmart-ai.git");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const safeApp = (appName.trim() || "tubesmart").toLowerCase().replace(/[^a-z0-9-]/g, "-");
  const safeRepo = repoUrl.trim() || "https://github.com/username/tubesmart-ai.git";
  const liveUrl = `https://${safeApp}.bonto.page`;
  const redirectUri = `${liveUrl}/api/auth/youtube/callback`;

  const copy = async (id: string, text: string, label: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    notify(`تم نسخ ${label}`, "success");
    setTimeout(() => setCopiedId(null), 1800);
  };

  const envBlock = `DATABASE_URL=postgresql://USER:PASSWORD@HOST/DBNAME?sslmode=require
APP_BASE_URL=${liveUrl}
APP_ENCRYPTION_KEY=ضع-هنا-مفتاح-عشوائي-طويل-64-حرف
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxx
AI_PROVIDER=auto
OPENAI_API_KEY=
GEMINI_API_KEY=
NODE_ENV=production`;

  const steps = [
    {
      id: "github",
      icon: GitBranch,
      title: "1. ارفع الكود على GitHub",
      desc: "ملف .env ومجلد uploads مستبعدان تلقائياً من الرفع (موجودان في .gitignore).",
      code: `git init
git add .
git commit -m "TubeSmart AI - YouTube uploader"
git branch -M main
git remote add origin ${safeRepo}
git push -u origin main`,
    },
    {
      id: "db",
      icon: Database,
      title: "2. أنشئ قاعدة بيانات PostgreSQL مجانية (Neon أو Supabase)",
      desc: "Bonto لا يوفر قاعدة بيانات — أنشئ مشروعاً مجانياً على neon.tech وانسخ رابط الاتصال (Connection string).",
      code: `# مثال على شكل الرابط من Neon:
postgresql://neondb_owner:PASSWORD@ep-xxxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

# الجداول تُنشأ تلقائياً أثناء البناء على Bonto عبر build:bonto
# أو يمكنك إنشاؤها من جهازك:
DATABASE_URL="رابط-الاتصال" npm run db:push`,
    },
    {
      id: "bonto",
      icon: Rocket,
      title: "3. أنشئ التطبيق على bonto.dev/dashboard واربطه بـ GitHub",
      desc: "New App → Node.js → Import from Git → الصق رابط المستودع، ثم اضبط الأوامر التالية في إعدادات التطبيق.",
      code: `App name     : ${safeApp}        →  ${liveUrl}
Node version : 22 (أو أحدث)
Build command: npm run build:bonto
Start command: npm run start:bonto

# build:bonto  = إنشاء الجداول + next build (standalone) + نسخ الملفات الثابتة
# start:bonto  = node .next/standalone/server.js  (يقرأ PORT من Bonto تلقائياً)`,
    },
    {
      id: "env",
      icon: KeyRound,
      title: "4. أضف متغيرات البيئة في Bonto Dashboard → Environment Variables",
      desc: "أضف كل سطر كمتغير منفصل. مفاتيح Google وOpenAI يمكن إدخالها لاحقاً من صفحة «ربط القناة و API» داخل الموقع أيضاً.",
      code: envBlock,
    },
  ];

  return (
    <div className="mx-auto max-w-[1000px] space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-[#111216]">
          النشر على Bonto (bonto.dev) من GitHub
        </h1>
        <p className="mt-1 text-sm text-[#606470]">
          المشروع مجهّز بوضع <code dir="ltr" className="font-mono text-xs">standalone</code> وسكربتات{" "}
          <code dir="ltr" className="font-mono text-xs">build:bonto</code> و{" "}
          <code dir="ltr" className="font-mono text-xs">start:bonto</code>. أدخل اسم تطبيقك على Bonto ليتم توليد كل الإعدادات والروابط جاهزة للنسخ.
        </p>
      </div>

      <div className="studio-card grid gap-4 p-5 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-bold text-[#2A2D36]">اسم التطبيق على Bonto</label>
          <div className="flex items-center gap-2">
            <input
              type="text"
              dir="ltr"
              value={appName}
              onChange={(e) => setAppName(e.target.value)}
              className="studio-input px-3 py-2 font-mono text-xs"
            />
            <span dir="ltr" className="shrink-0 font-mono text-xs text-[#7B7F8C]">.bonto.page</span>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-bold text-[#2A2D36]">رابط مستودع GitHub</label>
          <input
            type="text"
            dir="ltr"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            className="studio-input px-3 py-2 font-mono text-xs"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[#DDD6FE] bg-[#F6F4FF] p-5">
        <p className="text-xs font-extrabold text-[#4C2FE0]">
          رابط Redirect URI لإضافته في Google Cloud Console (OAuth 2.0 Client → Web application):
        </p>
        <div className="mt-2.5 flex items-center gap-2">
          <code dir="ltr" className="flex-1 overflow-x-auto rounded-xl border border-[#DDD6FE] bg-white px-3.5 py-2 font-mono text-xs font-semibold text-[#111216]">
            {redirectUri}
          </code>
          <button
            type="button"
            onClick={() => void copy("uri", redirectUri, "رابط Redirect URI")}
            className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-[#5B3DF5] px-3.5 py-2 text-xs font-bold text-white hover:bg-[#4C2FE0]"
          >
            {copiedId === "uri" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            نسخ
          </button>
        </div>
        <p className="mt-2 text-[11px] text-[#3B2E7E]">
          وأضف <span dir="ltr" className="font-mono">{liveUrl}</span> في Authorized JavaScript origins، ثم فعّل YouTube Data API v3.
        </p>
      </div>

      <div className="space-y-4">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <section key={s.id} className="studio-card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#F0F0F4] px-5 py-4">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F4F7] text-[#111216]">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#111216]">{s.title}</h2>
                    <p className="text-xs text-[#6B707D]">{s.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(s.id, s.code, s.title)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E3EA] bg-white px-3 py-1.5 text-xs font-bold text-[#2A2D36] hover:bg-[#F4F4F7]"
                >
                  {copiedId === s.id ? <Check className="h-3.5 w-3.5 text-[#0B875B]" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === s.id ? "تم النسخ" : "نسخ"}
                </button>
              </div>
              <pre className="code-block overflow-x-auto bg-[#14161D] p-5 text-[12px] leading-6 text-[#E6E8EF]">
                <code>{s.code}</code>
              </pre>
            </section>
          );
        })}
      </div>

      <div className="rounded-2xl border border-[#FDE68A] bg-[#FFFBEB] p-5 text-xs leading-relaxed text-[#92400E]">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="space-y-1.5">
            <p className="font-extrabold">ملاحظات مهمة لخطة Bonto المجانية:</p>
            <p>• المساحة ~256MB والذاكرة 512MB: ملفات الفيديو المرفوعة تُحفظ مؤقتاً على الخادم حتى رفعها ليوتيوب — ارفع ملفات بحجم معقول، أو استخدم النماذج التجريبية لتوليد السيو والترجمات ثم انسخها.</p>
            <p>• التطبيق ينام عند عدم الاستخدام ويستيقظ عند أول طلب (قد يتأخر أول تحميل بضع ثوانٍ).</p>
            <p>• كل <code dir="ltr" className="font-mono">git push</code> على فرع main يعيد البناء والنشر تلقائياً.</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs">
        <a href="https://bonto.dev/dashboard" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl bg-[#111216] px-4 py-2.5 font-bold text-white hover:bg-[#2A2D36]">
          <Terminal className="h-3.5 w-3.5" />
          فتح Bonto Dashboard
          <ExternalLink className="h-3 w-3" />
        </a>
        <a href="https://neon.tech" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E3EA] bg-white px-4 py-2.5 font-bold text-[#2A2D36] hover:bg-[#F4F4F7]">
          <Database className="h-3.5 w-3.5" />
          إنشاء PostgreSQL مجاني (Neon)
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
