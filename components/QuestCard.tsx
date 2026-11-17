"use client"

import { useState } from "react"
import type { Npc } from "@/lib/types"

/**
 * 任务卡：把「场景目标」从一句标签变成一件可完成的事。
 * 进度来自真实发生的纠错次数（messages 里带 correction 的条数），不是假动画。
 */
export default function QuestCard({ npc, done }: { npc: Npc; done: number }) {
  const [open, setOpen] = useState(false)
  const target = Math.max(1, npc.quest.target)
  const progress = Math.min(done, target)
  const completed = progress >= target

  return (
    <div className="relative px-5 pt-3">
      <div
        className={`rounded-xl border px-3.5 py-2.5 transition-colors ${
          completed
            ? "border-emerald-300 bg-emerald-50"
            : "border-amber-200 bg-amber-50/70"
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="w-full flex items-center gap-2 text-left"
        >
          <span className="text-sm">{completed ? "✅" : "🎯"}</span>
          <span
            className={`text-xs font-semibold ${completed ? "text-emerald-800" : "text-amber-800"}`}
          >
            {completed ? "任务完成" : "今日任务"} · {npc.quest.title}
          </span>

          {/* 进度点 */}
          <span className="ml-auto flex items-center gap-1">
            {Array.from({ length: target }).map((_, index) => (
              <span
                key={index}
                className={`h-1.5 w-1.5 rounded-full ${
                  index < progress
                    ? completed
                      ? "bg-emerald-500"
                      : "bg-amber-500"
                    : "bg-amber-200"
                }`}
              />
            ))}
          </span>
          <span className="text-[10px] text-stone-500 tabular-nums">
            {progress}/{target}
          </span>
          <span className="text-[10px] text-stone-400">{open ? "▴" : "▾"}</span>
        </button>

        {open && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-stone-600 leading-relaxed">{npc.quest.brief}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {npc.quest.goals.map((goal) => (
                <span key={goal} className="text-[10px] text-stone-500">
                  · {goal}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-amber-700">
              奖励 {npc.quest.reward}
              {completed && " · 已发放"}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
