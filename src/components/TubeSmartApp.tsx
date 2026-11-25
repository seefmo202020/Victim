"use client";

import { useState, useCallback, useEffect } from "react";
import {
  Upload,
  Link2,
  Server,
  Menu,
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Film,
} from "lucide-react";
import type {
  CaptionDTO,
  ChannelDTO,
  LibraryStatsDTO,
  NavView,
  SettingsSummaryDTO,
  StudioStep,
  VideoDTO,
} from "@/types/studio";
import { StudioWorkflow } from "./StudioWorkflow";
import { VideosLibrary } from "./VideosLibrary";
import { ChannelSettingsView } from "./ChannelSettingsView";
import { BontoDeployView } from "./BontoDeployView";

interface TubeSmartAppProps {
  initialChannels: ChannelDTO[];
  initialVideos: VideoDTO[];
  initialStats: LibraryStatsDTO;
  initialSettings: SettingsSummaryDTO;
  initialView?: NavView;
  initialOauthNotice?: string | null;
}

interface ToastItem {
  id: number;
  msg: string;
  tone: "success" | "error" | "info";
}

function BrandMark() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-[#E5192D] text-white shadow-xs">
        <svg viewBox="0 0 24 24" className="h-4.5 w-4.5 fill-current" aria-hidden="true">
          <path d="M8.5 6.8c0-.8.9-1.3 1.6-.9l8.2 5.2c.6.4.6 1.4 0 1.8l-8.2 5.2c-.7.4-1.6-.1-1.6-.9V6.8z" />
        </svg>
        <span className="absolute -top-1 -left-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white bg-[#5B3DF5] text-white">
          <Sparkles className="h-2.5 w-2.5" />
        </span>
      </div>
      <div>
        <span className="block text-base font-extrabold leading-none tracking-tight text-[#111216]">
          تيوب سمارت
        </span>
        <span className="mt-0.5 block text-[11px] font-medium text-[#7B7F8C]">
          استوديو النشر الذكي
        </span>
      </div>
    </div>
  );
}

export function TubeSmartApp({
  initialChannels,
  initialVideos,
  initialStats,
  initialSettings,
  initialView = "studio",
  initialOauthNotice = null,
}: TubeSmartAppProps) {
  const [view, setView] = useState<NavView>(initialView);
  const [step, setStep] = useState<StudioStep>("upload");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [channels, setChannels] = useState<ChannelDTO[]>(initialChannels);
  const [videos, setVideos] = useState<VideoDTO[]>(initialVideos);
  const [stats, setStats] = useState<LibraryStatsDTO>(initialStats);
  const [settings, setSettings] = useState<SettingsSummaryDTO>(initialSettings);
  const [oauthNotice, setOauthNotice] = useState<string | null>(initialOauthNotice);

  const [activeVideo, setActiveVideo] = useState<VideoDTO | null>(null);
  const [activeCaptions, setActiveCaptions] = useState<CaptionDTO[]>([]);
  const [toast, setToast] = useState<ToastItem | null>(null);

  const activeChannel = channels.find((c) => c.isActive) || channels[0] || null;

  const notify = useCallback(
    (msg: string, tone: "success" | "error" | "info" = "info") => {
      const id = Date.now();
      setToast({ id, msg, tone });
    },
    []
  );

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  // Clean URL parameters after consuming oauth redirect banner
  useEffect(() => {
    if (initialOauthNotice && typeof window !== "undefined") {
      window.history.replaceState({}, "", "/");
    }
  }, [initialOauthNotice]);

  const refreshLibrary = useCallback(async () => {
    const res = await fetch("/api/videos", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setVideos(data.videos || []);
      if (data.stats) setStats(data.stats);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    const [chRes, setRes, vidRes] = await Promise.all([
      fetch("/api/channels", { cache: "no-store" }),
      fetch("/api/settings", { cache: "no-store" }),
      fetch("/api/videos", { cache: "no-store" }),
    ]);
    if (chRes.ok) {
      const d = await chRes.json();
      setChannels(d.channels || []);
    }
    if (setRes.ok) {
      const d = await setRes.json();
      if (d.settings) setSettings(d.settings);
    }
    if (vidRes.ok) {
      const d = await vidRes.json();
      setVideos(d.videos || []);
      if (d.stats) setStats(d.stats);
    }
  }, []);

  const openVideoInStudio = useCallback(
    async (videoId: number, targetStep: "optimize" | "publish" = "optimize") => {
      const res = await fetch(`/api/videos/${videoId}`, { cache: "no-store" });
      if (!res.ok) {
        notify("تعذّر فتح الفيديو", "error");
        return;
      }
      const data = await res.json();
      setActiveVideo(data.video);
      setActiveCaptions(data.captions || []);
      setStep(targetStep);
      setView("studio");
      setMobileMenuOpen(false);
    },
    [notify]
  );

  const navigate = (next: NavView) => {
    setView(next);
    setMobileMenuOpen(false);
    if (next !== "channels") setOauthNotice(null);
  };

  const navItems: Array<{
    id: NavView;
    label: string;
    icon: typeof Upload;
    badge?: number;
  }> = [
    { id: "studio", label: "رفع ونشر فيديو", icon: Upload },
    { id: "library", label: "مكتبة الفيديوهات", icon: Film, badge: stats.total },
    { id: "channels", label: "ربط القناة و API", icon: Link2 },
    { id: "deploy", label: "النشر على Bonto", icon: Server },
  ];



  const sidebarContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        <div className="flex items-center justify-between px-1.5 pt-1">
          <BrandMark />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="rounded-lg p-1.5 text-[#6B707D] hover:bg-[#F3F3F6] lg:hidden"
            aria-label="إغلاق القائمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="space-y-1" aria-label="التنقل الرئيسي">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = view === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-bold transition ${
                  active
                    ? "bg-[#111216] text-white shadow-xs"
                    : "text-[#525560] hover:bg-[#F2F3F6] hover:text-[#111216]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`h-4 w-4 ${active ? "text-[#FF4D5E]" : "text-[#7B7F8C]"}`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums ${
                      active
                        ? "bg-white/15 text-white"
                        : "bg-[#EFEFF3] text-[#525560]"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Video Quick Jump */}
        {activeVideo && view !== "studio" && (
          <div className="rounded-xl border border-[#ECECF1] bg-[#FAFAFC] p-3">
            <p className="text-[10px] font-bold text-[#7B7F8C]">قيد العمل حالياً</p>
            <p className="mt-1 line-clamp-1 text-xs font-bold text-[#111216]">
              {activeVideo.title || activeVideo.originalFilename}
            </p>
            <button
              type="button"
              onClick={() => setView("studio")}
              className="mt-2 text-[11px] font-bold text-[#E5192D] hover:underline"
            >
              متابعة التحرير ←
            </button>
          </div>
        )}
      </div>

      {/* Bottom Connected Channel Mini Card */}
      <div className="border-t border-[#EFEFF3] pt-4">
        <button
          type="button"
          onClick={() => navigate("channels")}
          className="flex w-full items-center gap-2.5 rounded-xl border border-[#ECECF1] bg-[#FAFAFC] p-2.5 text-right transition hover:border-[#D4D6DF] hover:bg-white"
        >
          <img
            src={activeChannel?.avatarUrl || "/images/channel-avatar.jpg"}
            alt={activeChannel?.title || "القناة"}
            className="h-9 w-9 shrink-0 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-[#111216]">
              {activeChannel?.title || "اربط قناة يوتيوب"}
            </p>
            <p className="flex items-center gap-1 text-[10px] font-semibold text-[#6B707D]">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  activeChannel ? "bg-[#0B875B]" : "bg-[#E5192D]"
                }`}
              />
              {activeChannel?.connectionMode === "oauth"
                ? "Google OAuth متصل"
                : activeChannel
                  ? "قناة متصلة (تجريبي)"
                  : "غير متصل"}
            </p>
          </div>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Desktop RTL Sidebar (Right side automatically because dir="rtl") */}
      <aside className="hidden w-[256px] shrink-0 border-l border-[#E7E7EC] bg-white lg:sticky lg:top-0 lg:block lg:h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-[#E7E7EC] bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <BrandMark />
        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="rounded-xl border border-[#E7E7EC] p-2 text-[#111216]"
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/35 backdrop-blur-[1px]"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative z-10 h-full w-72 bg-white shadow-xl">
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Fluid Studio Canvas */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-7 sm:py-8 lg:px-10">
        {view === "studio" && (
          <StudioWorkflow
            activeChannel={activeChannel}
            activeVideo={activeVideo}
            activeCaptions={activeCaptions}
            step={step}
            activeAiEngine={settings.activeAiEngine}
            onStepChange={setStep}
            onVideoLoaded={(video, captions) => {
              setActiveVideo(video);
              setActiveCaptions(captions);
            }}
            onVideoMutated={(video) => setActiveVideo(video)}
            onCaptionsMutated={(captions) => setActiveCaptions(captions)}
            onRefreshLibrary={refreshLibrary}
            onNavigate={navigate}
            notify={notify}
          />
        )}

        {view === "library" && (
          <VideosLibrary
            videos={videos}
            stats={stats}
            onOpenVideo={openVideoInStudio}
            onNewVideo={() => {
              setActiveVideo(null);
              setActiveCaptions([]);
              setStep("upload");
              setView("studio");
            }}
            onRefresh={refreshLibrary}
            notify={notify}
          />
        )}

        {view === "channels" && (
          <ChannelSettingsView
            channels={channels}
            settings={settings}
            oauthNotice={oauthNotice}
            onRefreshAll={refreshAll}
            notify={notify}
          />
        )}

        {view === "deploy" && <BontoDeployView notify={notify} />}
      </main>

      {/* Subtle Floating Toast */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 flex max-w-sm items-center gap-2.5 rounded-2xl border border-[#1E2028]/10 bg-[#111216] px-4 py-3 text-xs font-semibold text-white shadow-lg"
        >
          {toast.tone === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34D399]" />
          ) : toast.tone === "error" ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#FB7185]" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0 text-[#A78BFA]" />
          )}
          <span className="leading-relaxed">{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
