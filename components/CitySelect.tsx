"use client"

import NpcAvatar from "./NpcAvatar"
import type { Npc } from "@/lib/types"

export default function CitySelect({
  npcs,
  activeId,
  onSelect,
  archivesCount,
}: {
  npcs: Npc[]
  activeId: string
  onSelect: (id: string) => void
  archivesCount: number
}) {
  return (
    <aside className="w-64 shrink-0 border-r border-stone-200 bg-white/70 flex flex-col">
      <div className="px-4 py-4 border-b border-stone-200">
        <div className="text-xs tracking-widest text-stone-400">EXPLORE</div>
        <div className="mt-1 flex items-center gap-1.5 text-stone-800 font-medium">
          <span>📍</span>
          <span>伦敦 · London</span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
            📜 档案 {archivesCount}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
        {npcs.map((npc) => {
          const active = npc.id === activeId
          return (
            <button
              key={npc.id}
              type="button"
              onClick={() => onSelect(npc.id)}
              className={`w-full text-left rounded-xl border p-3 transition ${
                active
                  ? "border-stone-800 bg-white shadow-sm"
                  : "border-stone-200 bg-white/60 hover:border-stone-400"
              }`}
            >
              <div className="flex items-center gap-3">
                <NpcAvatar npc={npc} size={40} />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-stone-900 truncate">{npc.name}</div>
                  <div className="text-xs text-stone-500 truncate">
                    {npc.age} · {npc.profession}
                  </div>
                </div>
              </div>
              <div className="mt-2 text-[11px] text-stone-500 leading-relaxed line-clamp-2">
                {npc.sceneLabel} · {npc.personality}
              </div>
              <div className="mt-1.5 text-[11px]" style={{ color: npc.accent }}>
                🎯 {npc.learningObjective}
              </div>
            </button>
          )
        })}
      </div>

      <div className="px-4 py-3 border-t border-stone-200 text-[11px] text-stone-400">
        世界地图（demo 仅伦敦）
      </div>
    </aside>
  )
}
