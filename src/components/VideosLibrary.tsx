"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Copy,
  Trash2,
  ExternalLink,
  SlidersHorizontal,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  Subtitles,
  Tag,
  Film,
  Loader2,
} from "lucide-react";
import type { LibraryStatsDTO, VideoDTO } from "@/types/studio";
import {
  formatDuration,
  formatFileSize,
  getCategoryLabel,
  getLanguageLabel,
} from "@/lib/youtube-constants";

interface VideosLibraryProps {
  videos: VideoDTO[];
  stats: LibraryStatsDTO;
  onOpenVideo: (videoId: number, targetStep?: "optimize" | "publish") => Promise<void>;
  onNewVideo: () => void;
  onRefresh: () => Promise<void>;
  notify: (msg: string, tone?: "success" | "error" | "info") => void;
}

const STATUS_FILTERS = [
  { id: "all", label: "الكل" },
  { id: "published", label: "منشور" },
  { id: "scheduled", label: "مجدول" },
  { id: "draft", label: "جاهز للنشر" },
] as const;

function StatusPill({ status, mode }: { status: string; mode: string | null }) {
  if (status === "published") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#B7F0D8] bg-[#ECFDF5] px-2.5 py-0.5 text-[11px] font-bold text-[#066E49]">
        <CheckCircle2 className="h-3 w-3" />
        {mode === "youtube_api" ? "منشور على يوتيوب" : "منشور"}
      </span>
    );
  }
  if (status === "scheduled") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[#DDD6FE] bg-[#F5F2FF] px-2.5 py-0.5 text-[11px] font-bold text-[#5B3DF5]">
        <Calendar className="h-3 w-3" />
        مجدول
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#FDE68A] bg-[#FFFBEB] px-2.5 py-0.5 text-[11px] font-bold text-[#B45309]">
      <Clock className="h-3 w-3" />
      جاهز للنشر
    </span>
  );
}

export function VideosLibrary({
  videos,
  stats,
  onOpenVideo,
  onNewVideo,
  onRefresh,
  notify,
}: VideosLibraryProps) {
  const [filter, setFilter] = useState<(typeof STATUS_FILTERS)[number]["id"]>("all");
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return videos.filter((v) => {
      if (filter === "published" && v.status !== "published") return false;
      if (filter === "scheduled" && v.status !== "scheduled") return false;
      if (filter === "draft" && !["uploaded", "analyzed", "ready", "failed"].includes(v.status)) {
        return false;
      }
      if (!q) return true;
      return (
        v.title.toLowerCase().includes(q) ||
        v.originalFilename.toLowerCase().includes(q) ||
        v.detectedTopic.toLowerCase().includes(q) ||
        (v.tags || []).some((t) => t.text.toLowerCase().includes(q))
      );
    });
  }, [videos, filter, query]);

  const handleDuplicate = async (id: number) => {
    try {
      setBusyId(id);
      const res = await fetch("/api/videos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ duplicateId: id }),
      });
      if (!res.ok) throw new Error();
      await onRefresh();
      notify("تم نسخ الفيديو كمسودة جديدة.", "success");
    } catch {
      notify("تعذّر نسخ الفيديو", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      setBusyId(id);
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await onRefresh();
      notify("تم حذف الفيديو من المكتبة.", "info");
    } catch {
      notify("تعذّر حذف الفيديو", "error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-[1160px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-[#111216]">
            مكتبة الفيديوهات
          </h1>
          <p className="mt-0.5 text-sm text-[#606470]">
            جميع الفيديوهات المرفوعة والمحسّنة بالذكاء الاصطناعي والجاهزة أو المنشورة على يوتيوب
          </p>
        </div>
        <button
          type="button"
          onClick={onNewVideo}
          className="inline-flex items-center gap-2 rounded-xl bg-[#E5192D] px-4 py-2.5 text-xs font-bold text-white shadow-xs transition hover:bg-[#C81224]"
        >
          <Plus className="h-4 w-4" />
          رفع فيديو جديد
        </button>
      </div>

      {/* Compact Metric Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "إجمالي الفيديوهات", val: stats.total, accent: "text-[#111216]" },
          { label: "منشور على القناة", val: stats.published, accent: "text-[#0B875B]" },
          { label: "جاهز أو مجدول", val: stats.ready + stats.scheduled, accent: "text-[#5B3DF5]" },
          { label: "متوسط قوة السيو", val: `${stats.avgSeo}/100`, accent: "text-[#111216]" },
        ].map((kpi) => (
          <div key={kpi.label} className="studio-card px-4 py-3.5">
            <p className="text-xs font-medium text-[#7B7F8C]">{kpi.label}</p>
            <p className={`mt-1 text-2xl font-extrabold tabular-nums ${kpi.accent}`}>
              {kpi.val}
            </p>
          </div>
        ))}
      </div>

      {/* Search & Filter Row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[#E7E7EC] bg-white p-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold transition ${
                filter === f.id
                  ? "bg-[#111216] text-white"
                  : "text-[#525560] hover:bg-[#F4F4F7]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[#9397A3]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالعنوان أو الكلمة المفتاحية..."
            className="studio-input py-2 pr-9 pl-3 text-xs"
          />
        </div>
      </div>

      {/* Video Cards List */}
      {filtered.length === 0 ? (
        <div className="studio-card flex flex-col items-center justify-center px-6 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4F4F7] text-[#7B7F8C]">
            <Film className="h-6 w-6" />
          </div>
          <p className="mt-3 text-sm font-bold text-[#111216]">
            لا توجد فيديوهات مطابقة للبحث
          </p>
          <p className="mt-1 text-xs text-[#6B707D]">
            ارفع فيديو جديد ليقوم الذكاء الاصطناعي بتحليله وتجهيزه للنشر
          </p>
          <button
            type="button"
            onClick={onNewVideo}
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-[#111216] px-4 py-2 text-xs font-bold text-white hover:bg-[#E5192D]"
          >
            <Plus className="h-3.5 w-3.5" />
            رفع فيديو الآن
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((video) => {
            const score = video.seoScore || 0;
            const scoreColor =
              score >= 85
                ? "border-[#B7F0D8] bg-[#ECFDF5] text-[#066E49]"
                : score >= 65
                  ? "border-[#FDE68A] bg-[#FFFBEB] text-[#B45309]"
                  : "border-[#E4E4EA] bg-[#F4F4F7] text-[#525560]";

            return (
              <article
                key={video.id}
                className="studio-card flex flex-col gap-4 p-4 transition hover:border-[#D4D6E0] md:flex-row md:items-center"
              >
                <div className="relative aspect-video w-full shrink-0 overflow-hidden rounded-xl bg-[#111216] md:w-52">
                  <img
                    src={video.thumbnailUrl || "/images/thumb-youtube-seo.jpg"}
                    alt={video.title || video.originalFilename}
                    className="h-full w-full object-cover"
                  />
                  <span className="absolute bottom-2 left-2 rounded bg-black/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-white">
                    {formatDuration(video.durationSeconds)}
                  </span>
                  {video.hasLocalFile && (
                    <span className="absolute top-2 right-2 rounded bg-[#0B875B] px-1.5 py-0.5 text-[10px] font-bold text-white">
                      ملف مرفوع
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill status={video.status} mode={video.publishMode} />
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[11px] font-bold tabular-nums ${scoreColor}`}
                    >
                      SEO {score}
                    </span>
                    <span className="text-[11px] text-[#7B7F8C]">
                      {getCategoryLabel(video.categoryId)} ·{" "}
                      {getLanguageLabel(video.videoLanguage)}
                    </span>
                  </div>

                  <h3 className="line-clamp-1 text-base font-extrabold text-[#111216]">
                    {video.title || video.originalFilename}
                  </h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[#6B707D]">
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Tag className="h-3.5 w-3.5 text-[#0B875B]" />
                      {video.tags?.length || 0} كلمة مفتاحية
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Subtitles className="h-3.5 w-3.5 text-[#5B3DF5]" />
                      {(video.captionLanguages || []).length > 0
                        ? (video.captionLanguages || [])
                            .map((c) => c.toUpperCase())
                            .join(" · ")
                        : "بدون ترجمة"}
                    </span>
                    <span className="tabular-nums">
                      {formatFileSize(video.fileSizeBytes)}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 md:shrink-0">
                  <button
                    type="button"
                    disabled={busyId === video.id}
                    onClick={() => void onOpenVideo(video.id, "optimize")}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[#111216] px-3.5 py-2 text-xs font-bold text-white transition hover:bg-[#5B3DF5]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    تعديل السيو
                  </button>
                  <button
                    type="button"
                    disabled={busyId === video.id}
                    onClick={() => void onOpenVideo(video.id, "publish")}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[#E2E3EA] bg-white px-3 py-2 text-xs font-bold text-[#2A2D36] hover:bg-[#F4F4F7]"
                    title="الإعدادات والترجمة والنشر"
                  >
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    {video.status === "published" ? "الترجمة" : "نشر"}
                  </button>
                  {video.youtubeUrl && video.publishMode === "youtube_api" && (
                    <a
                      href={video.youtubeUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="مشاهدة على يوتيوب"
                      className="rounded-xl border border-[#E2E3EA] bg-white p-2 text-[#E5192D] hover:bg-[#FFF1F2]"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    disabled={busyId === video.id}
                    onClick={() => void handleDuplicate(video.id)}
                    aria-label="نسخ الفيديو"
                    title="إنشاء نسخة"
                    className="rounded-xl border border-[#E2E3EA] bg-white p-2 text-[#525560] hover:bg-[#F4F4F7]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={busyId === video.id}
                    onClick={() => void handleDelete(video.id)}
                    aria-label="حذف الفيديو"
                    title="حذف"
                    className="rounded-xl border border-[#EFE2E4] bg-white p-2 text-[#B91C1C] hover:bg-[#FFF1F2]"
                  >
                    {busyId === video.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
