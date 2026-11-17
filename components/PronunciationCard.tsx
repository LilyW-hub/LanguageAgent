"use client"

import type { PronunciationFeedback } from "@/lib/types"

const CLARITY_META: Record<
  PronunciationFeedback["clarity"],
  { label: string; color: string; icon: string }
> = {
  clear: { label: "清晰", color: "text-emerald-700 border-emerald-200 bg-emerald-50", icon: "🎤" },
  fair: { label: "一般", color: "text-amber-700 border-amber-200 bg-amber-50", icon: "🎤" },
  unclear: { label: "偏含糊", color: "text-rose-700 border-rose-200 bg-rose-50", icon: "🎤" },
  unknown: { label: "无置信度", color: "text-stone-500 border-stone-200 bg-stone-50", icon: "🎤" },
}

export default function PronunciationCard({ feedback }: { feedback: PronunciationFeedback }) {
  const meta = CLARITY_META[feedback.clarity]
  const isCloud = feedback.source === "cloud"

  return (
    <div className={`mt-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] ${meta.color}`}>
      <div className="flex items-center gap-1.5">
        <span>{meta.icon}</span>
        <span className="font-medium">发音 · {meta.label}</span>
        {typeof feedback.score === "number" && (
          <span className="tabular-nums opacity-80">{feedback.score}%</span>
        )}
        <span className="ml-auto opacity-60">{isCloud ? "云端评测" : "浏览器置信度"}</span>
      </div>
      <div className="mt-0.5 leading-relaxed opacity-90">{feedback.advice}</div>
      {feedback.alternatives.length > 0 && (
        <div className="mt-0.5 opacity-60">
          也可能听成：{feedback.alternatives.slice(0, 2).join(" / ")}
        </div>
      )}
    </div>
  )
}
