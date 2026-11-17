"use client"

import type { TraceAgent, TraceStep } from "@/lib/types"

const AGENT_META: Record<TraceAgent, { icon: string; label: string; color: string }> = {
  memory: { icon: "🧠", label: "memory", color: "#0f766e" },
  plan: { icon: "📋", label: "plan", color: "#7c3aed" },
  tool: { icon: "🔧", label: "tool", color: "#c2410c" },
  reward: { icon: "⭐", label: "reward", color: "#a16207" },
  tutor: { icon: "🩺", label: "tutor", color: "#b91c1c" },
  npc: { icon: "🎭", label: "npc", color: "#7c3aed" },
  profile: { icon: "👤", label: "profile", color: "#1d4ed8" },
}

export default function TracePanel({ trace }: { trace: TraceStep[] }) {
  if (trace.length === 0) {
    return (
      <div className="p-4 text-xs text-stone-400 leading-relaxed">
        还没有 Agent 动作。发一条消息，这里会实时显示 Orchestrator 的每一步决策。
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      {trace.map((step, index) => {
        const meta = AGENT_META[step.agent]
        return (
          <div
            key={`${step.turn}-${step.agent}-${index}`}
            className="rounded-lg border border-stone-200 bg-white px-2.5 py-2"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm leading-none">{meta.icon}</span>
              <span
                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                style={{ color: meta.color, background: `${meta.color}14` }}
              >
                {meta.label}
              </span>
              <span className="text-[10px] text-stone-400 ml-auto tabular-nums">turn {step.turn}</span>
            </div>
            <div className="mt-1 text-[11px] text-stone-700 leading-relaxed">{step.action}</div>
            {step.detail && (
              <div className="mt-1 text-[10px] text-stone-400 leading-relaxed line-clamp-3">
                {step.detail}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
