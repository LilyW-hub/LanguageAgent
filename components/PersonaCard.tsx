"use client"

import NpcAvatar from "./NpcAvatar"
import type { Npc } from "@/lib/types"

/**
 * 人设卡：把「这是谁」讲清楚。
 * 内容全部来自人工审校的人设卡（lib/npcs.ts），不是模型生成的。
 */
export default function PersonaCard({ npc, onClose }: { npc: Npc; onClose: () => void }) {
  const traits = npc.personality
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)

  return (
    <div className="relative px-5 py-4 border-b border-stone-200 bg-white/95 backdrop-blur">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-3 top-3 text-xs text-stone-400 hover:text-stone-700"
        aria-label="收起人物介绍"
      >
        收起 ✕
      </button>

      <div className="flex gap-4">
        <NpcAvatar npc={npc} size={64} />

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-lg font-semibold text-stone-900">{npc.name}</span>
            <span className="text-xs text-stone-500">
              {npc.age} 岁 · {npc.profession}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-stone-100 text-stone-500">
              语言难度 {npc.languageLevel}
            </span>
          </div>

          <p className="mt-1.5 text-xs text-stone-600 leading-relaxed">{npc.story}</p>

          <div className="mt-2 flex flex-wrap gap-1.5">
            {traits.map((trait) => (
              <span
                key={trait}
                className="text-[10px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600"
              >
                {trait}
              </span>
            ))}
            {npc.interests.map((interest) => (
              <span
                key={interest}
                className="text-[10px] px-2 py-0.5 rounded-full border"
                style={{ borderColor: npc.accent, color: npc.accent }}
              >
                {interest}
              </span>
            ))}
          </div>

          <div className="mt-2 flex items-center gap-3 text-[10px] text-stone-500">
            <span>📍 {npc.city} · {npc.sceneLabel}</span>
            <span>🎯 {npc.learningObjective}</span>
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-stone-400">
        虚构人物 · 地域与文化背景参照真实环境，个人经历为创作
      </div>
    </div>
  )
}
