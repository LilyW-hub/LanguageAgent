"use client"

import type { ArchiveCard } from "@/lib/types"

export default function ArchiveCardView({ card }: { card: ArchiveCard }) {
  return (
    <div className="mt-2 rounded-xl border border-amber-300 bg-gradient-to-br from-amber-50 to-yellow-50 p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-medium text-amber-800">
          <span>📜</span>
          <span>已收集文明档案</span>
        </div>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-900">
          {card.category}
        </span>
      </div>
      <div className="mt-1.5 font-medium text-stone-800">{card.title}</div>
      <div className="mt-0.5 text-xs text-stone-600 leading-relaxed">{card.summary}</div>
      <div className="mt-1 text-[10px] text-amber-700">📍 {card.city}</div>
    </div>
  )
}
