import { db } from "./index";
import { youtubeChannels, videos, videoCaptions } from "./schema";
import { buildGeneratedCaptions } from "@/lib/captions";
import { count } from "drizzle-orm";

let seedPromise: Promise<void> | null = null;

export async function ensureSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeed().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeed() {
  const existingChannels = await db.select({ total: count() }).from(youtubeChannels);
  if ((existingChannels[0]?.total ?? 0) > 0) return;

  const [channel] = await db
    .insert(youtubeChannels)
    .values({
      youtubeChannelId: "UC_TUBESMART_DEMO_AR01",
      title: "استوديو تك بالعربي",
      handle: "@TechStudioAR",
      description: "قناة متخصصة في شروحات الذكاء الاصطناعي والبرمجة وأسرار صناعة المحتوى على يوتيوب.",
      avatarUrl: "/images/channel-avatar.jpg",
      subscriberCount: 148500,
      videoCount: 124,
      viewCount: 9420000,
      connectionMode: "demo",
      defaultLanguage: "ar",
      defaultCategoryId: "28",
      defaultPrivacy: "public",
      isActive: true,
    })
    .returning();

  const existingVideos = await db.select({ total: count() }).from(videos);
  if ((existingVideos[0]?.total ?? 0) > 0) return;

  const sampleList: Array<typeof videos.$inferInsert> = [
    {
      channelId: channel.id,
      status: "published",
      originalFilename: "youtube-seo-ai-complete-guide-2026.mp4",
      storedPath: null,
      fileSizeBytes: 342_800_000,
      mimeType: "video/mp4",
      durationSeconds: 742,
      resolution: "1920×1080",
      thumbnailUrl: "/images/thumb-youtube-seo.jpg",
      userPrompt: "كيف تتصدر نتائج بحث يوتيوب وتزيد المشاهدات باستخدام الذكاء الاصطناعي",
      transcriptHint: "",
      contentTone: "engaging",
      detectedTopic: "تصدر نتائج بحث يوتيوب وكتابة العناوين والكلمات المفتاحية بالذكاء الاصطناعي",
      detectedAudience: "صنّاع المحتوى وأصحاب قنوات يوتيوب الباحثون عن زيادة المشاهدات",
      bestPublishTime: "الخميس 7:30 مساءً بتوقيت القاهرة",
      aiProviderUsed: "builtin",
      focusKeyword: "تصدر نتائج بحث يوتيوب",
      title: "سر تصدر نتائج بحث يوتيوب بالذكاء الاصطناعي 2026 | ضاعف مشاهداتك!",
      titleCandidates: [
        {
          title: "سر تصدر نتائج بحث يوتيوب بالذكاء الاصطناعي 2026 | ضاعف مشاهداتك!",
          ctrScore: 96,
          seoScore: 98,
          angle: "تصدر البحث الأول",
          reason: "كلمة بحث قوية في البداية + محفّز نتيجة واضحة + السنة الحديثة",
        },
        {
          title: "شرح سيو اليوتيوب الكامل للمبتدئين: عنوان + وصف + تاجز قوية",
          ctrScore: 92,
          seoScore: 95,
          angle: "تعليمي شامل",
          reason: "يجذب الباحثين مباشرة عن ضبط إعدادات سيو الفيديوهات",
        },
        {
          title: "كيف تجعل فيديوهاتك تظهر في الصفحة الأولى على يوتيوب مجاناً؟",
          ctrScore: 94,
          seoScore: 92,
          angle: "صيغة سؤال",
          reason: "أسئلة الكيفية ترفع نسبة النقر CTR في نتائج البحث العربية",
        },
      ],
      chapters: [
        { time: "00:00", label: "المقدمة: لماذا لا تتصدر أغلب الفيديوهات؟" },
        { time: "01:45", label: "كتابة عنوان جذاب يرفع نسبة النقر CTR" },
        { time: "04:10", label: "صياغة وصف قوي بالهاشتاجات والفصول" },
        { time: "07:20", label: "استخراج الكلمات المفتاحية الطويلة (Long-Tail Tags)" },
        { time: "10:15", label: "إضافة الترجمات وضبط اللغة قبل النشر" },
      ],
      hashtags: ["#سيو_اليوتيوب", "#زيادة_المشاهدات", "#صناعة_المحتوى", "#الذكاء_الاصطناعي", "#يوتيوب_2026"],
      description:
        "في هذا الفيديو العملي نكشف لك خطوة بخطوة سر تصدر نتائج بحث يوتيوب ومضاعفة المشاهدات باستخدام أدوات الذكاء الاصطناعي لعام 2026.\n\nستتعلم كيف تختار عنواناً جذاباً يرفع نسبة النقر، وكيف تكتب وصفاً قوياً مهيأً لمحركات البحث، واستخراج كلمات مفتاحية طويلة الذيل قليلة المنافسة وعالية البحث، مع ضبط إعدادات اللغة والترجمات قبل النشر.\n\n⏱️ فصول الفيديو:\n00:00 المقدمة: لماذا لا تتصدر أغلب الفيديوهات؟\n01:45 كتابة عنوان جذاب يرفع نسبة النقر CTR\n04:10 صياغة وصف قوي بالهاشتاجات والفصول\n07:20 استخراج الكلمات المفتاحية الطويلة (Long-Tail Tags)\n10:15 إضافة الترجمات وضبط اللغة قبل النشر\n\n🔔 اشترك في القناة وفعّل الجرس ليصلك كل جديد أسبوعياً!\n\n#سيو_اليوتيوب #زيادة_المشاهدات #صناعة_المحتوى #الذكاء_الاصطناعي #يوتيوب_2026",
      tags: [
        { text: "كيفية تصدر نتائج البحث في اليوتيوب 2026", type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 98 },
        { text: "زيادة مشاهدات اليوتيوب بالذكاء الاصطناعي مجانا", type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 96 },
        { text: "اختيار الكلمات المفتاحية القوية لفيديوهات اليوتيوب", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 94 },
        { text: "طريقة كتابة عنوان ووصف احترافي لفيديو يوتيوب", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 93 },
        { text: "اسرار سيو اليوتيوب للمبتدئين خطوة بخطوة", type: "long_tail", volume: "عالي جداً", competition: "متوسطة", score: 91 },
        { text: "ضبط اعدادات رفع الفيديو على اليوتيوب صح", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 90 },
        { text: "اضافة ترجمة تلقائية لفيديوهات اليوتيوب", type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 88 },
        { text: "سيو اليوتيوب 2026", type: "trending", volume: "عالي جداً", competition: "متوسطة", score: 92 },
        { text: "تاجز قوية لليوتيوب", type: "core", volume: "عالي", competition: "منخفضة", score: 89 },
      ],
      seoScore: 96,
      videoLanguage: "ar",
      metadataLanguage: "ar",
      categoryId: "27",
      privacyStatus: "public",
      madeForKids: false,
      license: "youtube",
      playlistName: "أسرار نمو قنوات اليوتيوب",
      allowComments: true,
      allowEmbedding: true,
      notifySubscribers: true,
      recordingLocation: "القاهرة، مصر",
      recordingDate: "2026-03-10",
      youtubeVideoId: "demo_ytSEO2026",
      youtubeUrl: "https://www.youtube.com/watch?v=demo_ytSEO2026",
      publishMode: "demo_simulation",
      publishLog: [
        { step: "التحقق من ربط القناة", status: "done", detail: "متصل بقناة استوديو تك بالعربي", at: new Date().toISOString() },
        { step: "رفع الفيديو وبيانات السيو", status: "done", detail: "تم تطبيق العنوان والوصف و9 كلمات مفتاحية طويلة", at: new Date().toISOString() },
        { step: "رفع ملفات الترجمة", status: "done", detail: "تم إرفاق ترجمة العربية (AR) والإنجليزية (EN)", at: new Date().toISOString() },
      ],
      publishedAt: new Date(Date.now() - 2 * 86400_000),
    },
    {
      channelId: channel.id,
      status: "ready",
      originalFilename: "deploy-nodejs-ubuntu-github-pm2.mp4",
      storedPath: null,
      fileSizeBytes: 518_400_000,
      mimeType: "video/mp4",
      durationSeconds: 915,
      resolution: "1920×1080",
      thumbnailUrl: "/images/thumb-ubuntu-node.jpg",
      userPrompt: "شرح رفع موقع Node.js من GitHub على سيرفر أوبونتو Ubuntu وتشغيله بـ PM2 و Nginx",
      transcriptHint: "",
      contentTone: "tech",
      detectedTopic: "رفع موقع Node.js و Next.js من GitHub على سيرفر أوبونتو مع Nginx و SSL",
      detectedAudience: "المبرمجون ومطورو الويب Full-Stack ومستخدمو لينكس وأوبونتو",
      bestPublishTime: "الأحد 8:00 مساءً بتوقيت القاهرة",
      aiProviderUsed: "builtin",
      focusKeyword: "رفع موقع Node.js على أوبونتو",
      title: "رفع موقع Node.js من GitHub على سيرفر أوبونتو Ubuntu خطوة بخطوة (2026)",
      titleCandidates: [
        {
          title: "رفع موقع Node.js من GitHub على سيرفر أوبونتو Ubuntu خطوة بخطوة (2026)",
          ctrScore: 94,
          seoScore: 98,
          angle: "تصدر البحث التقني",
          reason: "يحتوي كل الكلمات البحثية المستهدفة بدقة عالية ومباشرة",
        },
        {
          title: "نشر تطبيقك على Ubuntu VPS مع PM2 و Nginx وشهادة SSL مجانية!",
          ctrScore: 95,
          seoScore: 93,
          angle: "قيمة عملية عالية",
          reason: "يجذب المطورين الباحثين عن خطوات الإنتاج النهائية الكاملة",
        },
        {
          title: "أسهل طريقة لرفع مشروعك من جيتهب إلى سيرفر أوبونتو في 15 دقيقة",
          ctrScore: 92,
          seoScore: 91,
          angle: "سرعة وسهولة",
          reason: "تحديد الزمن يشجع المطورين على الضغط والمشاهدة للنهاية",
        },
      ],
      chapters: [
        { time: "00:00", label: "مقدمة ومتطلبات السيرفر" },
        { time: "02:10", label: "تثبيت Node.js 20 و PostgreSQL على Ubuntu" },
        { time: "05:30", label: "سحب المشروع من GitHub وإعداد ملف .env" },
        { time: "09:05", label: "تشغيل التطبيق دائماً باستخدام PM2" },
        { time: "12:20", label: "ربط الدومين عبر Nginx وتفعيل SSL" },
      ],
      hashtags: ["#NodeJS", "#Ubuntu", "#GitHub", "#برمجة", "#تطوير_الويب", "#Nginx"],
      description:
        "شرح عملي كامل لكيفية رفع ونشر موقع Node.js أو Next.js من GitHub على سيرفر Ubuntu VPS باستخدام PM2 و Nginx وشهادة أمان HTTPS مجانية خطوة بخطوة.\n\n⏱️ فصول الفيديو:\n00:00 مقدمة ومتطلبات السيرفر\n02:10 تثبيت Node.js 20 و PostgreSQL على Ubuntu\n05:30 سحب المشروع من GitHub وإعداد ملف .env\n09:05 تشغيل التطبيق دائماً باستخدام PM2\n12:20 ربط الدومين عبر Nginx وتفعيل SSL\n\n🔔 اشترك في القناة لمزيد من شروحات البرمجة ونشر السيرفرات!\n\n#NodeJS #Ubuntu #GitHub #برمجة #تطوير_الويب #Nginx",
      tags: [
        { text: "رفع موقع node js على سيرفر اوبونتو 2026", type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 97 },
        { text: "نشر مشروع من github على ubuntu خطوة بخطوة", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 95 },
        { text: "تشغيل تطبيق nodejs باستخدام pm2 على لينكس", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 93 },
        { text: "شرح اعداد nginx reverse proxy لموقع nodejs", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 92 },
        { text: "رفع موقع next js على استضافة vps ubuntu", type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 94 },
        { text: "تثبيت شهادة ssl مجانية certbot nginx ubuntu", type: "long_tail", volume: "متوسط", competition: "منخفضة", score: 89 },
        { text: "deploy nodejs app ubuntu server", type: "trending", volume: "عالي جداً", competition: "متوسطة", score: 91 },
      ],
      seoScore: 95,
      videoLanguage: "ar",
      metadataLanguage: "ar",
      categoryId: "28",
      privacyStatus: "public",
      madeForKids: false,
      license: "youtube",
      playlistName: "شروحات البرمجة والسيرفرات",
      allowComments: true,
      allowEmbedding: true,
      notifySubscribers: true,
      recordingLocation: "القاهرة، مصر",
      recordingDate: "2026-03-14",
      youtubeVideoId: null,
      youtubeUrl: null,
      publishMode: null,
      publishLog: [],
      publishedAt: null,
    },
    {
      channelId: channel.id,
      status: "scheduled",
      originalFilename: "top-ai-tools-content-creators.mp4",
      storedPath: null,
      fileSizeBytes: 289_500_000,
      mimeType: "video/mp4",
      durationSeconds: 618,
      resolution: "3840×2160",
      thumbnailUrl: "/images/thumb-ai-studio.jpg",
      userPrompt: "أقوى أدوات الذكاء الاصطناعي لصناع المحتوى واليوتيوبرز لتوفير 10 ساعات أسبوعياً",
      transcriptHint: "",
      contentTone: "engaging",
      detectedTopic: "أفضل أدوات الذكاء الاصطناعي المجانية لصناع محتوى يوتيوب",
      detectedAudience: "صنّاع المحتوى والمسوقون وأصحاب القنوات العربية",
      bestPublishTime: "الجمعة 7:00 مساءً بتوقيت القاهرة",
      aiProviderUsed: "builtin",
      focusKeyword: "أدوات الذكاء الاصطناعي لصناع المحتوى",
      title: "أقوى 7 أدوات ذكاء اصطناعي لكل يوتيوبر في 2026 (توفر 10 ساعات أسبوعياً!)",
      titleCandidates: [
        {
          title: "أقوى 7 أدوات ذكاء اصطناعي لكل يوتيوبر في 2026 (توفر 10 ساعات أسبوعياً!)",
          ctrScore: 97,
          seoScore: 95,
          angle: "أعلى نقر وتريند",
          reason: "رقم محدد + فائدة ملموسة + استهداف جمهور صناع المحتوى",
        },
        {
          title: "كيف تدير قناة يوتيوب كاملة بالذكاء الاصطناعي مجاناً خطوة بخطوة",
          ctrScore: 93,
          seoScore: 94,
          angle: "بحث عام عالي",
          reason: "كلمة بحث عالية الطلب في الوطن العربي",
        },
      ],
      chapters: [
        { time: "00:00", label: "المقدمة" },
        { time: "01:30", label: "أداة توليد الأفكار والسكربتات" },
        { time: "04:15", label: "أتمتة العناوين والوصف والتاجز" },
        { time: "07:20", label: "توليد الترجمات التلقائية بعدة لغات" },
        { time: "09:10", label: "الخلاصة وترتيب الأدوات" },
      ],
      hashtags: ["#الذكاء_الاصطناعي", "#أدوات_ذكاء_اصطناعي", "#صناعة_المحتوى", "#يوتيوب", "#AI"],
      description:
        "تعرّف على أقوى 7 أدوات ذكاء اصطناعي مجانية ومدفوعة تساعد كل صانع محتوى على كتابة السكربتات، وتحسين السيو، وإضافة الترجمات، ومضاعفة المشاهدات في وقت قياسي.\n\n⏱️ فصول الفيديو:\n00:00 المقدمة\n01:30 أداة توليد الأفكار والسكربتات\n04:15 أتمتة العناوين والوصف والتاجز\n07:20 توليد الترجمات التلقائية بعدة لغات\n09:10 الخلاصة وترتيب الأدوات\n\n#الذكاء_الاصطناعي #أدوات_ذكاء_اصطناعي #صناعة_المحتوى #يوتيوب #AI",
      tags: [
        { text: "افضل ادوات الذكاء الاصطناعي لصناع المحتوى 2026", type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 97 },
        { text: "مواقع الذكاء الاصطناعي المجانية لليوتيوب", type: "long_tail", volume: "عالي جداً", competition: "منخفضة", score: 95 },
        { text: "انشاء قناة يوتيوب كاملة بالذكاء الاصطناعي", type: "long_tail", volume: "عالي", competition: "متوسطة", score: 92 },
        { text: "توليد ترجمة تلقائية للفيديو بالذكاء الاصطناعي", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 90 },
        { text: "ادوات ذكاء اصطناعي مجانية لتوفير الوقت", type: "long_tail", volume: "عالي", competition: "منخفضة", score: 89 },
        { text: "الذكاء الاصطناعي 2026", type: "trending", volume: "عالي جداً", competition: "عالية", score: 87 },
      ],
      seoScore: 93,
      videoLanguage: "ar",
      metadataLanguage: "ar",
      categoryId: "28",
      privacyStatus: "scheduled",
      scheduledAt: new Date(Date.now() + 3 * 86400_000),
      madeForKids: false,
      license: "youtube",
      playlistName: "دليل الذكاء الاصطناعي العملي",
      allowComments: true,
      allowEmbedding: true,
      notifySubscribers: true,
      recordingLocation: "الإسكندرية، مصر",
      recordingDate: "2026-03-16",
      youtubeVideoId: "demo_aiTools26",
      youtubeUrl: "https://www.youtube.com/watch?v=demo_aiTools26",
      publishMode: "demo_simulation",
      publishLog: [
        { step: "جدولة النشر على يوتيوب", status: "done", detail: "مجدول للنشر التلقائي بعد 3 أيام", at: new Date().toISOString() },
      ],
      publishedAt: null,
    },
  ];

  for (const item of sampleList) {
    const [inserted] = await db.insert(videos).values(item).returning();
    const arCap = buildGeneratedCaptions({
      languageCode: "ar",
      topic: inserted.detectedTopic,
      title: inserted.title,
      durationSeconds: inserted.durationSeconds,
      chapters: inserted.chapters,
    });
    const enCap = buildGeneratedCaptions({
      languageCode: "en",
      topic: inserted.detectedTopic,
      title: inserted.title,
      durationSeconds: inserted.durationSeconds,
      chapters: inserted.chapters,
    });
    await db.insert(videoCaptions).values([
      {
        videoId: inserted.id,
        languageCode: "ar",
        languageName: arCap.languageName,
        isAutoSync: true,
        includeInUpload: true,
        cues: arCap.cues,
        srtContent: arCap.srtContent,
      },
      {
        videoId: inserted.id,
        languageCode: "en",
        languageName: enCap.languageName,
        isAutoSync: true,
        includeInUpload: true,
        cues: enCap.cues,
        srtContent: enCap.srtContent,
      },
    ]);
  }
}
