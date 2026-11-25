"use client";

import { CheckCircle2, AlertCircle } from "lucide-react";
import type { SeoBreakdown } from "@/lib/youtube-constants";

interface SeoScoreRingProps {
  breakdown: SeoBreakdown;
  compact?: boolean;
}

export function SeoScoreRing({ breakdown, compact = false }: SeoScoreRingProps) {
  const score = Math.max(0, Math.min(100, breakdown.total));
  const size = compact ? 52 : 96;
  const stroke = compact ? 5 : 7.5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  const color =
    score >= 85 ? "#0B875B" : score >= 65 ? "#D97706" : "#E5192D";
  const badgeBg =
    score >= 85
      ? "bg-[#ECFDF5] text-[#066E49] border-[#B7F0D8]"
      : score >= 65
        ? "bg-[#FFFBEB] text-[#B45309] border-[#FDE68A]"
        : "bg-[#FFF1F2] text-[#BE123C] border-[#FECDD3]";

  if (compact) {
    return (
      <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="#ECECEF"
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <span className="absolute text-xs font-bold tabular-nums text-[#111216]">
          {score}
        </span>
      </div>
    );
  }

  return (
    <div className="studio-card p-5">
      <div className="flex items-center gap-4">
        <div
          className="relative flex shrink-0 items-center justify-center"
          style={{ width: size, height: size }}
        >
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="#ECECEF"
              strokeWidth={stroke}
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={stroke}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-extrabold leading-none tabular-nums text-[#111216]">
              {score}
            </span>
            <span className="mt-0.5 text-[10px] font-medium text-[#7B7F8C]">
              من 100
            </span>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-[#6B707D]">
            تقييم قوة السيو (SEO)
          </div>
          <div
            className={`mt-1.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${badgeBg}`}
          >
            {breakdown.grade}
          </div>
          <p className="mt-1.5 text-xs text-[#6B707D] tabular-nums">
            {breakdown.longTailCount} كلمة طويلة الذيل · {breakdown.tagsCharCount}/500 حرف
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 border-t border-[#F0F0F4] pt-4">
        {breakdown.items.map((item) => {
          const pct = Math.round((item.score / item.max) * 100);
          return (
            <div key={item.key} className="space-y-1">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="flex items-center gap-1.5 font-medium text-[#2A2D36]">
                  {item.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#0B875B]" />
                  ) : (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[#D97706]" />
                  )}
                  <span className="truncate">{item.label}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] font-semibold tabular-nums text-[#525560]">
                  {item.score}/{item.max}
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#EFEFF3]">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${pct}%`,
                    backgroundColor: item.ok ? "#0B875B" : "#D97706",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
