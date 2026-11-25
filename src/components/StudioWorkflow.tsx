"use client";

import { useState, useRef, useMemo, useEffect } from "react";
import {
  Upload,
  Sparkles,
  Check,
  CheckCircle2,
  Copy,
  RefreshCw,
  Plus,
  X,
  ArrowLeft,
  ArrowRight,
  Globe,
  Subtitles,
  Download,
  Send,
  Search,
  Hash,
  Tag,
  Clock,
  SlidersHorizontal,
  ExternalLink,
  Trash2,
  ImagePlus,
  Users,
  Calendar,
  AlertTriangle,
  FileVideo,
  Link2,
  Loader2,
  FileDown,
  ChevronDown,
  ChevronUp,
  Play,
  Wand2,
} from "lucide-react";
import type {
  CaptionDTO,
  ChannelDTO,
  NavView,
  StudioStep,
  VideoDTO,
} from "@/types/studio";
import type { KeywordTag, CaptionCue } from "@/db/schema";
import {
  CONTENT_TONES,
  PRIVACY_OPTIONS,
  VIDEO_LANGUAGES,
  YOUTUBE_CATEGORIES,
  calculateSeoBreakdown,
  formatCompactNumber,
  formatDuration,
  formatFileSize,
  getCategoryLabel,
  getLanguageLabel,
} from "@/lib/youtube-constants";
import { SeoScoreRing } from "./SeoScoreRing";

interface StudioWorkflowProps {
  activeChannel: ChannelDTO | null;
  activeVideo: VideoDTO | null;
  activeCaptions: CaptionDTO[];
  step: StudioStep;
  activeAiEngine: "openai" | "gemini" | "builtin";
  onStepChange: (s: StudioStep) => void;
  onVideoLoaded: (video: VideoDTO | null, captions: CaptionDTO[]) => void;
  onVideoMutated: (video: VideoDTO) => void;
  onCaptionsMutated: (captions: CaptionDTO[]) => void;
  onRefreshLibrary: () => Promise<void>;
  onNavigate: (view: NavView) => void;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

const QUICK_SAMPLES = [
  {
    label: "شرح سيو اليوتيوب وتصدر البحث",
    filename: "youtube-seo-ranking-secrets-2026.mp4",
    prompt: "شرح أقوى استراتيجية لتصدر نتائج بحث يوتيوب ومضاعفة المشاهدات بالذكاء الاصطناعي للمبتدئين",
    categoryId: "27",
    duration: 685,
    thumb: "/images/thumb-youtube-seo.jpg",
  },
  {
    label: "نشر موقع Node.js على أوبونتو",
    filename: "deploy-nodejs-github-ubuntu-vps.mp4",
    prompt: "طريقة رفع موقع Node.js من جيتهب GitHub على سيرفر أوبونتو Ubuntu وتشغيله مع PM2 و Nginx",
    categoryId: "28",
    duration: 840,
    thumb: "/images/thumb-ubuntu-node.jpg",
  },
  {
    label: "أدوات الذكاء الاصطناعي لصناع المحتوى",
    filename: "best-free-ai-tools-creators.mp4",
    prompt: "أفضل أدوات الذكاء الاصطناعي المجانية لإدارة قنوات اليوتيوب وتوليد العناوين والترجمات تلقائياً",
    categoryId: "28",
    duration: 590,
    thumb: "/images/thumb-ai-studio.jpg",
  },
];

async function extractVideoMetadata(file: File): Promise<{
  duration: number;
  resolution: string;
  thumbnailDataUrl: string;
  objectUrl: string;
}> {
  const objectUrl = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const videoEl = document.createElement("video");
    videoEl.preload = "metadata";
    videoEl.muted = true;
    videoEl.playsInline = true;
    videoEl.src = objectUrl;

    const timeout = setTimeout(() => {
      resolve({
        duration: 0,
        resolution: "1920×1080",
        thumbnailDataUrl: "",
        objectUrl,
      });
    }, 6000);

    videoEl.onloadedmetadata = () => {
      const dur = Number.isFinite(videoEl.duration) ? Math.round(videoEl.duration) : 0;
      const w = videoEl.videoWidth || 1920;
      const h = videoEl.videoHeight || 1080;
      const resolution = `${w}×${h}`;

      const captureFrame = () => {
        try {
          const canvas = document.createElement("canvas");
          const targetW = 640;
          const targetH = Math.max(240, Math.round((h / w) * targetW));
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext("2d");
          let thumb = "";
          if (ctx) {
            ctx.drawImage(videoEl, 0, 0, targetW, targetH);
            thumb = canvas.toDataURL("image/jpeg", 0.82);
          }
          clearTimeout(timeout);
          resolve({ duration: dur, resolution, thumbnailDataUrl: thumb, objectUrl });
        } catch {
          clearTimeout(timeout);
          resolve({ duration: dur, resolution, thumbnailDataUrl: "", objectUrl });
        }
      };

      videoEl.onseeked = captureFrame;
      try {
        videoEl.currentTime = Math.min(Math.max(dur * 0.15, 0.5), Math.max(dur - 0.5, 0));
      } catch {
        captureFrame();
      }
    };

    videoEl.onerror = () => {
      clearTimeout(timeout);
      resolve({
        duration: 0,
        resolution: "1920×1080",
        thumbnailDataUrl: "",
        objectUrl,
      });
    };
  });
}

export function StudioWorkflow({
  activeChannel,
  activeVideo,
  activeCaptions,
  step,
  activeAiEngine,
  onStepChange,
  onVideoLoaded,
  onVideoMutated,
  onCaptionsMutated,
  onRefreshLibrary,
  onNavigate,
  notify,
}: StudioWorkflowProps) {
  // Upload form states
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbInputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string>("");
  const [extractedMeta, setExtractedMeta] = useState<{
    duration: number;
    resolution: string;
    thumbnailDataUrl: string;
  }>({ duration: 0, resolution: "1920×1080", thumbnailDataUrl: "" });
  const [uploadPrompt, setUploadPrompt] = useState("");
  const [transcriptHint, setTranscriptHint] = useState("");
  const [showScriptInput, setShowScriptInput] = useState(false);
  const [uploadLanguage, setUploadLanguage] = useState(
    activeChannel?.defaultLanguage || "ar"
  );
  const [uploadCategory, setUploadCategory] = useState(
    activeChannel?.defaultCategoryId || "28"
  );
  const [uploadTone, setUploadTone] = useState("engaging");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [busyState, setBusyState] = useState<
    null | "uploading" | "analyzing" | "saving" | "tags" | "caption" | "publishing"
  >(null);
  const [publishStageIdx, setPublishStageIdx] = useState(0);

  // Studio editable state synced to activeVideo
  const [draft, setDraft] = useState<VideoDTO | null>(activeVideo);
  const [dirty, setDirty] = useState(false);
  const [newHashtag, setNewHashtag] = useState("");
  const [newTag, setNewTag] = useState("");
  const [expandKeyword, setExpandKeyword] = useState("");
  const [showAllTitles, setShowAllTitles] = useState(true);
  const [activeCaptionId, setActiveCaptionId] = useState<number | null>(null);
  const [editingCues, setEditingCues] = useState<CaptionCue[]>([]);
  const [cuesDirty, setCuesDirty] = useState(false);
  const [addCaptionLang, setAddCaptionLang] = useState("fr");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    setDraft(activeVideo);
    setDirty(false);
    setExpandKeyword(activeVideo?.focusKeyword || "");
  }, [activeVideo]);

  useEffect(() => {
    if (activeCaptions.length > 0) {
      const current = activeCaptions.find((c) => c.id === activeCaptionId) || activeCaptions[0];
      setActiveCaptionId(current.id);
      setEditingCues(current.cues || []);
      setCuesDirty(false);
    } else {
      setActiveCaptionId(null);
      setEditingCues([]);
    }
  }, [activeCaptions, activeCaptionId]);

  // Clean up object URL on unmount/change
  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  const liveBreakdown = useMemo(() => {
    if (!draft) return null;
    return calculateSeoBreakdown({
      title: draft.title || "",
      description: draft.description || "",
      hashtags: draft.hashtags || [],
      tags: draft.tags || [],
      captionsCount: activeCaptions.length,
      videoLanguage: draft.videoLanguage || "ar",
      categoryId: draft.categoryId || "28",
      focusKeyword: draft.focusKeyword || "",
    });
  }, [draft, activeCaptions.length]);

  const copyText = async (text: string, key: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      notify(`تم نسخ ${label}`, "success");
      setTimeout(() => setCopiedKey(null), 1800);
    } catch {
      notify("تعذّر النسخ تلقائياً", "error");
    }
  };

  const handleFileChosen = async (file: File) => {
    if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    setSelectedFile(file);
    const meta = await extractVideoMetadata(file);
    setLocalPreviewUrl(meta.objectUrl);
    setExtractedMeta({
      duration: meta.duration,
      resolution: meta.resolution,
      thumbnailDataUrl: meta.thumbnailDataUrl,
    });
    if (!uploadPrompt) {
      const cleanName = file.name
        .replace(/\.[^/.]+$/, "")
        .replace(/[-_]+/g, " ")
        .trim();
      if (cleanName.length >= 4 && !/^(video|vid|mov|img|rec|\d+)$/i.test(cleanName)) {
        setUploadPrompt(cleanName);
      }
    }
  };

  const uploadWithProgress = (formData: FormData): Promise<VideoDTO> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/videos/upload");
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          setUploadProgress(Math.min(99, Math.round((ev.loaded / ev.total) * 100)));
        }
      };
      xhr.onload = () => {
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300 && data.video) {
            setUploadProgress(100);
            resolve(data.video as VideoDTO);
          } else {
            reject(new Error(data.error || "فشل رفع الفيديو"));
          }
        } catch {
          reject(new Error("استجابة غير صالحة من الخادم"));
        }
      };
      xhr.onerror = () => reject(new Error("تعذّر الاتصال بالخادم أثناء الرفع"));
      xhr.send(formData);
    });
  };

  const runUploadAndAnalyze = async () => {
    if (!selectedFile) {
      notify("اختر ملف فيديو أولاً أو جرّب نموذجاً جاهزاً بالأسفل.", "error");
      return;
    }
    try {
      setBusyState("uploading");
      setUploadProgress(4);

      const fd = new FormData();
      fd.append("file", selectedFile);
      fd.append("userPrompt", uploadPrompt.trim());
      fd.append("transcriptHint", transcriptHint.trim());
      fd.append("contentTone", uploadTone);
      fd.append("videoLanguage", uploadLanguage);
      fd.append("categoryId", uploadCategory);
      fd.append("durationSeconds", String(extractedMeta.duration));
      fd.append("resolution", extractedMeta.resolution);
      if (extractedMeta.thumbnailDataUrl) {
        fd.append("thumbnailDataUrl", extractedMeta.thumbnailDataUrl);
      }

      const uploaded = await uploadWithProgress(fd);

      // Step into automatic AI analysis
      setBusyState("analyzing");
      const aiRes = await fetch(`/api/videos/${uploaded.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: uploadPrompt.trim(),
          transcriptHint: transcriptHint.trim(),
          contentTone: uploadTone,
          videoLanguage: uploadLanguage,
          categoryId: uploadCategory,
        }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error || "فشل التحليل الذكي");

      onVideoLoaded(aiData.video, aiData.captions || []);
      onStepChange("optimize");
      setSelectedFile(null);
      setUploadProgress(0);
      await onRefreshLibrary();
      notify("تم رفع الفيديو وتحليله وتوليد السيو والترجمات بنجاح!", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "حدث خطأ أثناء الرفع", "error");
    } finally {
      setBusyState(null);
      setUploadProgress(0);
    }
  };

  const runQuickSample = async (sample: (typeof QUICK_SAMPLES)[number]) => {
    try {
      setBusyState("analyzing");
      const customPrompt = uploadPrompt.trim() || sample.prompt;
      const createRes = await fetch("/api/videos/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: sample.filename,
          userPrompt: customPrompt,
          transcriptHint: transcriptHint.trim(),
          durationSeconds: sample.duration,
          thumbnailUrl: sample.thumb,
          videoLanguage: uploadLanguage,
          categoryId: sample.categoryId,
          contentTone: uploadTone,
        }),
      });
      const created = await createRes.json();
      if (!createRes.ok) throw new Error(created.error || "تعذّر إنشاء المشروع");

      const aiRes = await fetch(`/api/videos/${created.video.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: customPrompt,
          transcriptHint: transcriptHint.trim(),
          contentTone: uploadTone,
          videoLanguage: uploadLanguage,
          categoryId: sample.categoryId,
        }),
      });
      const aiData = await aiRes.json();
      if (!aiRes.ok) throw new Error(aiData.error || "تعذّر التحليل الذكي");

      onVideoLoaded(aiData.video, aiData.captions || []);
      onStepChange("optimize");
      await onRefreshLibrary();
      notify("تم فهم موضوع الفيديو وتوليد العناوين والوصف والتاجز والترجمات!", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "حدث خطأ", "error");
    } finally {
      setBusyState(null);
    }
  };

  const updateDraft = (patch: Partial<VideoDTO>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  };

  const saveDraft = async (silent = false): Promise<VideoDTO | null> => {
    if (!draft) return null;
    try {
      setBusyState("saving");
      const res = await fetch(`/api/videos/${draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: draft.title,
          description: draft.description,
          userPrompt: draft.userPrompt,
          transcriptHint: draft.transcriptHint,
          contentTone: draft.contentTone,
          focusKeyword: draft.focusKeyword,
          hashtags: draft.hashtags,
          tags: draft.tags,
          thumbnailUrl: draft.thumbnailUrl,
          videoLanguage: draft.videoLanguage,
          metadataLanguage: draft.metadataLanguage,
          categoryId: draft.categoryId,
          privacyStatus: draft.privacyStatus,
          scheduledAt:
            draft.privacyStatus === "scheduled" && draft.scheduledAt
              ? new Date(draft.scheduledAt).toISOString()
              : null,
          madeForKids: draft.madeForKids,
          license: draft.license,
          playlistName: draft.playlistName,
          allowComments: draft.allowComments,
          allowEmbedding: draft.allowEmbedding,
          notifySubscribers: draft.notifySubscribers,
          recordingLocation: draft.recordingLocation,
          recordingDate: draft.recordingDate,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل الحفظ");
      setDraft(data.video);
      setDirty(false);
      onVideoMutated(data.video);
      await onRefreshLibrary();
      if (!silent) notify("تم حفظ جميع التعديلات والإعدادات.", "success");
      return data.video as VideoDTO;
    } catch (err) {
      notify(err instanceof Error ? err.message : "تعذّر الحفظ", "error");
      return null;
    } finally {
      setBusyState(null);
    }
  };

  const rerunAnalysis = async () => {
    if (!draft) return;
    try {
      setBusyState("analyzing");
      const res = await fetch(`/api/videos/${draft.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userPrompt: draft.userPrompt,
          transcriptHint: draft.transcriptHint,
          contentTone: draft.contentTone,
          videoLanguage: draft.videoLanguage,
          categoryId: draft.categoryId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "فشل إعادة التحليل");
      onVideoLoaded(data.video, data.captions || []);
      await onRefreshLibrary();
      notify("تمت إعادة توليد العناوين والوصف والتاجز والترجمات بنجاح!", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "حدث خطأ", "error");
    } finally {
      setBusyState(null);
    }
  };

  const handleGenerateMoreTags = async () => {
    if (!draft) return;
    if (dirty) await saveDraft(true);
    try {
      setBusyState("tags");
      const res = await fetch(`/api/videos/${draft.id}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "more_tags",
          seedKeyword: expandKeyword.trim() || draft.focusKeyword || draft.title,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر توليد كلمات إضافية");
      setDraft(data.video);
      onVideoMutated(data.video);
      if (data.addedCount > 0) {
        notify(`تمت إضافة ${data.addedCount} كلمات مفتاحية طويلة جديدة ضمن حد يوتيوب!`, "success");
      } else {
        notify("وصلت إلى الحد المثالي لعدد حروف التاجز (500 حرف) — احذف كلمة لإضافة أخرى.", "info");
      }
    } catch (err) {
      notify(err instanceof Error ? err.message : "حدث خطأ", "error");
    } finally {
      setBusyState(null);
    }
  };

  const addManualTag = () => {
    if (!draft || !newTag.trim()) return;
    const text = newTag.trim();
    if (draft.tags.some((t) => t.text.toLowerCase() === text.toLowerCase())) {
      setNewTag("");
      return;
    }
    const wordCount = text.split(/\s+/).length;
    const added: KeywordTag = {
      text,
      type: wordCount >= 3 ? "long_tail" : "core",
      volume: wordCount >= 3 ? "عالي" : "عالي جداً",
      competition: wordCount >= 3 ? "منخفضة" : "متوسطة",
      score: wordCount >= 3 ? 91 : 84,
    };
    updateDraft({ tags: [...draft.tags, added] });
    setNewTag("");
  };

  const removeTag = (index: number) => {
    if (!draft) return;
    updateDraft({ tags: draft.tags.filter((_, i) => i !== index) });
  };

  const addHashtag = () => {
    if (!draft || !newHashtag.trim()) return;
    const clean = newHashtag.trim().replace(/^#+/, "").replace(/\s+/g, "_");
    if (!clean) return;
    const formatted = `#${clean}`;
    if (draft.hashtags.includes(formatted)) {
      setNewHashtag("");
      return;
    }
    const nextList = [...draft.hashtags, formatted];
    const nextDesc = draft.description.includes(formatted)
      ? draft.description
      : `${draft.description.trim()} ${formatted}`;
    updateDraft({ hashtags: nextList, description: nextDesc });
    setNewHashtag("");
  };

  const removeHashtag = (tag: string) => {
    if (!draft) return;
    const nextList = draft.hashtags.filter((h) => h !== tag);
    const nextDesc = draft.description.replaceAll(tag, "").replace(/[ \t]{2,}/g, " ").trim();
    updateDraft({ hashtags: nextList, description: nextDesc });
  };

  const handleThumbUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        updateDraft({ thumbnailUrl: reader.result });
        notify("تم تحديث الصورة المصغرة — اضغط حفظ لتأكيدها.", "info");
      }
    };
    reader.readAsDataURL(file);
  };

  // Captions operations
  const handleAddCaption = async (langCode: string) => {
    if (!draft) return;
    try {
      setBusyState("caption");
      const res = await fetch(`/api/videos/${draft.id}/captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ languageCode: langCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر توليد الترجمة");
      const list = activeCaptions.some((c) => c.id === data.caption.id)
        ? activeCaptions.map((c) => (c.id === data.caption.id ? data.caption : c))
        : [...activeCaptions, data.caption];
      onCaptionsMutated(list);
      setActiveCaptionId(data.caption.id);
      setEditingCues(data.caption.cues || []);
      setCuesDirty(false);
      notify(`تم توليد ملف الترجمة (${data.caption.languageName}) بنجاح!`, "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "خطأ", "error");
    } finally {
      setBusyState(null);
    }
  };

  const handleToggleCaptionUpload = async (cap: CaptionDTO) => {
    if (!draft) return;
    const res = await fetch(`/api/videos/${draft.id}/captions`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        captionId: cap.id,
        includeInUpload: !cap.includeInUpload,
      }),
    });
    const data = await res.json();
    if (res.ok && data.caption) {
      onCaptionsMutated(
        activeCaptions.map((c) => (c.id === cap.id ? data.caption : c))
      );
    }
  };

  const handleSaveCues = async () => {
    if (!draft || !activeCaptionId) return;
    try {
      setBusyState("caption");
      const res = await fetch(`/api/videos/${draft.id}/captions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ captionId: activeCaptionId, cues: editingCues }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "تعذّر حفظ الترجمة");
      onCaptionsMutated(
        activeCaptions.map((c) => (c.id === activeCaptionId ? data.caption : c))
      );
      setCuesDirty(false);
      notify("تم حفظ تعديلات الترجمة بصيغة SRT.", "success");
    } catch (err) {
      notify(err instanceof Error ? err.message : "خطأ", "error");
    } finally {
      setBusyState(null);
    }
  };

  const handleDeleteCaption = async (captionId: number) => {
    if (!draft) return;
    const res = await fetch(
      `/api/videos/${draft.id}/captions?captionId=${captionId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      const remaining = activeCaptions.filter((c) => c.id !== captionId);
      onCaptionsMutated(remaining);
      setActiveCaptionId(remaining[0]?.id ?? null);
      notify("تم حذف مسار الترجمة.", "info");
    }
  };

  const handlePublish = async () => {
    if (!draft) return;
    if (!activeChannel) {
      notify("اربط قناة يوتيوب أولاً قبل النشر.", "error");
      onNavigate("channels");
      return;
    }
    if (dirty) {
      const saved = await saveDraft(true);
      if (!saved) return;
    }
    if (cuesDirty) {
      await handleSaveCues();
    }

    setBusyState("publishing");
    setPublishStageIdx(1);
    const stageTimer = setInterval(() => {
      setPublishStageIdx((prev) => Math.min(4, prev + 1));
    }, 520);

    try {
      const res = await fetch(`/api/videos/${draft.id}/publish`, {
        method: "POST",
      });
      const data = await res.json();
      clearInterval(stageTimer);
      setPublishStageIdx(5);

      if (!res.ok) {
        throw new Error(data.error || "فشل نشر الفيديو على يوتيوب");
      }

      setDraft(data.video);
      onVideoMutated(data.video);
      await onRefreshLibrary();
      notify(
        data.mode === "youtube_api"
          ? "تم رفع الفيديو ونشره فعلياً على قناتك في يوتيوب بنجاح!"
          : "تم تجهيز ونشر الفيديو بنجاح مع كامل السيو والإعدادات والترجمات!",
        "success"
      );
    } catch (err) {
      clearInterval(stageTimer);
      notify(err instanceof Error ? err.message : "تعذّر النشر", "error");
    } finally {
      setBusyState(null);
    }
  };

  const exportMetadataPackage = () => {
    if (!draft) return;
    const payload = {
      title: draft.title,
      description: draft.description,
      hashtags: draft.hashtags,
      tags: draft.tags.map((t) => t.text),
      tagsCommaSeparated: draft.tags.map((t) => t.text).join(", "),
      seoScore: liveBreakdown?.total ?? draft.seoScore,
      settings: {
        videoLanguage: draft.videoLanguage,
        metadataLanguage: draft.metadataLanguage,
        categoryId: draft.categoryId,
        categoryLabel: getCategoryLabel(draft.categoryId),
        privacyStatus: draft.privacyStatus,
        scheduledAt: draft.scheduledAt,
        madeForKids: draft.madeForKids,
        license: draft.license,
        playlistName: draft.playlistName,
        allowComments: draft.allowComments,
        allowEmbedding: draft.allowEmbedding,
        notifySubscribers: draft.notifySubscribers,
        recordingLocation: draft.recordingLocation,
      },
      captions: activeCaptions.map((c) => ({
        language: c.languageCode,
        name: c.languageName,
        srt: c.srtContent,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tubesmart-video-${draft.id}-seo.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify("تم تنزيل حزمة بيانات السيو والترجمات JSON.", "success");
  };

  const selectedCaption = activeCaptions.find((c) => c.id === activeCaptionId) || null;
  const availableExtraLanguages = VIDEO_LANGUAGES.filter(
    (l) => !activeCaptions.some((c) => c.languageCode === l.code)
  );
  const scheduledInputValue = useMemo(() => {
    if (!draft?.scheduledAt) {
      const tomorrow = new Date(Date.now() + 24 * 3600_000);
      return tomorrow.toISOString().slice(0, 16);
    }
    const dt = new Date(draft.scheduledAt);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 16);
  }, [draft?.scheduledAt]);

  const tagsChars = liveBreakdown?.tagsCharCount ?? 0;
  const tagsPct = Math.min(100, Math.round((tagsChars / 500) * 100));

  const pipelineSteps: Array<{
    key: StudioStep;
    num: string;
    label: string;
    disabled: boolean;
  }> = [
    { key: "upload", num: "1", label: "رفع الفيديو", disabled: false },
    { key: "optimize", num: "2", label: "العنوان والوصف والتاجز", disabled: !draft },
    { key: "publish", num: "3", label: "الإعدادات والترجمة والنشر", disabled: !draft },
  ];

  const isRealOauthReady =
    activeChannel?.connectionMode === "oauth" && Boolean(draft?.storedPath);

  return (
    <div className="mx-auto max-w-[1160px] space-y-6">
      {/* Compact Connected Channel Strip */}
      <div className="studio-card flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
        {activeChannel ? (
          <div className="flex items-center gap-3.5">
            <img
              src={activeChannel.avatarUrl || "/images/channel-avatar.jpg"}
              alt={activeChannel.title}
              className="h-10 w-10 rounded-full border border-[#E7E7EC] object-cover"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#111216]">
                  {activeChannel.title}
                </span>
                <span
                  dir="ltr"
                  className="text-xs font-medium text-[#7B7F8C]"
                >
                  {activeChannel.handle}
                </span>
                {activeChannel.connectionMode === "oauth" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#B7F0D8] bg-[#ECFDF5] px-2 py-0.5 text-[11px] font-semibold text-[#066E49]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0B875B]" />
                    ربط مباشر OAuth
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[#E4E4EA] bg-[#F4F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#525560]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#0B875B]" />
                    قناة متصلة · وضع تجريبي
                  </span>
                )}
              </div>
              <p className="text-xs text-[#7B7F8C] tabular-nums">
                {formatCompactNumber(activeChannel.subscriberCount)} مشترك ·{" "}
                {activeChannel.videoCount} فيديو · اللغة الافتراضية:{" "}
                {getLanguageLabel(activeChannel.defaultLanguage)}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF1F2] text-[#E5192D]">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#111216]">لم يتم ربط قناة يوتيوب بعد</p>
              <p className="text-xs text-[#6B707D]">
                اربط قناتك عبر Google OAuth لرفع الفيديوهات مباشرة
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {draft && step !== "upload" && (
            <button
              type="button"
              onClick={() => {
                onVideoLoaded(null, []);
                onStepChange("upload");
                setUploadPrompt("");
                setTranscriptHint("");
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#E4E4EA] bg-white px-3.5 py-2 text-xs font-semibold text-[#2A2D36] transition hover:bg-[#F5F5F8]"
            >
              <Plus className="h-3.5 w-3.5" />
              فيديو جديد
            </button>
          )}
          <button
            type="button"
            onClick={() => onNavigate("channels")}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              activeChannel?.connectionMode === "oauth"
                ? "border border-[#E4E4EA] bg-white text-[#2A2D36] hover:bg-[#F5F5F8]"
                : "border border-[#FECDD3] bg-[#FFF1F2] text-[#C81224] hover:bg-[#FFE4E6]"
            }`}
          >
            <Link2 className="h-3.5 w-3.5" />
            {activeChannel?.connectionMode === "oauth"
              ? "إدارة القناة"
              : activeChannel
                ? "تفعيل الربط الحقيقي"
                : "ربط قناة يوتيوب"}
          </button>
        </div>
      </div>

      {/* Horizontal Studio Stepper */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#E7E7EC] bg-white p-1.5 shadow-[0_1px_2px_rgba(17,18,22,0.03)]">
          {pipelineSteps.map((st, idx) => {
            const active = step === st.key;
            const completed =
              (st.key === "upload" && Boolean(draft) && step !== "upload") ||
              (st.key === "optimize" && Boolean(draft?.title) && step === "publish");
            return (
              <button
                key={st.key}
                type="button"
                disabled={st.disabled}
                onClick={() => !st.disabled && onStepChange(st.key)}
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  active
                    ? "bg-[#111216] text-white shadow-xs"
                    : completed
                      ? "bg-[#ECFDF5] text-[#066E49] hover:bg-[#DCFCE7]"
                      : st.disabled
                        ? "cursor-not-allowed text-[#B0B4C0]"
                        : "text-[#525560] hover:bg-[#F4F4F7] hover:text-[#111216]"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold tabular-nums ${
                    active
                      ? "bg-[#E5192D] text-white"
                      : completed
                        ? "bg-[#0B875B] text-white"
                        : "bg-[#EFEFF3] text-[#6B707D]"
                  }`}
                >
                  {completed ? <Check className="h-3 w-3" /> : st.num}
                </span>
                <span>{st.label}</span>
                {idx < pipelineSteps.length - 1 && <span className="sr-only">←</span>}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#6B707D]">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#E6E1FF] bg-[#F5F2FF] px-3 py-1 font-semibold text-[#5B3DF5]">
            <Sparkles className="h-3.5 w-3.5" />
            {activeAiEngine === "openai"
              ? "OpenAI متصل"
              : activeAiEngine === "gemini"
                ? "Google Gemini متصل"
                : "محرك الذكاء المدمج جاهز"}
          </span>
        </div>
      </div>

      {/* ================================================================= */}
      {/* STEP 1: UPLOAD VIDEO & TOPIC CONTEXT                              */}
      {/* ================================================================= */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="studio-card overflow-hidden">
            <div className="border-b border-[#F0F0F4] px-6 py-5 sm:px-8">
              <h1 className="text-xl font-extrabold tracking-tight text-[#111216] sm:text-2xl">
                ارفع الفيديو ودع الذكاء الاصطناعي يجهّزه لتصدّر يوتيوب
              </h1>
              <p className="mt-1 text-sm text-[#606470]">
                ارفع ملف الفيديو مباشرة — نُحلل الموضوع ونولّد عنواناً قوياً جذاباً، وصفاً بالهاشتاجات والفصول، كلمات مفتاحية طويلة الذيل، وترجمات تلقائية ثم نرفعه لقناتك.
              </p>
            </div>

            <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-12">
              {/* Dropzone Column */}
              <div className="lg:col-span-7">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleFileChosen(f);
                  }}
                />

                {!selectedFile ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        fileInputRef.current?.click();
                      }
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragging(true);
                    }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragging(false);
                      const f = e.dataTransfer.files?.[0];
                      if (f) void handleFileChosen(f);
                    }}
                    className={`group flex min-h-[300px] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-8 text-center transition ${
                      isDragging
                        ? "border-[#E5192D] bg-[#FFF5F5]"
                        : "border-[#DADCE5] bg-[#FAFAFC] hover:border-[#111216] hover:bg-[#F5F5F8]"
                    }`}
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-[#E7E7EC] bg-white text-[#E5192D] shadow-xs transition group-hover:scale-105">
                      <Upload className="h-6 w-6" />
                    </div>
                    <p className="mt-4 text-base font-bold text-[#111216]">
                      اسحب ملف الفيديو وأفلته هنا، أو اضغط للاختيار
                    </p>
                    <p className="mt-1.5 text-xs text-[#6B707D]">
                      يدعم MP4، MOV، WebM، MKV بدقة تصل إلى 4K وحجم حتى 2 جيجابايت
                    </p>
                    <span className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#111216] px-5 py-2.5 text-xs font-bold text-white transition group-hover:bg-[#E5192D]">
                      <FileVideo className="h-4 w-4" />
                      اختيار فيديو من الجهاز
                    </span>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[#E4E4EC] bg-[#FAFAFC]">
                    <div className="relative aspect-video w-full bg-[#111216]">
                      {localPreviewUrl ? (
                        <video
                          src={localPreviewUrl}
                          controls
                          className="h-full w-full object-contain"
                        />
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <p
                          dir="ltr"
                          className="truncate text-right text-sm font-bold text-[#111216]"
                        >
                          {selectedFile.name}
                        </p>
                        <p className="mt-0.5 text-xs text-[#6B707D] tabular-nums">
                          {formatFileSize(selectedFile.size)}
                          {extractedMeta.duration > 0
                            ? ` · المدة ${formatDuration(extractedMeta.duration)}`
                            : ""}
                          {` · ${extractedMeta.resolution}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = "";
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#E2E3EA] bg-white px-3 py-1.5 text-xs font-semibold text-[#525560] hover:border-[#E5192D] hover:text-[#E5192D]"
                      >
                        <X className="h-3.5 w-3.5" />
                        تغيير الملف
                      </button>
                    </div>
                  </div>
                )}

                {/* Progress Bar during upload or AI analysis */}
                {(busyState === "uploading" || busyState === "analyzing") && (
                  <div className="mt-4 rounded-xl border border-[#DDD6FE] bg-[#F7F5FF] p-4">
                    <div className="flex items-center justify-between text-xs font-bold text-[#4C2FE0]">
                      <span className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {busyState === "uploading"
                          ? "جاري رفع الفيديو وحفظه على الخادم..."
                          : "الذكاء الاصطناعي يحلل الفيديو ويولّد العناوين والوصف والتاجز والترجمات..."}
                      </span>
                      {busyState === "uploading" && (
                        <span className="font-mono tabular-nums">{uploadProgress}%</span>
                      )}
                    </div>
                    <div className="mt-2.5 h-2 w-full overflow-hidden rounded-full bg-[#E6E0FF]">
                      <div
                        className={`h-full rounded-full bg-[#5B3DF5] transition-all duration-300 ${
                          busyState === "analyzing" ? "w-full animate-soft-pulse" : ""
                        }`}
                        style={
                          busyState === "uploading"
                            ? { width: `${uploadProgress}%` }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Context & Settings Column */}
              <div className="flex flex-col justify-between space-y-4 lg:col-span-5">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                      عن ماذا يتحدث الفيديو؟{" "}
                      <span className="font-normal text-[#7B7F8C]">
                        (يساعد الذكاء الاصطناعي على فهم أدق)
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      value={uploadPrompt}
                      onChange={(e) => setUploadPrompt(e.target.value)}
                      placeholder="مثال: شرح تثبيت Node.js ورفع موقع من GitHub على سيرفر أوبونتو للمبتدئين..."
                      className="studio-input resize-none px-3.5 py-2.5 text-sm leading-relaxed"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                        لغة الفيديو
                      </label>
                      <select
                        value={uploadLanguage}
                        onChange={(e) => setUploadLanguage(e.target.value)}
                        className="studio-input px-3 py-2.5 text-xs font-semibold"
                      >
                        {VIDEO_LANGUAGES.map((l) => (
                          <option key={l.code} value={l.code}>
                            {l.label} ({l.native})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                        التصنيف
                      </label>
                      <select
                        value={uploadCategory}
                        onChange={(e) => setUploadCategory(e.target.value)}
                        className="studio-input px-3 py-2.5 text-xs font-semibold"
                      >
                        {YOUTUBE_CATEGORIES.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                      أسلوب العناوين والسيو
                    </label>
                    <select
                      value={uploadTone}
                      onChange={(e) => setUploadTone(e.target.value)}
                      className="studio-input px-3 py-2.5 text-xs font-semibold"
                    >
                      {CONTENT_TONES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => setShowScriptInput((v) => !v)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[#5B3DF5] hover:underline"
                    >
                      {showScriptInput ? (
                        <ChevronUp className="h-3.5 w-3.5" />
                      ) : (
                        <ChevronDown className="h-3.5 w-3.5" />
                      )}
                      إضافة نص الفيديو / السكربت (اختياري لدقة أعلى في الترجمة)
                    </button>
                    {showScriptInput && (
                      <textarea
                        rows={3}
                        value={transcriptHint}
                        onChange={(e) => setTranscriptHint(e.target.value)}
                        placeholder="الصق هنا ملخص الكلام أو السكربت داخل الفيديو لتحويله مباشرة إلى ترجمة SRT متزامنة وتحليل سيو أدق..."
                        className="studio-input mt-2 resize-none px-3.5 py-2.5 text-xs leading-relaxed"
                      />
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={!selectedFile || busyState !== null}
                  onClick={() => void runUploadAndAnalyze()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E5192D] px-5 py-3.5 text-sm font-bold text-white shadow-xs transition hover:bg-[#C81224] disabled:cursor-not-allowed disabled:bg-[#D4D6DE]"
                >
                  {busyState === "uploading" || busyState === "analyzing" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  <span>رفع وتحليل بالذكاء الاصطناعي</span>
                </button>
              </div>
            </div>
          </div>

          {/* Instant Try-it Samples Strip */}
          <div className="studio-card p-5 sm:px-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-bold text-[#111216]">
                  جرّب الاستوديو فوراً بنموذج جاهز
                </h2>
                <p className="text-xs text-[#6B707D]">
                  أو اكتب أي فكرة في المربع أعلاه واضغط على أي نموذج لتوليد سيو وكلمات مفتاحية طويلة وترجمات كاملة فوراً
                </p>
              </div>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {QUICK_SAMPLES.map((s) => (
                <button
                  key={s.filename}
                  type="button"
                  disabled={busyState !== null}
                  onClick={() => void runQuickSample(s)}
                  className="group flex items-center gap-3 rounded-xl border border-[#EAEAEF] bg-[#FAFAFC] p-2.5 text-right transition hover:border-[#5B3DF5] hover:bg-[#F7F5FF] disabled:opacity-60"
                >
                  <img
                    src={s.thumb}
                    alt={s.label}
                    className="h-12 w-20 shrink-0 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-xs font-bold text-[#111216] group-hover:text-[#4C2FE0]">
                      {s.label}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#7B7F8C] tabular-nums">
                      {formatDuration(s.duration)} · تحليل فوري
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 2: AI SEO STUDIO (TITLES, DESCRIPTION, HASHTAGS, LONG-TAIL)  */}
      {/* ================================================================= */}
      {step === "optimize" && draft && liveBreakdown && (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          {/* Main Editing Rail (8 cols) */}
          <div className="space-y-5 lg:col-span-8">
            {/* Title Section */}
            <section className="studio-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#5B3DF5]">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#111216]">
                      العنوان الجذاب لتصدر البحث
                    </h2>
                    <p className="text-xs text-[#6B707D]">
                      اختر أحد العناوين المولّدة أو عدّل مباشرة — الطول المثالي 45 إلى 70 حرفاً
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => copyText(draft.title, "title", "العنوان")}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4EA] px-2.5 py-1.5 text-xs font-semibold text-[#525560] hover:bg-[#F4F4F7]"
                  >
                    {copiedKey === "title" ? (
                      <Check className="h-3.5 w-3.5 text-[#0B875B]" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
                    نسخ
                  </button>
                  <button
                    type="button"
                    disabled={busyState !== null}
                    onClick={() => void rerunAnalysis()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDD6FE] bg-[#F5F2FF] px-3 py-1.5 text-xs font-bold text-[#5B3DF5] transition hover:bg-[#EDE9FE] disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3.5 w-3.5 ${
                        busyState === "analyzing" ? "animate-spin" : ""
                      }`}
                    />
                    إعادة تحليل ذكي
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <input
                  type="text"
                  maxLength={100}
                  value={draft.title}
                  onChange={(e) => updateDraft({ title: e.target.value })}
                  placeholder="اكتب عنوان الفيديو..."
                  className="studio-input px-4 py-3 text-base font-bold text-[#111216]"
                />
                <div className="mt-1.5 flex items-center justify-between text-[11px] text-[#7B7F8C]">
                  <span>
                    الكلمة المستهدفة:{" "}
                    <strong className="text-[#2A2D36]">{draft.focusKeyword || "عام"}</strong>
                  </span>
                  <span
                    className={`font-mono font-semibold tabular-nums ${
                      draft.title.length > 75
                        ? "text-[#D97706]"
                        : draft.title.length >= 30
                          ? "text-[#0B875B]"
                          : "text-[#7B7F8C]"
                    }`}
                  >
                    {draft.title.length} / 100 حرف
                  </span>
                </div>
              </div>

              {/* AI Title Candidates */}
              {draft.titleCandidates && draft.titleCandidates.length > 0 && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setShowAllTitles((v) => !v)}
                    className="mb-2.5 flex items-center gap-1 text-xs font-bold text-[#525560] hover:text-[#111216]"
                  >
                    {showAllTitles ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                    عناوين مقترحة عالية النقر ({draft.titleCandidates.length})
                  </button>
                  {showAllTitles && (
                    <div className="space-y-2">
                      {draft.titleCandidates.map((cand, i) => {
                        const isPicked = draft.title.trim() === cand.title.trim();
                        return (
                          <button
                            key={i}
                            type="button"
                            onClick={() => updateDraft({ title: cand.title })}
                            className={`flex w-full items-start justify-between gap-3 rounded-xl border p-3 text-right transition ${
                              isPicked
                                ? "border-[#5B3DF5] bg-[#F6F4FF]"
                                : "border-[#ECECF1] bg-[#FAFAFC] hover:border-[#D4D5DF] hover:bg-white"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-[#111216]">
                                {cand.title}
                              </p>
                              <p className="mt-0.5 text-[11px] text-[#6B707D]">
                                {cand.angle} · {cand.reason}
                              </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              <span className="rounded-md bg-[#ECFDF5] px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-[#066E49]">
                                SEO {cand.seoScore}
                              </span>
                              <span className="rounded-md bg-[#F3F0FF] px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums text-[#5B3DF5]">
                                CTR {cand.ctrScore}%
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Live YouTube Search Result Preview */}
              <div className="mt-5 rounded-xl border border-[#ECECF1] bg-[#FAFAFB] p-3.5">
                <div className="mb-2.5 flex items-center gap-1.5 text-[11px] font-bold text-[#6B707D]">
                  <Search className="h-3.5 w-3.5 text-[#E5192D]" />
                  معاينة كيف يظهر فيديوك في نتائج بحث يوتيوب
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-lg bg-[#111216] sm:w-44">
                    <img
                      src={draft.thumbnailUrl || "/images/thumb-youtube-seo.jpg"}
                      alt={draft.title}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white">
                      {formatDuration(draft.durationSeconds || 540)}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-[#0F0F0F]">
                      {draft.title || "عنوان الفيديو يظهر هنا"}
                    </p>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#606060]">
                      <img
                        src={activeChannel?.avatarUrl || "/images/channel-avatar.jpg"}
                        alt=""
                        className="h-4 w-4 rounded-full object-cover"
                      />
                      <span>{activeChannel?.title || "قناتك على يوتيوب"}</span>
                      <span>·</span>
                      <span className="rounded bg-[#ECECEF] px-1.5 py-0.2 text-[10px] font-semibold text-[#3A3D47]">
                        ترجمة CC
                      </span>
                      <span className="rounded bg-[#ECECEF] px-1.5 py-0.2 text-[10px] font-semibold text-[#3A3D47]">
                        HD
                      </span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-[#606470]">
                      {draft.description.replace(/\n+/g, " ").slice(0, 145)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* Description & Hashtags Section */}
            <section className="studio-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FFF1F2] text-[#E5192D]">
                    <Hash className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#111216]">
                      الوصف الاحترافي والفصول والهاشتاجات
                    </h2>
                    <p className="text-xs text-[#6B707D]">
                      مصاغ لتصدّر البحث مع مقدمة قوية وفصول زمنية ودعوة للاشتراك
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => copyText(draft.description, "desc", "الوصف والهاشتاجات")}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4EA] px-2.5 py-1.5 text-xs font-semibold text-[#525560] hover:bg-[#F4F4F7]"
                >
                  {copiedKey === "desc" ? (
                    <Check className="h-3.5 w-3.5 text-[#0B875B]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  نسخ الوصف
                </button>
              </div>

              <div className="mt-4">
                <textarea
                  rows={9}
                  maxLength={5000}
                  value={draft.description}
                  onChange={(e) => updateDraft({ description: e.target.value })}
                  className="studio-input px-4 py-3 text-sm leading-7 text-[#1E2028]"
                />
                <div className="mt-1 flex items-center justify-between text-[11px] text-[#7B7F8C]">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {draft.chapters?.length || 0} فصول زمنية مدمجة
                  </span>
                  <span className="font-mono tabular-nums">
                    {draft.description.length} / 5000 حرف
                  </span>
                </div>
              </div>

              {/* Interactive Hashtags */}
              <div className="mt-4 border-t border-[#F0F0F4] pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-bold text-[#2A2D36]">
                    الهاشتاجات ({draft.hashtags.length})
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      copyText(draft.hashtags.join(" "), "hashtags", "الهاشتاجات")
                    }
                    className="text-[11px] font-semibold text-[#5B3DF5] hover:underline"
                  >
                    نسخ كل الهاشتاجات
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {draft.hashtags.map((h) => (
                    <span
                      key={h}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-xs font-semibold text-[#1D4ED8]"
                    >
                      <span>{h}</span>
                      <button
                        type="button"
                        onClick={() => removeHashtag(h)}
                        aria-label={`حذف ${h}`}
                        className="rounded-full p-0.5 hover:bg-[#DBEAFE]"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                  <div className="inline-flex items-center gap-1">
                    <input
                      type="text"
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHashtag();
                        }
                      }}
                      placeholder="+ أضف هاشتاج"
                      className="w-32 rounded-full border border-[#E2E3EA] bg-white px-3 py-1 text-xs focus:border-[#111216] focus:outline-none"
                    />
                    {newHashtag.trim() && (
                      <button
                        type="button"
                        onClick={addHashtag}
                        className="rounded-full bg-[#111216] px-2.5 py-1 text-[11px] font-bold text-white"
                      >
                        إضافة
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* Long-Tail SEO Tags Section */}
            <section className="studio-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#ECFDF5] text-[#0B875B]">
                    <Tag className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#111216]">
                      التاجز والكلمات المفتاحية الطويلة (Long-Tail Tags)
                    </h2>
                    <p className="text-xs text-[#6B707D]">
                      عبارات بحث طويلة قوية بمنافسة منخفضة لتتصدر نتائج البحث العام على يوتيوب وجوجل
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    copyText(
                      draft.tags.map((t) => t.text).join(", "),
                      "tags",
                      "كل التاجز"
                    )
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#E4E4EA] px-2.5 py-1.5 text-xs font-semibold text-[#525560] hover:bg-[#F4F4F7]"
                >
                  {copiedKey === "tags" ? (
                    <Check className="h-3.5 w-3.5 text-[#0B875B]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  نسخ كل التاجز
                </button>
              </div>

              {/* YouTube 500-char meter */}
              <div className="mt-4 rounded-xl bg-[#F8F8FA] p-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#525560]">
                    حد يوتيوب للتاجز ({draft.tags.length} كلمة · {liveBreakdown.longTailCount} طويلة الذيل)
                  </span>
                  <span
                    className={`font-mono font-bold tabular-nums ${
                      tagsChars > 500
                        ? "text-[#E5192D]"
                        : tagsChars >= 250
                          ? "text-[#0B875B]"
                          : "text-[#525560]"
                    }`}
                  >
                    {tagsChars} / 500 حرف
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[#E8E8EE]">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${tagsPct}%`,
                      backgroundColor:
                        tagsChars > 500 ? "#E5192D" : tagsChars >= 250 ? "#0B875B" : "#5B3DF5",
                    }}
                  />
                </div>
              </div>

              {/* Rich Tags Grid */}
              <div className="mt-4 flex flex-wrap gap-2">
                {draft.tags.map((tag, idx) => (
                  <div
                    key={`${tag.text}-${idx}`}
                    className="group inline-flex items-center gap-2 rounded-xl border border-[#E6E7EE] bg-white px-3 py-1.5 text-xs shadow-[0_1px_1px_rgba(0,0,0,0.02)] transition hover:border-[#C5C7D4]"
                  >
                    <span className="font-semibold text-[#111216]">{tag.text}</span>
                    <span
                      className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                        tag.type === "long_tail"
                          ? "bg-[#ECFDF5] text-[#066E49]"
                          : tag.type === "trending"
                            ? "bg-[#F3F0FF] text-[#5B3DF5]"
                            : "bg-[#F3F4F6] text-[#4B5563]"
                      }`}
                      title={`البحث: ${tag.volume} | المنافسة: ${tag.competition}`}
                    >
                      {tag.score}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTag(idx)}
                      aria-label={`حذف ${tag.text}`}
                      className="rounded p-0.5 text-[#9397A3] transition hover:bg-[#FFF1F2] hover:text-[#E5192D]"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add manual tag + AI long-tail expander */}
              <div className="mt-4 grid gap-3 border-t border-[#F0F0F4] pt-4 sm:grid-cols-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addManualTag();
                      }
                    }}
                    placeholder="أضف كلمة مفتاحية يدوياً..."
                    className="studio-input px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addManualTag}
                    className="shrink-0 rounded-xl border border-[#E2E3EA] bg-white px-3 py-2 text-xs font-bold text-[#111216] hover:bg-[#F4F4F7]"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={expandKeyword}
                    onChange={(e) => setExpandKeyword(e.target.value)}
                    placeholder="كلمة بحث لتوليد كلمات طويلة منها..."
                    className="studio-input px-3 py-2 text-xs"
                  />
                  <button
                    type="button"
                    disabled={busyState !== null}
                    onClick={() => void handleGenerateMoreTags()}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-[#5B3DF5] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#4C2FE0] disabled:opacity-60"
                  >
                    {busyState === "tags" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="h-3.5 w-3.5" />
                    )}
                    توليد المزيد
                  </button>
                </div>
              </div>
            </section>

            {/* Bottom Step Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <button
                type="button"
                disabled={busyState !== null || !dirty}
                onClick={() => void saveDraft(false)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#E2E3EA] bg-white px-4 py-2.5 text-xs font-bold text-[#111216] hover:bg-[#F4F4F7] disabled:opacity-50"
              >
                {busyState === "saving" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5 text-[#0B875B]" />
                )}
                {dirty ? "حفظ التعديلات" : "محفوظ"}
              </button>

              <button
                type="button"
                onClick={async () => {
                  if (dirty) await saveDraft(true);
                  onStepChange("publish");
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-[#E5192D] px-6 py-3 text-sm font-bold text-white shadow-xs transition hover:bg-[#C81224]"
              >
                <span>متابعة للإعدادات والترجمة والنشر</span>
                <ArrowLeft className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Sticky Right/Side Inspector Rail (4 cols) */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
            {/* Video + Thumbnail Preview Card */}
            <div className="studio-card overflow-hidden">
              <div className="relative aspect-video w-full bg-[#111216]">
                {draft.storedPath ? (
                  <video
                    src={`/api/videos/${draft.id}/file`}
                    poster={draft.thumbnailUrl}
                    controls
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <>
                    <img
                      src={draft.thumbnailUrl || "/images/thumb-youtube-seo.jpg"}
                      alt={draft.title}
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute bottom-2.5 left-2.5 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-white">
                      {formatDuration(draft.durationSeconds)}
                    </span>
                    <span className="absolute top-2.5 right-2.5 inline-flex items-center gap-1 rounded-md bg-black/65 px-2 py-0.5 text-[10px] font-semibold text-white">
                      <Play className="h-2.5 w-2.5 fill-current" />
                      {draft.resolution}
                    </span>
                  </>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p
                    dir="ltr"
                    className="truncate text-right text-xs font-semibold text-[#2A2D36]"
                  >
                    {draft.originalFilename}
                  </p>
                  <p className="text-[11px] text-[#7B7F8C] tabular-nums">
                    {formatFileSize(draft.fileSizeBytes)} · {activeCaptions.length} ترجمات
                  </p>
                </div>
                <input
                  ref={thumbInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleThumbUpload(f);
                  }}
                />
                <button
                  type="button"
                  onClick={() => thumbInputRef.current?.click()}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#E4E4EA] px-2.5 py-1.5 text-[11px] font-semibold text-[#2A2D36] hover:bg-[#F5F5F8]"
                >
                  <ImagePlus className="h-3.5 w-3.5" />
                  صورة مصغرة
                </button>
              </div>
            </div>

            {/* Live SEO Score Ring */}
            <SeoScoreRing breakdown={liveBreakdown} />

            {/* AI Understanding Summary */}
            <div className="studio-card space-y-3 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold text-[#111216]">
                  تحليل الذكاء الاصطناعي للمحتوى
                </h3>
                <span className="rounded-full bg-[#F3F0FF] px-2 py-0.5 text-[10px] font-bold text-[#5B3DF5]">
                  {draft.aiProviderUsed === "openai"
                    ? "OpenAI"
                    : draft.aiProviderUsed === "gemini"
                      ? "Gemini"
                      : "AI مدمج"}
                </span>
              </div>
              <div className="space-y-2.5 text-xs">
                <div>
                  <span className="text-[#7B7F8C]">الموضوع المكتشف:</span>
                  <p className="mt-0.5 font-semibold leading-relaxed text-[#1F2229]">
                    {draft.detectedTopic || "—"}
                  </p>
                </div>
                <div>
                  <span className="text-[#7B7F8C]">الجمهور المستهدف:</span>
                  <p className="mt-0.5 font-medium text-[#2A2D36]">
                    {draft.detectedAudience || "—"}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-[#F0F0F4] pt-2.5">
                  <span className="text-[#7B7F8C]">أفضل وقت للنشر:</span>
                  <span className="font-bold text-[#0B875B]">
                    {draft.bestPublishTime}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ================================================================= */}
      {/* STEP 3: VIDEO SETTINGS, MULTI-LANGUAGE SUBTITLES & PUBLISH        */}
      {/* ================================================================= */}
      {step === "publish" && draft && liveBreakdown && (
        <div className="grid items-start gap-6 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-8">
            {/* Full YouTube Video Settings */}
            <section className="studio-card p-5 sm:p-6">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F4F4F7] text-[#111216]">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#111216]">
                    إعدادات الفيديو الكاملة على يوتيوب
                  </h2>
                  <p className="text-xs text-[#6B707D]">
                    تُطبّق تلقائياً عبر YouTube Data API v3 أثناء رفع الفيديو
                  </p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 flex items-center gap-1 text-xs font-bold text-[#22252D]">
                    <Globe className="h-3.5 w-3.5 text-[#7B7F8C]" />
                    لغة الفيديو (الصوت)
                  </label>
                  <select
                    value={draft.videoLanguage}
                    onChange={(e) => updateDraft({ videoLanguage: e.target.value })}
                    className="studio-input px-3 py-2.5 text-xs font-semibold"
                  >
                    {VIDEO_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label} ({l.native})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                    لغة العنوان والوصف
                  </label>
                  <select
                    value={draft.metadataLanguage}
                    onChange={(e) => updateDraft({ metadataLanguage: e.target.value })}
                    className="studio-input px-3 py-2.5 text-xs font-semibold"
                  >
                    {VIDEO_LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label} ({l.native})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                    تصنيف يوتيوب
                  </label>
                  <select
                    value={draft.categoryId}
                    onChange={(e) => updateDraft({ categoryId: e.target.value })}
                    className="studio-input px-3 py-2.5 text-xs font-semibold"
                  >
                    {YOUTUBE_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                    الترخيص وحقوق النشر
                  </label>
                  <select
                    value={draft.license}
                    onChange={(e) => updateDraft({ license: e.target.value })}
                    className="studio-input px-3 py-2.5 text-xs font-semibold"
                  >
                    <option value="youtube">ترخيص YouTube القياسي</option>
                    <option value="creativeCommon">Creative Commons (إعادة استخدام)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                    قائمة التشغيل (Playlist)
                  </label>
                  <input
                    type="text"
                    value={draft.playlistName}
                    onChange={(e) => updateDraft({ playlistName: e.target.value })}
                    placeholder="مثال: شروحات السيو واليوتيوب"
                    className="studio-input px-3 py-2.5 text-xs"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#22252D]">
                    موقع التصوير (اختياري)
                  </label>
                  <input
                    type="text"
                    value={draft.recordingLocation}
                    onChange={(e) => updateDraft({ recordingLocation: e.target.value })}
                    placeholder="مثال: القاهرة، مصر"
                    className="studio-input px-3 py-2.5 text-xs"
                  />
                </div>
              </div>

              {/* Privacy / Schedule Cards */}
              <div className="mt-5 border-t border-[#F0F0F4] pt-5">
                <label className="mb-2.5 block text-xs font-bold text-[#22252D]">
                  مستوى الخصوصية والنشر
                </label>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                  {PRIVACY_OPTIONS.map((opt) => {
                    const active = draft.privacyStatus === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          updateDraft({
                            privacyStatus: opt.id,
                            ...(opt.id === "scheduled" && !draft.scheduledAt
                              ? {
                                  scheduledAt: new Date(
                                    Date.now() + 24 * 3600_000
                                  ).toISOString(),
                                }
                              : {}),
                          })
                        }
                        className={`rounded-xl border p-3 text-right transition ${
                          active
                            ? "border-[#111216] bg-[#111216] text-white"
                            : "border-[#E6E7EE] bg-white text-[#111216] hover:bg-[#F7F7FA]"
                        }`}
                      >
                        <p className="text-xs font-bold">{opt.label}</p>
                        <p
                          className={`mt-0.5 text-[10px] leading-snug ${
                            active ? "text-white/75" : "text-[#7B7F8C]"
                          }`}
                        >
                          {opt.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {draft.privacyStatus === "scheduled" && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFC] p-3">
                    <Calendar className="h-4 w-4 text-[#5B3DF5]" />
                    <label className="text-xs font-bold text-[#22252D]">
                      موعد النشر التلقائي:
                    </label>
                    <input
                      type="datetime-local"
                      dir="ltr"
                      value={scheduledInputValue}
                      onChange={(e) =>
                        updateDraft({
                          scheduledAt: e.target.value
                            ? new Date(e.target.value).toISOString()
                            : null,
                        })
                      }
                      className="studio-input max-w-[230px] px-3 py-1.5 font-mono text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Audience & Toggles */}
              <div className="mt-5 grid gap-3 border-t border-[#F0F0F4] pt-5 sm:grid-cols-2">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#ECECF1] px-3.5 py-2.5 hover:bg-[#FAFAFC]">
                  <span className="flex items-center gap-2 text-xs font-semibold text-[#22252D]">
                    <Users className="h-3.5 w-3.5 text-[#7B7F8C]" />
                    غير مخصص للأطفال (موصى به)
                  </span>
                  <input
                    type="checkbox"
                    checked={!draft.madeForKids}
                    onChange={(e) => updateDraft({ madeForKids: !e.target.checked })}
                    className="h-4 w-4 accent-[#111216]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#ECECF1] px-3.5 py-2.5 hover:bg-[#FAFAFC]">
                  <span className="text-xs font-semibold text-[#22252D]">
                    إرسال إشعار للمشتركين عند النشر
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.notifySubscribers}
                    onChange={(e) =>
                      updateDraft({ notifySubscribers: e.target.checked })
                    }
                    className="h-4 w-4 accent-[#111216]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#ECECF1] px-3.5 py-2.5 hover:bg-[#FAFAFC]">
                  <span className="text-xs font-semibold text-[#22252D]">
                    السماح بالتعليقات والمناقشة
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.allowComments}
                    onChange={(e) => updateDraft({ allowComments: e.target.checked })}
                    className="h-4 w-4 accent-[#111216]"
                  />
                </label>

                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-[#ECECF1] px-3.5 py-2.5 hover:bg-[#FAFAFC]">
                  <span className="text-xs font-semibold text-[#22252D]">
                    السماح بتضمين الفيديو في المواقع
                  </span>
                  <input
                    type="checkbox"
                    checked={draft.allowEmbedding}
                    onChange={(e) => updateDraft({ allowEmbedding: e.target.checked })}
                    className="h-4 w-4 accent-[#111216]"
                  />
                </label>
              </div>
            </section>

            {/* Subtitles / Captions Multi-Language Studio */}
            <section className="studio-card p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#5B3DF5]">
                    <Subtitles className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-extrabold text-[#111216]">
                      الترجمات التلقائية (Subtitles · SRT / VTT)
                    </h2>
                    <p className="text-xs text-[#6B707D]">
                      تُرفع تلقائياً إلى يوتيوب لتوسيع انتشار الفيديو بلغات متعددة وتحسين السيو
                    </p>
                  </div>
                </div>

                {availableExtraLanguages.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <select
                      value={
                        availableExtraLanguages.some((l) => l.code === addCaptionLang)
                          ? addCaptionLang
                          : availableExtraLanguages[0].code
                      }
                      onChange={(e) => setAddCaptionLang(e.target.value)}
                      className="rounded-lg border border-[#E2E3EA] bg-white px-2.5 py-1.5 text-xs font-semibold"
                    >
                      {availableExtraLanguages.map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.label} ({l.code.toUpperCase()})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busyState !== null}
                      onClick={() => {
                        const code = availableExtraLanguages.some(
                          (l) => l.code === addCaptionLang
                        )
                          ? addCaptionLang
                          : availableExtraLanguages[0].code;
                        void handleAddCaption(code);
                      }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#5B3DF5] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#4C2FE0] disabled:opacity-60"
                    >
                      {busyState === "caption" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                      توليد ترجمة
                    </button>
                  </div>
                )}
              </div>

              {/* Language Tabs */}
              {activeCaptions.length > 0 ? (
                <div className="mt-4 space-y-4">
                  <div className="flex flex-wrap gap-2 border-b border-[#F0F0F4] pb-3">
                    {activeCaptions.map((cap) => {
                      const active = cap.id === activeCaptionId;
                      return (
                        <button
                          key={cap.id}
                          type="button"
                          onClick={() => {
                            setActiveCaptionId(cap.id);
                            setEditingCues(cap.cues || []);
                            setCuesDirty(false);
                          }}
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                            active
                              ? "border-[#5B3DF5] bg-[#F5F2FF] text-[#4C2FE0]"
                              : "border-[#E6E7EE] bg-white text-[#525560] hover:bg-[#F7F7FA]"
                          }`}
                        >
                          <span className="font-mono text-[10px] uppercase">
                            {cap.languageCode}
                          </span>
                          <span>{getLanguageLabel(cap.languageCode)}</span>
                          {cap.includeInUpload && (
                            <span className="h-1.5 w-1.5 rounded-full bg-[#0B875B]" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {selectedCaption && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#2A2D36]">
                          <input
                            type="checkbox"
                            checked={selectedCaption.includeInUpload}
                            onChange={() => void handleToggleCaptionUpload(selectedCaption)}
                            className="h-4 w-4 accent-[#0B875B]"
                          />
                          رفع هذه الترجمة تلقائياً مع الفيديو على يوتيوب
                        </label>

                        <div className="flex items-center gap-1.5">
                          <a
                            href={`/api/videos/${draft.id}/captions?captionId=${selectedCaption.id}&format=srt`}
                            download
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E3EA] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2A2D36] hover:bg-[#F5F5F8]"
                          >
                            <Download className="h-3 w-3" />
                            SRT
                          </a>
                          <a
                            href={`/api/videos/${draft.id}/captions?captionId=${selectedCaption.id}&format=vtt`}
                            download
                            className="inline-flex items-center gap-1 rounded-lg border border-[#E2E3EA] bg-white px-2.5 py-1 text-[11px] font-bold text-[#2A2D36] hover:bg-[#F5F5F8]"
                          >
                            <Download className="h-3 w-3" />
                            VTT
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleDeleteCaption(selectedCaption.id)}
                            aria-label="حذف الترجمة"
                            className="rounded-lg border border-[#F2E4E6] p-1.5 text-[#9B2C2C] hover:bg-[#FFF1F2]"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Cue Editor */}
                      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border border-[#ECECF1] bg-[#FAFAFC] p-3">
                        {editingCues.map((cue, idx) => (
                          <div
                            key={cue.index}
                            className="flex flex-col gap-1.5 rounded-lg bg-white p-2.5 sm:flex-row sm:items-center sm:gap-3"
                          >
                            <span
                              dir="ltr"
                              className="shrink-0 font-mono text-[10px] tabular-nums text-[#7B7F8C]"
                            >
                              {cue.start.split(",")[0]} → {cue.end.split(",")[0]}
                            </span>
                            <input
                              type="text"
                              dir={selectedCaption.languageCode === "ar" || selectedCaption.languageCode === "ur" ? "rtl" : "ltr"}
                              value={cue.text}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditingCues((prev) =>
                                  prev.map((c, i) =>
                                    i === idx ? { ...c, text: val } : c
                                  )
                                );
                                setCuesDirty(true);
                              }}
                              className="w-full rounded-md border border-transparent bg-[#F8F8FA] px-2.5 py-1 text-xs text-[#111216] focus:border-[#5B3DF5] focus:bg-white focus:outline-none"
                            />
                          </div>
                        ))}
                      </div>

                      {cuesDirty && (
                        <div className="flex justify-end">
                          <button
                            type="button"
                            disabled={busyState === "caption"}
                            onClick={() => void handleSaveCues()}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-[#111216] px-3.5 py-1.5 text-xs font-bold text-white hover:bg-[#2A2D36]"
                          >
                            <Check className="h-3.5 w-3.5" />
                            حفظ تعديلات الترجمة
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-xl border border-dashed border-[#DDDDE5] p-6 text-center">
                  <p className="text-xs text-[#6B707D]">
                    لا توجد ملفات ترجمة بعد — اضغط «توليد ترجمة» لإضافة العربية أو الإنجليزية فوراً.
                  </p>
                </div>
              )}
            </section>

            {/* Back Navigation */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => onStepChange("optimize")}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E3EA] bg-white px-4 py-2.5 text-xs font-bold text-[#2A2D36] hover:bg-[#F4F4F7]"
              >
                <ArrowRight className="h-4 w-4" />
                العودة لتعديل العنوان والتاجز
              </button>
              <button
                type="button"
                disabled={busyState !== null}
                onClick={() => void saveDraft(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E3EA] bg-white px-4 py-2.5 text-xs font-bold text-[#111216] hover:bg-[#F4F4F7]"
              >
                <Check className="h-3.5 w-3.5 text-[#0B875B]" />
                {dirty ? "حفظ الإعدادات" : "تم الحفظ"}
              </button>
            </div>
          </div>

          {/* Publish Confirmation Rail (4 cols) */}
          <aside className="space-y-5 lg:sticky lg:top-6 lg:col-span-4">
            <div className="studio-card space-y-4 p-5">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-[#111216]">
                  مراجعة ونشر على يوتيوب
                </h3>
                <SeoScoreRing breakdown={liveBreakdown} compact />
              </div>

              {/* Quick Checklist */}
              <ul className="space-y-2 border-y border-[#F0F0F4] py-3.5 text-xs">
                {[
                  {
                    ok: Boolean(activeChannel),
                    label: activeChannel
                      ? `القناة: ${activeChannel.title}`
                      : "ربط قناة يوتيوب",
                  },
                  {
                    ok: draft.title.trim().length >= 10,
                    label: `العنوان (${draft.title.length} حرف)`,
                  },
                  {
                    ok: draft.description.trim().length >= 80,
                    label: `الوصف + ${draft.hashtags.length} هاشتاج`,
                  },
                  {
                    ok: draft.tags.length >= 3,
                    label: `${draft.tags.length} تاج (${liveBreakdown.longTailCount} طويلة الذيل)`,
                  },
                  {
                    ok: activeCaptions.some((c) => c.includeInUpload),
                    label: `الترجمات: ${
                      activeCaptions
                        .filter((c) => c.includeInUpload)
                        .map((c) => c.languageCode.toUpperCase())
                        .join("، ") || "غير محددة"
                    }`,
                  },
                  {
                    ok: true,
                    label: `${getLanguageLabel(draft.videoLanguage)} · ${getCategoryLabel(draft.categoryId)}`,
                  },
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-[#2A2D36]">
                    <CheckCircle2
                      className={`h-4 w-4 shrink-0 ${
                        item.ok ? "text-[#0B875B]" : "text-[#D97706]"
                      }`}
                    />
                    <span className="truncate font-medium">{item.label}</span>
                  </li>
                ))}
              </ul>

              {/* Mode Notice */}
              {isRealOauthReady ? (
                <div className="rounded-xl border border-[#B7F0D8] bg-[#ECFDF5] p-3 text-xs text-[#066E49]">
                  <strong>الرفع الحقيقي مفعّل:</strong> سيُرسل الفيديو والصورة المصغرة والسيو والترجمات مباشرة لقناتك عبر YouTube Data API v3.
                </div>
              ) : (
                <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-3 text-[11px] leading-relaxed text-[#92400E]">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      <span className="font-bold">وضع النشر التجريبي نشط.</span>{" "}
                      لتفعيل الرفع المباشر الحقيقي على قناتك، اربط Google OAuth من{" "}
                      <button
                        type="button"
                        onClick={() => onNavigate("channels")}
                        className="font-bold underline"
                      >
                        صفحة ربط القناة
                      </button>
                      .
                    </div>
                  </div>
                </div>
              )}

              {/* Primary YouTube Publish Button */}
              <button
                type="button"
                disabled={busyState !== null}
                onClick={() => void handlePublish()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#E5192D] px-5 py-3.5 text-sm font-extrabold text-white shadow-xs transition hover:bg-[#C81224] disabled:opacity-60"
              >
                {busyState === "publishing" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري الرفع إلى يوتيوب...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>
                      {draft.privacyStatus === "scheduled"
                        ? "جدولة الرفع على يوتيوب"
                        : draft.status === "published"
                          ? "إعادة رفع / تحديث على يوتيوب"
                          : "رفع ونشر على يوتيوب الآن"}
                    </span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={exportMetadataPackage}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#E2E3EA] bg-white px-4 py-2.5 text-xs font-bold text-[#2A2D36] hover:bg-[#F5F5F8]"
              >
                <FileDown className="h-3.5 w-3.5" />
                تنزيل حزمة السيو والترجمات (JSON)
              </button>

              {/* Animated Upload Progress */}
              {busyState === "publishing" && (
                <div className="space-y-2 rounded-xl bg-[#F8F8FA] p-3 text-[11px]">
                  {[
                    "التحقق من توكن القناة",
                    "رفع ملف الفيديو (Resumable API)",
                    "تطبيق العنوان والوصف والتاجز",
                    "إرفاق ملفات الترجمة SRT",
                    "تأكيد النشر على يوتيوب",
                  ].map((label, i) => (
                    <div
                      key={label}
                      className={`flex items-center gap-2 ${
                        publishStageIdx > i
                          ? "font-bold text-[#0B875B]"
                          : publishStageIdx === i
                            ? "font-bold text-[#111216]"
                            : "text-[#9CA0AC]"
                      }`}
                    >
                      {publishStageIdx > i ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      ) : publishStageIdx === i ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-[#E5192D]" />
                      ) : (
                        <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-[#D4D6DF]" />
                      )}
                      <span>{label}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Result Log after Publishing */}
              {(draft.status === "published" || draft.status === "scheduled") &&
                draft.publishLog?.length > 0 &&
                busyState !== "publishing" && (
                  <div className="space-y-2.5 rounded-xl border border-[#B7F0D8] bg-[#ECFDF5] p-3.5">
                    <div className="flex items-center gap-2 text-xs font-extrabold text-[#066E49]">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {draft.status === "scheduled"
                          ? "تمت جدولة الفيديو بنجاح!"
                          : draft.publishMode === "youtube_api"
                            ? "تم النشر الفعلي على يوتيوب!"
                            : "اكتملت حزمة النشر بنجاح!"}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {draft.publishLog.map((entry, i) => (
                        <div key={i} className="text-[11px] leading-snug text-[#065F46]">
                          <span className="font-bold">• {entry.step}:</span>{" "}
                          <span className="opacity-90">{entry.detail}</span>
                        </div>
                      ))}
                    </div>
                    {draft.youtubeUrl && draft.publishMode === "youtube_api" && (
                      <a
                        href={draft.youtubeUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1.5 rounded-lg bg-[#0B875B] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#09724C]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        مشاهدة على يوتيوب
                      </a>
                    )}
                  </div>
                )}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
