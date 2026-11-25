import type { KeywordTag, TitleCandidate, VideoChapter } from "@/db/schema";
import { getRuntimeConfig } from "./settings";
import { buildGeneratedCaptions } from "./captions";
import { calculateSeoBreakdown, formatDuration } from "./youtube-constants";

export interface AnalyzeVideoInput {
  filename: string;
  userPrompt: string;
  transcriptHint: string;
  durationSeconds: number;
  language: string;
  categoryId: string;
  contentTone: string;
  channelTitle?: string;
}

export interface AnalyzeVideoResult {
  aiProviderUsed: "openai" | "gemini" | "builtin";
  detectedTopic: string;
  detectedAudience: string;
  bestPublishTime: string;
  focusKeyword: string;
  suggestedCategoryId: string;
  suggestedLanguage: string;
  title: string;
  titleCandidates: TitleCandidate[];
  description: string;
  chapters: VideoChapter[];
  hashtags: string[];
  tags: KeywordTag[];
  seoScore: number;
  captions: Array<{
    languageCode: string;
    languageName: string;
    cues: ReturnType<typeof buildGeneratedCaptions>["cues"];
    srtContent: string;
  }>;
}

const YEAR = new Date().getFullYear();

function cleanFileTopic(filename: string): string {
  return filename
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b(mp4|mov|mkv|webm|avi|final|export|v\d+|1080p|4k|720p|hd|copy|raw)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function detectDomain(text: string): {
  domain: string;
  categoryId: string;
  audience: string;
  bestTime: string;
  coreTopicFallback: string;
  subHashtags: string[];
  extraLongTail: string[];
  playlist: string;
} {
  const lower = text.toLowerCase();

  if (/(ubuntu|node|nodejs|linux|github|server|vps|deploy|برمج|كود|سيرفر|نود|اوبونتو|لينكس|موقع|تطبيق|جيتهب|react|next|python|javascript|api)/i.test(lower)) {
    return {
      domain: "programming",
      categoryId: "28",
      audience: "المبرمجون ومطورو الويب وصنّاع التطبيقات العرب",
      bestTime: "الخميس 8:00 مساءً بتوقيت القاهرة",
      coreTopicFallback: "رفع وتشغيل المواقع على سيرفر أوبونتو باستخدام Node.js",
      subHashtags: ["برمجة", "تطوير_الويب", "اوبونتو", "NodeJS", "GitHub", "تقنية", "شروحات_تقنية"],
      extraLongTail: [
        `رفع موقع node js على سيرفر اوبونتو ${YEAR}`,
        "طريقة ربط github بالسيرفر وتشغيل الموقع",
        "شرح تثبيت nodejs و pm2 على ubuntu خطوة بخطوة",
        "تشغيل مشروع nextjs على استضافة vps مجانا",
        "اعداد nginx وشهادة ssl لموقع node js",
        "تعلم برمجة المواقع من الصفر للمبتدئين",
        "افضل استضافة لتشغيل تطبيقات نود جي اس",
      ],
      playlist: "شروحات البرمجة والسيرفرات",
    };
  }

  if (/(ai|ذكاء|اصطناع|chatgpt|gemini|openai|midjourney|claude|بوت|أتمتة|توليد)/i.test(lower)) {
    return {
      domain: "ai",
      categoryId: "28",
      audience: "المهتمون بالذكاء الاصطناعي وأدوات الإنتاجية والعمل عبر الإنترنت",
      bestTime: "الأحد 7:30 مساءً بتوقيت القاهرة",
      coreTopicFallback: "أقوى أدوات الذكاء الاصطناعي لزيادة الإنتاجية وصناعة المحتوى",
      subHashtags: ["الذكاء_الاصطناعي", "AI", "أدوات_ذكاء_اصطناعي", "تقنية", "صناعة_المحتوى", "مستقبل_التقنية"],
      extraLongTail: [
        `افضل ادوات الذكاء الاصطناعي المجانية ${YEAR}`,
        "شرح استخدام الذكاء الاصطناعي للمبتدئين خطوة بخطوة",
        "كيف تربح من ادوات الذكاء الاصطناعي في صناعة المحتوى",
        "انشاء محتوى احترافي بالذكاء الاصطناعي مجانا",
        "اسرار الذكاء الاصطناعي لزيادة الانتاجية وتوفير الوقت",
        "مقارنة اقوى مواقع الذكاء الاصطناعي باللغة العربية",
      ],
      playlist: "دليل الذكاء الاصطناعي العملي",
    };
  }

  if (/(youtube|يوتيوب|سيو|seo|مشاهدات|مشترك|محتوى|قناة|ارباح|الربح|ادسنس|عنوان|تاجز|فيديو|مونتاج)/i.test(lower)) {
    return {
      domain: "youtube",
      categoryId: "27",
      audience: "صنّاع المحتوى وأصحاب قنوات يوتيوب المبتدئون والمحترفون",
      bestTime: "الأربعاء 7:00 مساءً بتوقيت القاهرة",
      coreTopicFallback: "تصدر نتائج بحث يوتيوب وزيادة المشاهدات بالذكاء الاصطناعي",
      subHashtags: ["يوتيوب", "سيو_اليوتيوب", "صناعة_المحتوى", "زيادة_المشاهدات", "الربح_من_اليوتيوب", "YouTubeSEO"],
      extraLongTail: [
        `كيفية تصدر نتائج البحث في اليوتيوب ${YEAR}`,
        "افضل طريقة لزيادة مشاهدات اليوتيوب بسرعة للمبتدئين",
        "اختيار الكلمات المفتاحية القوية لفيديوهات اليوتيوب",
        "طريقة كتابة عنوان ووصف احترافي لفيديو يوتيوب",
        "اسرار سيو اليوتيوب لرفع المشاهدات والمشتركين مجانا",
        "كيف اضبط اعدادات رفع الفيديو على اليوتيوب صح",
        "افضل اداة ذكاء اصطناعي لسيو اليوتيوب مجانا",
      ],
      playlist: "أسرار نمو قنوات اليوتيوب والسيو",
    };
  }

  if (/(طبخ|وصف|أكل|مطبخ|كيك|حلويات|غداء|عشاء|فطور|شيف|recipe|cook|food)/i.test(lower)) {
    return {
      domain: "cooking",
      categoryId: "26",
      audience: "عشاق الطبخ والوصفات البيتية السريعة والسهلة",
      bestTime: "الجمعة 4:00 عصراً بتوقيت القاهرة",
      coreTopicFallback: "أسهل وألذ وصفة منزلية بمكونات بسيطة وطعم احترافي",
      subHashtags: ["طبخ", "وصفات_سهلة", "اكلات_سريعة", "مطبخ", "وصفات_منزلية", "أكل_بيتي"],
      extraLongTail: [
        `طريقة عمل وصفة سهلة وسريعة في البيت ${YEAR}`,
        "اكلات اقتصادية سريعة التحضير بمكونات في كل بيت",
        "اسرار نجاح الوصفة من اول مرة مثل المطاعم",
        "وصفات طبخ عربية سهلة ومجربة للمبتدئين",
        "افضل طريقة تحضير اكل بيتي لذيذ في 10 دقائق",
      ],
      playlist: "وصفات سهلة وسريعة",
    };
  }

  if (/(game|gaming|لعبة|ألعاب|ببجي|فيفا|ماين|بلايستيشن|فورتنايت|جيمنج|pubg|fifa|gta|valorant)/i.test(lower)) {
    return {
      domain: "gaming",
      categoryId: "20",
      audience: "اللاعبون وعشاق ألعاب الفيديو والبث المباشر",
      bestTime: "الخميس 9:00 مساءً بتوقيت القاهرة",
      coreTopicFallback: "جيم بلاي أسطوري وأقوى أسرار الاحتراف والتحديث الجديد",
      subHashtags: ["ألعاب", "جيمنج", "Gaming", "جيم_بلاي", "بلايستيشن", "احتراف_الألعاب"],
      extraLongTail: [
        `شرح التحديث الجديد واسرار الاحتراف ${YEAR}`,
        "افضل اعدادات اللعب ورفع الفريمات بدون لاج",
        "تحديات وجيم بلاي اسطوري باعلى جودة",
        "نصائح وخدع سرية للفوز في كل جيم بسهولة",
        "مراجعة شاملة لاقوى الالعاب الجديدة بالعربي",
      ],
      playlist: "سلسلة الجيمنج والاحتراف",
    };
  }

  if (/(ربح|مال|بيزنس|تجارة|استثمار|تسويق|فريلانس|شغل|عمل|فلوس|business|marketing|money|freelance)/i.test(lower)) {
    return {
      domain: "business",
      categoryId: "27",
      audience: "رواد الأعمال والشباب الباحثون عن مصادر دخل وعمل عبر الإنترنت",
      bestTime: "الثلاثاء 8:00 مساءً بتوقيت القاهرة",
      coreTopicFallback: "خطة عملية لبناء مشروع ناجح والربح من الإنترنت",
      subHashtags: ["الربح_من_الانترنت", "ريادة_الأعمال", "تجارة_الكترونية", "تسويق_رقمي", "العمل_الحر"],
      extraLongTail: [
        `افضل طرق الربح من الانترنت للمبتدئين بدون راس مال ${YEAR}`,
        "كيف تبدأ مشروعك الاونلاين الناجح من الصفر",
        "استراتيجيات التسويق الالكتروني لزيادة المبيعات بسرعة",
        "العمل الحر على الانترنت وزيادة الدخل الشهري بالدولار",
        "خطوات عملية للنجاح المالي وبناء دخل سلبي مستمر",
      ],
      playlist: "البيزنس والربح من الإنترنت",
    };
  }

  if (/(رياضة|جيم|تمرين|لياقة|دايت|تخسيس|صحة|fitness|workout|gym|health)/i.test(lower)) {
    return {
      domain: "fitness",
      categoryId: "17",
      audience: "المهتمون باللياقة البدنية والصحة وبناء الجسم",
      bestTime: "السبت 6:00 مساءً بتوقيت القاهرة",
      coreTopicFallback: "أفضل جدول تمارين ونصائح عملية لنتائج سريعة وصحية",
      subHashtags: ["رياضة", "لياقة_بدنية", "تمارين", "صحة", "جيم", "تغذية_صحية"],
      extraLongTail: [
        `افضل جدول تمارين في البيت للمبتدئين ${YEAR}`,
        "نصائح التغذية الصحية وحرق الدهون بسرعة بدون حرمان",
        "اخطاء شائعة في التمرين تمنع ظهور النتائج",
        "تمارين يومية لشد الجسم وزيادة اللياقة البدنية",
      ],
      playlist: "اللياقة والصحة اليومية",
    };
  }

  return {
    domain: "general",
    categoryId: "22",
    audience: "الجمهور العربي الباحث عن شروحات ومحتوى عالي القيمة",
    bestTime: "الخميس 7:30 مساءً بتوقيت القاهرة",
    coreTopicFallback: "دليل شامل خطوة بخطوة مع أهم الأسرار والنصائح",
    subHashtags: ["شرح", "تعليم", "نصائح", "تريند", "محتوى_عربي", "يوتيوب"],
    extraLongTail: [
      `افضل شرح كامل ومبسط للمبتدئين ${YEAR}`,
      "خطوات عملية مضمونة للوصول لافضل نتيجة بسرعة",
      "اهم النصائح والاسرار التي يجب ان تعرفها الان",
      "دليل شامل من الصفر حتى الاحتراف خطوة بخطوة",
      "اخطاء شائعة تجنبها لتحقيق افضل اداء ونتيجة",
    ],
    playlist: "أهم الشروحات والأدلة الكاملة",
  };
}

function buildDynamicChapters(durationSeconds: number, topic: string, isEnglish: boolean): VideoChapter[] {
  const dur = Math.max(60, durationSeconds || 480);
  const marks = [0, 0.12, 0.34, 0.58, 0.8, 0.91];
  const labels = isEnglish
    ? [
        `Intro & Why ${topic.slice(0, 32)} Matters`,
        "Essential Setup & Key Preparation",
        "Step-by-Step Practical Walkthrough",
        "Pro Optimization Tips & Common Mistakes",
        "Final Results & Live Check",
        "Summary & Next Steps",
      ]
    : [
        `المقدمة وأهمية ${topic.slice(0, 34)}`,
        "التجهيز والأساسيات قبل البدء",
        "الشرح العملي الكامل خطوة بخطوة",
        "أسرار الاحتراف وتجنّب الأخطاء الشائعة",
        "استعراض النتيجة النهائية واختبار الأداء",
        "الخلاصة وأهم النصائح",
      ];

  return marks.map((ratio, idx) => ({
    time: formatDuration(Math.floor(dur * ratio)),
    label: labels[idx],
  }));
}

function generateTagsForTopic(
  topic: string,
  extraLongTail: string[],
  isEnglish: boolean
): KeywordTag[] {
  const clean = topic.replace(/[!؟?🔥✅🚀#|]/g, "").trim();
  const shortCore = clean.split(/\s+/).slice(0, 4).join(" ");
  const generated: KeywordTag[] = [];

  const candidates: Array<{
    text: string;
    type: KeywordTag["type"];
    volume: KeywordTag["volume"];
    competition: KeywordTag["competition"];
    score: number;
  }> = isEnglish
    ? [
        { text: `how to ${shortCore} step by step ${YEAR}`, type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 96 },
        { text: `${shortCore} complete tutorial for beginners`, type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 94 },
        { text: `best way to ${shortCore} fast and free`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 91 },
        { text: `${shortCore} full guide explained ${YEAR}`, type: "long_tail", volume: "عالي", competition: "متوسطة", score: 89 },
        { text: `${shortCore} tips and tricks for creators`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 88 },
        { text: `${shortCore} mistakes to avoid`, type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 86 },
        { text: shortCore, type: "core", volume: "عالي جداً", competition: "عالية", score: 84 },
        { text: `${shortCore} ${YEAR}`, type: "trending", volume: "عالي جداً", competition: "متوسطة", score: 90 },
        { text: `easy ${shortCore} walkthrough`, type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 85 },
        { text: `pro ${shortCore} workflow`, type: "trending", volume: "عالي", competition: "منخفضة", score: 87 },
      ]
    : [
        { text: `شرح ${shortCore} خطوة بخطوة للمبتدئين ${YEAR}`, type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 97 },
        { text: `كيفية ${shortCore} بأسهل طريقة مجانا`, type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 95 },
        { text: `أفضل طريقة ${shortCore} من الصفر للاحتراف`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 93 },
        { text: `دليل شامل عن ${shortCore} ${YEAR}`, type: "long_tail", volume: "عالي", competition: "متوسطة", score: 91 },
        { text: `أسرار ونصائح ${shortCore} لتصدر البحث`, type: "trending", volume: "عالي جداً", competition: "منخفضة", score: 92 },
        { text: shortCore, type: "core", volume: "عالي جداً", competition: "عالية", score: 86 },
        ...extraLongTail.map((kw, i) => ({
          text: kw,
          type: (i % 3 === 2 ? "trending" : "long_tail") as KeywordTag["type"],
          volume: (i < 2 ? "عالي جداً" : i < 5 ? "عالي" : "متوسط") as KeywordTag["volume"],
          competition: (i % 4 === 3 ? "متوسطة" : "منخفضة") as KeywordTag["competition"],
          score: Math.max(82, 94 - i * 2),
        })),
      ];

  // Respect YouTube's strict 500-character total tag budget
  const seen = new Set<string>();
  let totalChars = 0;
  for (const item of candidates) {
    const t = item.text.trim();
    if (!t || t.length < 3 || seen.has(t.toLowerCase())) continue;
    const addition = (generated.length > 0 ? 1 : 0) + t.length;
    if (totalChars + addition > 470) break;
    seen.add(t.toLowerCase());
    totalChars += addition;
    generated.push({ ...item, text: t });
  }
  return generated;
}

export function generateMoreLongTailTags(
  seedKeyword: string,
  existingTags: KeywordTag[],
  language = "ar"
): KeywordTag[] {
  const kw = seedKeyword.trim();
  if (!kw) return [];
  const isEn = language === "en" && !/[\u0600-\u06FF]/.test(kw);
  const existingSet = new Set(existingTags.map((t) => t.text.toLowerCase().trim()));
  const pool: KeywordTag[] = isEn
    ? [
        { text: `${kw} step by step tutorial ${YEAR}`, type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 95 },
        { text: `how to master ${kw} for beginners`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 92 },
        { text: `best free ${kw} setup guide`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 90 },
        { text: `${kw} complete walkthrough no fluff`, type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 88 },
        { text: `${kw} secret tips that actually work`, type: "trending", volume: "عالي", competition: "منخفضة", score: 91 },
      ]
    : [
        { text: `طريقة ${kw} خطوة بخطوة للمبتدئين ${YEAR}`, type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 96 },
        { text: `أفضل شرح عملي عن ${kw} مجانا`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 93 },
        { text: `تعلّم ${kw} من الصفر حتى الاحتراف`, type: "long_tail", volume: "عالي", competition: "منخفضة", score: 91 },
        { text: `حل مشاكل ${kw} وأهم النصائح الذهبية`, type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 89 },
        { text: `تجربة حقيقية ومراجعة شاملة ${kw}`, type: "trending", volume: "عالي", competition: "منخفضة", score: 90 },
        { text: `أخطاء يجب تجنبها عند ${kw}`, type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 87 },
      ];

  return pool.filter((item) => !existingSet.has(item.text.toLowerCase()));
}

function buildBuiltinAnalysis(input: AnalyzeVideoInput): AnalyzeVideoResult {
  const cleanedFile = cleanFileTopic(input.filename);
  const rawCombined = [input.userPrompt, input.transcriptHint, cleanedFile]
    .filter(Boolean)
    .join(" ");

  const domainInfo = detectDomain(rawCombined);

  const primaryTopic =
    input.userPrompt.trim().length >= 4
      ? input.userPrompt.trim().split(/[\n.!؟]/)[0].trim().slice(0, 68)
      : cleanedFile.length >= 4 && !/^(video|clip|record|vid|img|mov|sample|test|\d+)$/i.test(cleanedFile)
        ? cleanedFile.slice(0, 68)
        : domainInfo.coreTopicFallback;

  const isEnglish =
    input.language === "en" && !/[\u0600-\u06FF]/.test(primaryTopic);
  const trimAtWord = (text: string, maxLen: number) => {
    const clean = text.trim();
    if (clean.length <= maxLen) return clean;
    const sliced = clean.slice(0, maxLen);
    const lastSpace = sliced.lastIndexOf(" ");
    return (lastSpace > maxLen * 0.55 ? sliced.slice(0, lastSpace) : sliced).trim();
  };
  const shortTopic = trimAtWord(primaryTopic, 42);
  const focusKeyword = primaryTopic.split(/\s+/).slice(0, 5).join(" ");

  const titleCandidates: TitleCandidate[] = isEnglish
    ? [
        {
          title: `${shortTopic}: Complete Step-by-Step Guide (${YEAR})`,
          ctrScore: 94,
          seoScore: 96,
          angle: "تصدر البحث",
          reason: "يجمع الكلمة المفتاحية في البداية مع السنة لرفع الترتيب في بحث يوتيوب",
        },
        {
          title: `How to Master ${shortTopic} Fast (Zero Mistakes!)`,
          ctrScore: 96,
          seoScore: 91,
          angle: "أعلى نسبة نقر",
          reason: "عبارة بحثية مباشرة + محفز فضول قوي يزيد نسبة النقر CTR",
        },
        {
          title: `I Tried ${shortTopic} — Here Is What Actually Works`,
          ctrScore: 92,
          seoScore: 86,
          angle: "تشويقي وقصصي",
          reason: "صيغة تجربة شخصية تحفّز الفضول وتطيل مدة المشاهدة",
        },
        {
          title: `${shortTopic} Full Tutorial for Beginners (Pro Tips)`,
          ctrScore: 89,
          seoScore: 93,
          angle: "تعليمي دائم",
          reason: "محتوى Evergreen يجلب مشاهدات مستمرة من البحث على مدار السنة",
        },
        {
          title: `7 Secrets About ${shortTopic} Nobody Tells You`,
          ctrScore: 93,
          seoScore: 87,
          angle: "قائمة أرقام",
          reason: "الأرقام المحددة تزيد نسبة النقر حتى 28% في الصفحة الرئيسية",
        },
      ]
    : [
        {
          title: `${shortTopic} — الشرح الكامل خطوة بخطوة (${YEAR})`,
          ctrScore: 94,
          seoScore: 97,
          angle: "تصدر البحث الأول",
          reason: "الكلمة المفتاحية في أول العنوان + سنة البحث لالتقاط أعلى زيارات يوتيوب وجوجل",
        },
        {
          title: `أقوى طريقة لـ ${shortTopic} بدون أخطاء | نتيجة مضمونة!`,
          ctrScore: 96,
          seoScore: 92,
          angle: "أعلى نسبة نقر (CTR)",
          reason: "يجمع الوعد الواضح مع القوة التحفيزية لرفع نسبة الضغط على الفيديو",
        },
        {
          title: `كيف تبدأ ${shortTopic} من الصفر حتى الاحتراف بسهولة`,
          ctrScore: 91,
          seoScore: 95,
          angle: "كلمة بحث طويلة",
          reason: "يطابق صيغة البحث الأكثر طلباً على يوتيوب في الوطن العربي",
        },
        {
          title: `أسرار ${shortTopic} التي يغفل عنها الجميع — دليل ${YEAR}`,
          ctrScore: 93,
          seoScore: 89,
          angle: "فضول وتشويق",
          reason: "مثالي لرفع الظهور في الفيديوهات المقترحة والصفحة الرئيسية",
        },
        {
          title: `كل ما تحتاج معرفته عن ${shortTopic} في فيديو واحد فقط`,
          ctrScore: 89,
          seoScore: 91,
          angle: "مرجع شامل",
          reason: "يعطي المشاهد قيمة فورية شاملة ويرفع متوسط وقت المشاهدة",
        },
      ];

  // Prioritize tone match first
  if (input.contentTone === "engaging" && titleCandidates.length > 1) {
    const [top] = titleCandidates.splice(1, 1);
    titleCandidates.unshift(top);
  } else if (input.contentTone === "educational" && titleCandidates.length > 2) {
    const [top] = titleCandidates.splice(2, 1);
    titleCandidates.unshift(top);
  }

  const chosenTitle = titleCandidates[0].title;
  const chapters = buildDynamicChapters(input.durationSeconds, primaryTopic, isEnglish);

  const topicTag = shortTopic
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("_");

  const hashtags = Array.from(
    new Set(
      [
        topicTag.length >= 3 ? `#${topicTag}` : "",
        ...domainInfo.subHashtags.map((h) => `#${h}`),
        `#تريند_${YEAR}`,
      ].filter(Boolean)
    )
  ).slice(0, 7);

  const tags = generateTagsForTopic(primaryTopic, domainInfo.extraLongTail, isEnglish);

  const chaptersText = chapters.map((c) => `${c.time} ${c.label}`).join("\n");
  const channelLine = input.channelTitle ? ` | قناة ${input.channelTitle}` : "";

  const description = isEnglish
    ? `In this complete ${YEAR} guide, learn everything about ${primaryTopic} step by step with practical tips that boost results immediately.\n\nIf you're looking for a clean, easy-to-follow breakdown of ${focusKeyword}, this video gives you the exact blueprint from setup to real-world execution.\n\n⏱️ Video Chapters:\n${chaptersText}\n\n✅ What you'll gain from this video:\n• Clear step-by-step walkthrough for ${primaryTopic}\n• High-impact tips and mistakes to avoid\n• Ready-to-apply setup and optimization workflow\n\n🔔 Subscribe & turn on notifications for weekly tutorials!\n💬 Have a question? Drop it in the comments below and I'll reply.\n\n${hashtags.slice(0, 5).join(" ")}`
    : `في هذا الفيديو الشامل (${YEAR}) نشرح لك بالتفصيل ${primaryTopic} خطوة بخطوة وبأسلوب عملي مبسّط يناسب المبتدئين والمحترفين${channelLine}.\n\nستتعلم معنا أهم الأسرار والخطوات الصحيحة حول ${focusKeyword} لتصل إلى أفضل نتيجة بسرعة وبدون أي أخطاء شائعة، مع تطبيق عملي مباشر يمكنك تنفيذه فوراً.\n\n⏱️ فصول الفيديو (التقسيم الزمني):\n${chaptersText}\n\n🎯 ماذا ستستفيد من هذا الفيديو؟\n• فهم عملي متكامل لموضوع ${primaryTopic}\n• أهم الخطوات الصحيحة المجربة والمضمونة\n• نصائح احترافية توفر عليك الوقت والجهد\n• تجنّب أشهر الأخطاء التي يقع فيها المبتدئون\n\n🔔 لا تنسَ الاشتراك في القناة وتفعيل زر الجرس ليصلك كل جديد أولاً بأول!\n👍 إذا أفادك الفيديو ادعمنا بلايك واكتب رأيك أو سؤالك في التعليقات وسأرد عليك فوراً.\n\n${hashtags.join(" ")}`;

  const primaryCaption = buildGeneratedCaptions({
    languageCode: isEnglish ? "en" : "ar",
    topic: primaryTopic,
    title: chosenTitle,
    durationSeconds: input.durationSeconds,
    chapters,
    transcriptHint: input.transcriptHint,
  });

  const secondaryCode = isEnglish ? "ar" : "en";
  const secondaryCaption = buildGeneratedCaptions({
    languageCode: secondaryCode,
    topic: primaryTopic,
    title: chosenTitle,
    durationSeconds: input.durationSeconds,
    chapters,
  });

  const captions = [
    { languageCode: isEnglish ? "en" : "ar", ...primaryCaption },
    { languageCode: secondaryCode, ...secondaryCaption },
  ];

  const categoryId = input.categoryId || domainInfo.categoryId;
  const videoLang = input.language || (isEnglish ? "en" : "ar");
  const breakdown = calculateSeoBreakdown({
    title: chosenTitle,
    description,
    hashtags,
    tags,
    captionsCount: captions.length,
    videoLanguage: videoLang,
    categoryId,
    focusKeyword,
  });

  return {
    aiProviderUsed: "builtin",
    detectedTopic: primaryTopic,
    detectedAudience: domainInfo.audience,
    bestPublishTime: domainInfo.bestTime,
    focusKeyword,
    suggestedCategoryId: categoryId,
    suggestedLanguage: videoLang,
    title: chosenTitle,
    titleCandidates,
    description,
    chapters,
    hashtags,
    tags,
    seoScore: breakdown.total,
    captions,
  };
}

function buildAiSystemPrompt(input: AnalyzeVideoInput): string {
  return `أنت خبير سيو يوتيوب (YouTube SEO & CTR Strategist) عالمي. حلل بيانات الفيديو التالية وأرجع JSON صالح فقط (بدون markdown) بهذا الشكل بالضبط:
{
  "detectedTopic": "ملخص واضح لموضوع الفيديو",
  "detectedAudience": "الجمهور المستهدف بدقة",
  "bestPublishTime": "أفضل يوم وساعة للنشر",
  "focusKeyword": "الكلمة المفتاحية الأساسية",
  "suggestedCategoryId": "رقم تصنيف يوتيوب مثل 28 أو 27 أو 22 أو 26 أو 20 أو 24",
  "titleCandidates": [
    {"title": "عنوان جذاب قوي لا يتجاوز 70 حرف يتصدر البحث", "ctrScore": 95, "seoScore": 96, "angle": "تصدر البحث", "reason": "سبب قصير"}
  ],
  "chapters": [{"time": "00:00", "label": "اسم الفصل"}],
  "description": "وصف يوتيوب قوي جداً ومفصل (600-1100 حرف) يبدأ بجملتين قويتين للسيو ثم الفصول الزمنية ثم دعوة للاشتراك ثم الهاشتاجات",
  "hashtags": ["#هاشتاج1", "#هاشتاج2", "#هاشتاج3", "#هاشتاج4", "#هاشتاج5"],
  "tags": [
    {"text": "كلمة مفتاحية طويلة الذيل قوية تتصدر البحث", "type": "long_tail", "volume": "عالي جداً", "competition": "منخفضة", "score": 95}
  ],
  "arabicSubtitles": ["جملة ترجمة 1", "جملة ترجمة 2", "جملة ترجمة 3", "جملة ترجمة 4", "جملة ترجمة 5", "جملة ترجمة 6", "جملة ترجمة 7", "جملة ترجمة 8"],
  "englishSubtitles": ["Subtitle line 1", "Subtitle line 2", "Subtitle line 3", "Subtitle line 4", "Subtitle line 5", "Subtitle line 6", "Subtitle line 7", "Subtitle line 8"]
}
شروط مهمة:
- أنشئ 5 عناوين مختلفة وقوية جداً وجذابة للنقر وتتصدر بحث يوتيوب (${YEAR}).
- أنشئ 10 إلى 14 تاج معظمه long_tail (كلمات مفتاحية طويلة الذيل مكونة من 3 إلى 7 كلمات) ومجموع أحرف جميع التاجز مع الفواصل <= 470 حرفاً.
- اللغة المطلوبة: ${input.language === "en" ? "English" : "العربية الواضحة الجذابة"}.
- الأسلوب: ${input.contentTone}.`;
}

function buildAiUserPrompt(input: AnalyzeVideoInput): string {
  return `اسم ملف الفيديو: ${input.filename}
المدة: ${formatDuration(input.durationSeconds || 420)}
وصف/موضوع الفيديو: ${input.userPrompt || "غير محدد — استنتج من اسم الملف"}
نص/سكربت أو ملاحظات: ${input.transcriptHint || "لا يوجد"}
القناة: ${input.channelTitle || "قناة عربية"}`;
}

function normalizeLlmPayload(
  raw: Record<string, unknown>,
  fallback: AnalyzeVideoResult,
  provider: "openai" | "gemini",
  durationSeconds: number
): AnalyzeVideoResult {
  const candidatesRaw = Array.isArray(raw.titleCandidates) ? raw.titleCandidates : [];
  const titleCandidates: TitleCandidate[] =
    candidatesRaw.length >= 2
      ? candidatesRaw.slice(0, 6).map((c) => {
          const item = (c || {}) as Record<string, unknown>;
          return {
            title: String(item.title || fallback.title).slice(0, 100),
            ctrScore: Math.min(99, Math.max(70, Number(item.ctrScore) || 91)),
            seoScore: Math.min(99, Math.max(70, Number(item.seoScore) || 92)),
            angle: String(item.angle || "تصدر البحث"),
            reason: String(item.reason || "متوافق مع خوارزمية بحث يوتيوب"),
          };
        })
      : fallback.titleCandidates;

  const chaptersRaw = Array.isArray(raw.chapters) ? raw.chapters : [];
  const chapters: VideoChapter[] =
    chaptersRaw.length >= 2
      ? chaptersRaw.slice(0, 10).map((c) => {
          const item = (c || {}) as Record<string, unknown>;
          return {
            time: String(item.time || "00:00"),
            label: String(item.label || ""),
          };
        })
      : fallback.chapters;

  const hashtagsRaw = Array.isArray(raw.hashtags) ? raw.hashtags : [];
  const hashtags = (
    hashtagsRaw.length > 0
      ? hashtagsRaw.map((h) => {
          const s = String(h).trim().replace(/\s+/g, "_");
          return s.startsWith("#") ? s : `#${s}`;
        })
      : fallback.hashtags
  ).slice(0, 8);

  const tagsRaw = Array.isArray(raw.tags) ? raw.tags : [];
  const tags: KeywordTag[] = [];
  let charSum = 0;
  for (const rawTag of tagsRaw) {
    const item = (rawTag || {}) as Record<string, unknown>;
    const text = String(item.text || "").trim();
    if (!text) continue;
    if (charSum + text.length + 1 > 480) break;
    charSum += text.length + 1;
    const typeVal =
      item.type === "core" || item.type === "trending" ? item.type : "long_tail";
    const volVal =
      item.volume === "عالي جداً" || item.volume === "عالي" || item.volume === "متوسط"
        ? item.volume
        : "عالي";
    const compVal =
      item.competition === "منخفضة" || item.competition === "متوسطة" || item.competition === "عالية"
        ? item.competition
        : "منخفضة";
    tags.push({
      text,
      type: typeVal,
      volume: volVal,
      competition: compVal,
      score: Math.min(99, Math.max(70, Number(item.score) || 90)),
    });
  }

  const finalTags = tags.length >= 3 ? tags : fallback.tags;
  const title = titleCandidates[0]?.title || fallback.title;
  const description =
    typeof raw.description === "string" && raw.description.length > 60
      ? raw.description
      : fallback.description;
  const detectedTopic =
    typeof raw.detectedTopic === "string" && raw.detectedTopic.trim()
      ? raw.detectedTopic.trim()
      : fallback.detectedTopic;
  const focusKeyword =
    typeof raw.focusKeyword === "string" && raw.focusKeyword.trim()
      ? raw.focusKeyword.trim()
      : fallback.focusKeyword;

  const arLines = Array.isArray(raw.arabicSubtitles)
    ? raw.arabicSubtitles.map(String).filter(Boolean).join("\n")
    : "";
  const enLines = Array.isArray(raw.englishSubtitles)
    ? raw.englishSubtitles.map(String).filter(Boolean).join("\n")
    : "";

  const arCap = buildGeneratedCaptions({
    languageCode: "ar",
    topic: detectedTopic,
    title,
    durationSeconds,
    chapters,
    transcriptHint: arLines,
  });
  const enCap = buildGeneratedCaptions({
    languageCode: "en",
    topic: detectedTopic,
    title,
    durationSeconds,
    chapters,
    transcriptHint: enLines,
  });

  const suggestedCategoryId =
    typeof raw.suggestedCategoryId === "string" && /^\d+$/.test(raw.suggestedCategoryId)
      ? raw.suggestedCategoryId
      : fallback.suggestedCategoryId;

  const breakdown = calculateSeoBreakdown({
    title,
    description,
    hashtags,
    tags: finalTags,
    captionsCount: 2,
    videoLanguage: fallback.suggestedLanguage,
    categoryId: suggestedCategoryId,
    focusKeyword,
  });

  return {
    aiProviderUsed: provider,
    detectedTopic,
    detectedAudience:
      typeof raw.detectedAudience === "string" && raw.detectedAudience.trim()
        ? raw.detectedAudience.trim()
        : fallback.detectedAudience,
    bestPublishTime:
      typeof raw.bestPublishTime === "string" && raw.bestPublishTime.trim()
        ? raw.bestPublishTime.trim()
        : fallback.bestPublishTime,
    focusKeyword,
    suggestedCategoryId,
    suggestedLanguage: fallback.suggestedLanguage,
    title,
    titleCandidates,
    description,
    chapters,
    hashtags,
    tags: finalTags,
    seoScore: breakdown.total,
    captions: [
      { languageCode: "ar", ...arCap },
      { languageCode: "en", ...enCap },
    ],
  };
}

export async function analyzeVideoWithAi(
  input: AnalyzeVideoInput
): Promise<AnalyzeVideoResult> {
  const cfg = await getRuntimeConfig();
  const fallback = buildBuiltinAnalysis(input);

  if (cfg.activeAiEngine === "openai" && cfg.openaiApiKey) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-4o-mini",
          temperature: 0.7,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: buildAiSystemPrompt(input) },
            { role: "user", content: buildAiUserPrompt(input) },
          ],
        }),
        signal: AbortSignal.timeout(35_000),
      });

      if (resp.ok) {
        const data = (await resp.json()) as {
          choices?: Array<{ message?: { content?: string } }>;
        };
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content) as Record<string, unknown>;
          return normalizeLlmPayload(parsed, fallback, "openai", input.durationSeconds);
        }
      }
    } catch (err) {
      console.warn("OpenAI fallback triggered:", err);
    }
  }

  if (cfg.activeAiEngine === "gemini" && cfg.geminiApiKey) {
    try {
      const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(cfg.geminiApiKey)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            generationConfig: {
              responseMimeType: "application/json",
              temperature: 0.7,
            },
            contents: [
              {
                role: "user",
                parts: [
                  {
                    text: `${buildAiSystemPrompt(input)}\n\n${buildAiUserPrompt(input)}`,
                  },
                ],
              },
            ],
          }),
          signal: AbortSignal.timeout(35_000),
        }
      );

      if (resp.ok) {
        const data = (await resp.json()) as {
          candidates?: Array<{
            content?: { parts?: Array<{ text?: string }> };
          }>;
        };
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          const cleaned = text.replace(/^```json\s*|\s*```$/g, "").trim();
          const parsed = JSON.parse(cleaned) as Record<string, unknown>;
          return normalizeLlmPayload(parsed, fallback, "gemini", input.durationSeconds);
        }
      }
    } catch (err) {
      console.warn("Gemini fallback triggered:", err);
    }
  }

  return fallback;
}
