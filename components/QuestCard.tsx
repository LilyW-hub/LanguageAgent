"use client"

import { useState } from "react"
import type { Npc, QuestPlan } from "@/lib/types"

/**
 * 任务卡：把场景目标变成一件有步骤、可完成的事。
 * 进度来自 Agent 每轮的 plan 判定（服务端任务状态机），不是假动画。
 */
export default function QuestCard({ npc, plan }: { npc: Npc; plan: QuestPlan | null }) {
  const [open, setOpen] = useState(false)

  const steps = npc.quest.steps
  const index = plan?.index ?? 0
  const completed = index >= steps.length - 1

  return (
    <div className="relative px-5 pt-3">
      <div
        className={`rounded-xl border px-3.5 py-2.5 transition-colors ${
          completed ? "border-emerald-300 bg-emerald-50" : "border-amber-200 bg-amber-50/70"
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

          {/* 步骤条 */}
          <span className="ml-auto flex items-center gap-1">
            {steps.map((step, i) => (
              <span
                key={step.id}
                title={step.label}
                className={`h-1.5 rounded-full transition-all ${
                  i < index
                    ? completed
                      ? "w-4 bg-emerald-500"
                      : "w-4 bg-amber-500"
                    : i === index
                      ? "w-4 bg-amber-600 animate-pulse"
                      : "w-2 bg-amber-200"
                }`}
              />
            ))}
          </span>
          <span className="text-[10px] text-stone-500 tabular-nums">
            {Math.min(index + 1, steps.length)}/{steps.length}
          </span>
          <span className="text-[10px] text-stone-400">{open ? "▴" : "▾"}</span>
        </button>

        <div className="mt-1 pl-6 text-[10px] text-stone-500">
          当前：{plan?.stepLabel ?? steps[0]!.label}
        </div>

        {open && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] text-stone-600 leading-relaxed">{npc.quest.brief}</p>
            <div className="flex flex-wrap gap-1.5">
              {steps.map((step, i) => (
                <span
                  key={step.id}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    i < index
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : i === index
                        ? "border-amber-400 bg-amber-100 text-amber-800 font-medium"
                        : "border-stone-200 text-stone-400"
                  }`}
                >
                  {i + 1}. {step.label}
                </span>
              ))}
            </div>
            <div className="text-[10px] text-amber-700">
              奖励 {npc.quest.reward}
              {completed && " · 已发放"}
            </div>
            {completed && (
              <div className="text-[10px] text-emerald-700">
                ✅ 任务完成，奖励已计入右上角经验值
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
