import type { KeywordTag } from "@/db/schema";

export const YOUTUBE_CATEGORIES = [
  { id: "28", label: "العلوم والتكنولوجيا", en: "Science & Technology" },
  { id: "27", label: "التعليم والشروحات", en: "Education" },
  { id: "26", label: "الإرشاد والأسلوب (How-To)", en: "Howto & Style" },
  { id: "22", label: "الأشخاص والمدونات", en: "People & Blogs" },
  { id: "24", label: "الترفيه", en: "Entertainment" },
  { id: "20", label: "ألعاب الفيديو", en: "Gaming" },
  { id: "25", label: "الأخبار والسياسة", en: "News & Politics" },
  { id: "23", label: "الكوميديا", en: "Comedy" },
  { id: "17", label: "الرياضة", en: "Sports" },
  { id: "19", label: "السفر والأحداث", en: "Travel & Events" },
  { id: "10", label: "الموسيقى", en: "Music" },
  { id: "1", label: "الأفلام والرسوم المتحركة", en: "Film & Animation" },
  { id: "2", label: "السيارات والمركبات", en: "Autos & Vehicles" },
  { id: "29", label: "المنظمات غير الربحية", en: "Nonprofits & Activism" },
] as const;

export const VIDEO_LANGUAGES = [
  { code: "ar", label: "العربية", native: "العربية" },
  { code: "en", label: "الإنجليزية", native: "English" },
  { code: "fr", label: "الفرنسية", native: "Français" },
  { code: "es", label: "الإسبانية", native: "Español" },
  { code: "tr", label: "التركية", native: "Türkçe" },
  { code: "de", label: "الألمانية", native: "Deutsch" },
  { code: "pt", label: "البرتغالية", native: "Português" },
  { code: "ur", label: "الأردية", native: "اردو" },
] as const;

export const CONTENT_TONES = [
  { id: "engaging", label: "تشويقي عالي النقر (CTR)", desc: "عناوين قوية ترفع نسبة الضغط والمشاهدة" },
  { id: "educational", label: "تعليمي وشرح مفصل", desc: "مثالي للشروحات والدورات وتصدر بحث يوتيوب" },
  { id: "tech", label: "تقني وبرمجي احترافي", desc: "مباشر ودقيق للمحتوى التقني والمراجعات" },
  { id: "news", label: "إخباري وتريند سريع", desc: "يركز على الحداثة والكلمات الرائجة الآن" },
  { id: "entertainment", label: "ترفيهي وقصصي", desc: "أسلوب عفوي جذاب يرفع وقت المشاهدة" },
] as const;

export const PRIVACY_OPTIONS = [
  { id: "public", label: "علني", desc: "متاح للجميع ويظهر في نتائج البحث" },
  { id: "unlisted", label: "غير مدرج", desc: "يشاهده فقط من يملك رابط الفيديو" },
  { id: "private", label: "خاص", desc: "مرئي لك وحدك للمراجعة قبل الإطلاق" },
  { id: "scheduled", label: "مجدول للنشر", desc: "يُنشر تلقائياً في التاريخ والوقت المحدد" },
] as const;

export interface SeoBreakdown {
  total: number;
  grade: string;
  items: Array<{
    key: string;
    label: string;
    score: number;
    max: number;
    tip: string;
    ok: boolean;
  }>;
  tagsCharCount: number;
  longTailCount: number;
}

export function calculateTagsCharCount(tags: KeywordTag[]): number {
  if (!tags.length) return 0;
  return tags.map((t) => t.text.trim()).filter(Boolean).join(",").length;
}

export function calculateSeoBreakdown(input: {
  title: string;
  description: string;
  hashtags: string[];
  tags: KeywordTag[];
  captionsCount: number;
  videoLanguage: string;
  categoryId: string;
  focusKeyword?: string;
}): SeoBreakdown {
  const title = (input.title || "").trim();
  const description = (input.description || "").trim();
  const hashtags = input.hashtags || [];
  const tags = input.tags || [];
  const tagsCharCount = calculateTagsCharCount(tags);
  const longTailCount = tags.filter(
    (t) => t.type === "long_tail" || t.text.trim().split(/\s+/).length >= 3
  ).length;

  // 1. Title score (25 pts)
  let titleScore = 0;
  if (title.length >= 25 && title.length <= 72) titleScore += 18;
  else if (title.length >= 12 && title.length <= 95) titleScore += 12;
  else if (title.length > 0) titleScore += 6;
  if (/[0-9٠-٩|!؟?🔥✅🚀:()-]/.test(title)) titleScore += 4;
  if (
    input.focusKeyword &&
    title.toLowerCase().includes(input.focusKeyword.toLowerCase().slice(0, 12))
  ) {
    titleScore += 3;
  } else if (title.split(/\s+/).length >= 5) {
    titleScore += 3;
  }
  titleScore = Math.min(25, titleScore);

  // 2. Description & hashtags (25 pts)
  let descScore = 0;
  if (description.length >= 450) descScore += 14;
  else if (description.length >= 200) descScore += 9;
  else if (description.length >= 50) descScore += 5;
  if (/\b\d{1,2}:\d{2}\b/.test(description)) descScore += 5; // chapters
  if (hashtags.length >= 3 && hashtags.length <= 12) descScore += 6;
  else if (hashtags.length >= 1) descScore += 3;
  descScore = Math.min(25, descScore);

  // 3. Long-tail keywords & tags (25 pts)
  let tagsScore = 0;
  if (tags.length >= 10) tagsScore += 10;
  else if (tags.length >= 5) tagsScore += 6;
  else if (tags.length >= 1) tagsScore += 3;
  if (longTailCount >= 6) tagsScore += 10;
  else if (longTailCount >= 3) tagsScore += 6;
  else if (longTailCount >= 1) tagsScore += 3;
  if (tagsCharCount >= 220 && tagsCharCount <= 500) tagsScore += 5;
  else if (tagsCharCount > 0 && tagsCharCount <= 500) tagsScore += 3;
  tagsScore = Math.min(25, tagsScore);

  // 4. Subtitles/Captions (15 pts)
  let capScore = 0;
  if (input.captionsCount >= 2) capScore = 15;
  else if (input.captionsCount === 1) capScore = 11;

  // 5. Settings (language + category) (10 pts)
  const settingsScore =
    (input.videoLanguage ? 5 : 0) + (input.categoryId ? 5 : 0);

  const total = Math.min(
    100,
    titleScore + descScore + tagsScore + capScore + settingsScore
  );

  const grade =
    total >= 90
      ? "ممتاز — جاهز لتصدر البحث"
      : total >= 75
        ? "قوي جداً"
        : total >= 55
          ? "جيد — قابل للتحسين"
          : "يحتاج تحسين";

  return {
    total,
    grade,
    tagsCharCount,
    longTailCount,
    items: [
      {
        key: "title",
        label: "قوة العنوان وجاذبية النقر",
        score: titleScore,
        max: 25,
        ok: titleScore >= 20,
        tip:
          title.length === 0
            ? "أضف عنواناً جذاباً بين 40 و70 حرفاً"
            : title.length > 75
              ? "حاول تقصير العنوان قليلاً ليظهر كاملاً في البحث"
              : "طول مثالي وجاذبية عالية لنتائج البحث",
      },
      {
        key: "description",
        label: "الوصف والفصول والهاشتاجات",
        score: descScore,
        max: 25,
        ok: descScore >= 20,
        tip:
          descScore >= 20
            ? "وصف غني بالكلمات والفصول الزمنية والهاشتاجات"
            : "أضف وصفاً مفصلاً + فصول زمنية + 3 إلى 8 هاشتاجات",
      },
      {
        key: "tags",
        label: "التاجز والكلمات المفتاحية الطويلة",
        score: tagsScore,
        max: 25,
        ok: tagsScore >= 20,
        tip:
          longTailCount >= 6 && tagsCharCount <= 500
            ? `${longTailCount} كلمة طويلة الذيل قوية لتصدر البحث`
            : tagsCharCount > 500
              ? "تجاوزت الحد الأقصى ليوتيوب (500 حرف)"
              : "أضف مزيداً من الكلمات المفتاحية الطويلة",
      },
      {
        key: "captions",
        label: "الترجمات التلقائية (CC / SRT)",
        score: capScore,
        max: 15,
        ok: capScore >= 11,
        tip:
          input.captionsCount >= 2
            ? `${input.captionsCount} لغات ترجمة جاهزة تزيد الانتشار العالمي`
            : input.captionsCount === 1
              ? "أضف ترجمة إنجليزية لتوسيع الوصول الدولي"
              : "ولّد ملفات الترجمة لتحسين فهرسة يوتيوب",
      },
      {
        key: "settings",
        label: "إعدادات اللغة والتصنيف",
        score: settingsScore,
        max: 10,
        ok: settingsScore === 10,
        tip: "اللغة والتصنيف مضبوطان وفق معايير YouTube API",
      },
    ],
  };
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(size >= 100 || i <= 1 ? 0 : 1)} ${units[i]}`;
}

export function formatCompactNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function getCategoryLabel(categoryId: string): string {
  return (
    YOUTUBE_CATEGORIES.find((c) => c.id === categoryId)?.label ??
    "العلوم والتكنولوجيا"
  );
}

export function getLanguageLabel(code: string): string {
  return VIDEO_LANGUAGES.find((l) => l.code === code)?.label ?? code;
}
