"use client";

import { Recommendation } from "@/lib/types";

interface Props {
  recommendation: Recommendation;
  confidence: number;
}

const CONFIG: Record<Recommendation, { label: string; bg: string; text: string; icon: string }> = {
  buy_now: {
    label: "Buy Now",
    bg: "bg-emerald-100 dark:bg-emerald-900/40",
    text: "text-emerald-800 dark:text-emerald-300",
    icon: "\u2713",
  },
  wait: {
    label: "Wait",
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-800 dark:text-blue-300",
    icon: "\u23F3",
  },
  monitor: {
    label: "Monitor",
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-800 dark:text-amber-300",
    icon: "\uD83D\uDC41",
  },
};

export default function RecommendationBadge({ recommendation, confidence }: Props) {
  const cfg = CONFIG[recommendation];

  return (
    <div className="flex items-center gap-3">
      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold ${cfg.bg} ${cfg.text}`}>
        <span>{cfg.icon}</span>
        {cfg.label}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {confidence}% confidence
      </span>
    </div>
  );
}
