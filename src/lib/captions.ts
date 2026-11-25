import type { CaptionCue, VideoChapter } from "@/db/schema";
import { VIDEO_LANGUAGES } from "./youtube-constants";

function formatSrtTimestamp(totalSec: number): string {
  const safe = Math.max(0, totalSec);
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = Math.floor(safe % 60);
  const ms = Math.round((safe - Math.floor(safe)) * 1000);
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(Math.min(ms, 999)).padStart(3, "0")}`;
}

export function cuesToSrt(cues: CaptionCue[]): string {
  return cues
    .map((cue, idx) => `${idx + 1}\n${cue.start} --> ${cue.end}\n${cue.text.trim()}\n`)
    .join("\n");
}

export function cuesToVtt(cues: CaptionCue[]): string {
  const body = cues
    .map(
      (cue) =>
        `${cue.start.replace(",", ".")} --> ${cue.end.replace(",", ".")}\n${cue.text.trim()}\n`
    )
    .join("\n");
  return `WEBVTT\n\n${body}`;
}

export function getCaptionLanguageName(code: string): string {
  const match = VIDEO_LANGUAGES.find((l) => l.code === code);
  return match ? `${match.label} (${match.native})` : code.toUpperCase();
}

export function buildGeneratedCaptions(params: {
  languageCode: string;
  topic: string;
  title: string;
  durationSeconds: number;
  chapters: VideoChapter[];
  transcriptHint?: string;
}): { cues: CaptionCue[]; srtContent: string; languageName: string } {
  const duration = Math.max(45, params.durationSeconds || 420);
  const topic = params.topic || params.title || "هذا الموضوع المهم";
  const lang = params.languageCode;
  const languageName = getCaptionLanguageName(lang);

  // If user provided actual transcript lines and generating primary Arabic/English
  const rawLines = (params.transcriptHint || "")
    .split(/[\n.!؟]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 6);

  let lines: string[] = [];

  if (lang === "ar") {
    if (rawLines.length >= 4) {
      lines = rawLines.slice(0, 12);
    } else {
      const chLabels = params.chapters.map((c) => c.label);
      lines = [
        `أهلاً بكم في فيديو جديد حول ${topic}.`,
        `في الدقائق القادمة سنشرح أهم الخطوات العملية بالتفصيل وبأسلوب بسيط جداً.`,
        chLabels[1]
          ? `أولاً نبدأ بـ ${chLabels[1]} لكي تضع أساساً صحيحاً منذ البداية.`
          : `أولاً نبدأ بتجهيز الأساسيات المطلوبة خطوة بخطوة.`,
        `لاحظ هذه النقطة المهمة لأنها تصنع الفارق الأكبر في النتائج النهائية.`,
        chLabels[2]
          ? `ننتقل الآن إلى ${chLabels[2]} مع تطبيق عملي مباشر أمامك.`
          : `الآن ننتقل إلى التطبيق العملي خطوة بخطوة دون أي تعقيد.`,
        `كثير من المبتدئين يقعون في أخطاء شائعة هنا، ولذلك نركز على الطريقة الصحيحة.`,
        chLabels[3]
          ? `في هذا الجزء نستعرض ${chLabels[3]} وأهم النصائح الاحترافية.`
          : `إليك أهم النصائح الاحترافية للحصول على أفضل أداء ونتيجة مضمونة.`,
        `كما ترى النتيجة ظهرت بسرعة ودقة عالية بعد تطبيق الإعدادات الصحيحة.`,
        `إذا استفدت من الشرح لا تنسَ الإعجاب بالفيديو والاشتراك في القناة وتفعيل الجرس.`,
        `اكتب سؤالك في التعليقات وسأرد عليك، وأشوفكم في الفيديو القادم!`,
      ];
    }
  } else if (lang === "en") {
    lines = [
      `Welcome back! Today we cover everything you need to know about ${topic}.`,
      `By the end of this video, you will have a clear, step-by-step workflow ready to apply.`,
      `First, let's set up the core essentials properly to avoid common mistakes.`,
      `Pay close attention to this key detail — it makes the biggest difference in results.`,
      `Now let's jump into the live practical walkthrough together step by step.`,
      `You can double-check every setting here for the highest search visibility and quality.`,
      `Here are the top pro tips that will save you hours of trial and error.`,
      `As you can see, the final result works cleanly and delivers great performance.`,
      `If you found this guide helpful, drop a like and subscribe for more practical tutorials.`,
      `Leave your questions in the comments below — see you in the next video!`,
    ];
  } else if (lang === "fr") {
    lines = [
      `Bienvenue dans cette nouvelle vidéo consacrée à ${topic}.`,
      `Nous allons découvrir ensemble chaque étape pratique de manière claire et simple.`,
      `Commençons d'abord par les bases essentielles pour bien démarrer.`,
      `Portez une attention particulière à ce point clé qui fait toute la différence.`,
      `Passons maintenant à la démonstration pratique étape par étape.`,
      `Voici les meilleurs conseils professionnels pour obtenir des résultats optimaux.`,
      `Comme vous pouvez le voir, tout fonctionne avec rapidité et précision.`,
      `N'oubliez pas d'aimer la vidéo et de vous abonner pour ne rien manquer !`,
    ];
  } else if (lang === "es") {
    lines = [
      `¡Bienvenidos! Hoy explicaremos paso a paso todo sobre ${topic}.`,
      `Aprenderás el método más práctico y efectivo para lograr excelentes resultados.`,
      `Primero configuramos los elementos básicos para evitar errores comunes.`,
      `Este punto es clave porque marca la mayor diferencia en el rendimiento final.`,
      `Ahora pasamos a la demostración práctica con ejemplos reales.`,
      `Estos son los consejos profesionales que te ahorrarán mucho tiempo.`,
      `Como puedes ver, el resultado final es rápido, limpio y muy efectivo.`,
      `Si te sirvió el video, dale me gusta, suscríbete y deja tu comentario.`,
    ];
  } else if (lang === "tr") {
    lines = [
      `Hoş geldiniz! Bugün ${topic} hakkında bilmeniz gereken her şeyi adım adım inceliyoruz.`,
      `Kısa sürede uygulanabilir ve net sonuç veren yöntemleri paylaşacağım.`,
      `Öncelikle doğru temeli atmak için gerekli ayarları yapıyoruz.`,
      `Bu ayrıntı elde edeceğiniz sonucu doğrudan etkileyen en önemli adımdır.`,
      `Şimdi birlikte canlı uygulamalı anlatıma geçelim.`,
      `Daha iyi performans için profesyonel ipuçlarını burada uyguluyoruz.`,
      `Videoyu beğendiyseniz abone olmayı ve yorumlarda sorunuzu yazmayı unutmayın!`,
    ];
  } else if (lang === "de") {
    lines = [
      `Willkommen! Heute zeigen wir Schritt für Schritt alles Wichtige zu ${topic}.`,
      `Am Ende dieses Videos kennst du den kompletten Workflow für starke Ergebnisse.`,
      `Zuerst richten wir die wichtigsten Grundlagen sauber ein.`,
      `Achte besonders auf diesen Punkt — er macht den größten Unterschied.`,
      `Jetzt starten wir direkt mit der praktischen Umsetzung.`,
      `Hier sind die besten Profi-Tipps für maximale Qualität und Reichweite.`,
      `Wenn dir das Video gefallen hat, gib einen Daumen hoch und abonniere den Kanal!`,
    ];
  } else {
    lines = [
      `Welcome to this complete guide covering ${topic}.`,
      `Let us walk through every key setting step by step.`,
      `Applying these practices delivers noticeably stronger results.`,
      `Remember to subscribe, like, and leave your questions in the comments.`,
    ];
  }

  const slot = Math.max(4, Math.floor(duration / lines.length));
  const cues: CaptionCue[] = lines.map((text, idx) => {
    const startSec = idx * slot + (idx === 0 ? 1 : 0);
    const endSec = Math.min(duration, (idx + 1) * slot - 0.4);
    return {
      index: idx + 1,
      start: formatSrtTimestamp(startSec),
      end: formatSrtTimestamp(Math.max(startSec + 2.5, endSec)),
      text,
    };
  });

  return {
    cues,
    srtContent: cuesToSrt(cues),
    languageName,
  };
}
