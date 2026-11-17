"use client"

import type { Correction } from "@/lib/types"

export default function ReviewCard({ correction }: { correction: Correction }) {
  return (
    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-sm">
      <div className="flex items-center gap-2 text-xs font-medium text-rose-700">
        <span>🩺</span>
        <span>课后卡 · {correction.errorType}</span>
      </div>

      <div className="mt-2 space-y-1.5">
        <div className="flex gap-2">
          <span className="text-stone-400 shrink-0 text-xs pt-0.5 w-12">原句</span>
          <span className="text-stone-600 line-through decoration-rose-300">{correction.original}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-stone-400 shrink-0 text-xs pt-0.5 w-12">改后</span>
          <span className="text-emerald-700 font-medium">{correction.corrected}</span>
        </div>
        {correction.natural && correction.natural !== correction.corrected && (
          <div className="flex gap-2">
            <span className="text-stone-400 shrink-0 text-xs pt-0.5 w-12">更自然</span>
            <span className="text-stone-700">{correction.natural}</span>
          </div>
        )}
        {correction.explanation && (
          <div className="flex gap-2">
            <span className="text-stone-400 shrink-0 text-xs pt-0.5 w-12">解释</span>
            <span className="text-stone-600">{correction.explanation}</span>
          </div>
        )}
      </div>

      {correction.addToReview && (
        <div className="mt-2 text-[11px] text-rose-600">已加入复习列表</div>
      )}
    </div>
  )
}
