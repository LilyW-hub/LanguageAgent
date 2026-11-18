"use client"

import ArchivePractice from "./ArchivePractice"
import type { ArchiveCard } from "@/lib/types"

export interface ArchiveEntry {
  card: ArchiveCard
  npcName: string
}

const CATEGORY_LABEL: Record<ArchiveCard["category"], string> = {
  Language: "语言",
  Culture: "文化",
  Life: "生活",
  People: "人物",
}

/**
 * 文明档案馆：把散落在对话里的档案卡收拢成可积累的收藏。
 * 对应 PRD「故事给使命 → 学习给手段 → 档案给证明」。
 */
export default function ArchivePanel({ entries }: { entries: ArchiveEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-xs text-stone-400 leading-relaxed">
        还没有档案。和当地人交流、学习新的表达和生活知识，就会自动收录。
        <div className="mt-3 text-[10px] text-stone-300">
          收集后可以针对档案知识点进行练习。
        </div>
      </div>
    )
  }

  const byCity = new Map<string, ArchiveEntry[]>()
  for (const entry of entries) {
    const key = entry.card.city || "未标注"
    const list = byCity.get(key) ?? []
    list.push(entry)
    byCity.set(key, list)
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-stone-400">文明档案馆</span>
        <span className="text-[11px] text-amber-700 tabular-nums">共 {entries.length} 张</span>
      </div>

      {[...byCity.entries()].map(([city, list]) => (
        <div key={city}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[11px] text-stone-500">
            <span>📍</span>
            <span>{city}</span>
            <span className="text-stone-300">·</span>
            <span className="tabular-nums">{list.length}</span>
          </div>

          <ul className="space-y-1.5">
            {list.map((entry, index) => (
              <li
                key={`${entry.card.title}-${index}`}
                className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-yellow-50 px-2.5 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-stone-800 leading-snug">
                    📜 {entry.card.title}
                  </span>
                  <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-amber-200/60 text-amber-900">
                    {CATEGORY_LABEL[entry.card.category] ?? entry.card.category}
                  </span>
                </div>
                <div className="mt-1 text-[10px] text-stone-600 leading-relaxed">
                  {entry.card.summary}
                </div>
                <div className="mt-0.5 text-[9px] text-amber-700">来自 {entry.npcName}</div>
                {entry.card.id && <ArchivePractice archiveId={entry.card.id} />}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
