"use client"

import { useState } from "react"
import type { Correction } from "@/lib/types"

/**
 * 「也可以这样说」——不是错题判决，是一句补充。
 *
 * 设计原则（鼓励优先）：
 * - 默认折叠，不打断阅读
 * - 不显示「原句」、不划线、不打错误类型标签
 * - 中性配色，不用红色
 * - 用户想看才展开
 */
export default function ReviewCard({ correction }: { correction: Correction }) {
  const [open, setOpen] = useState(false)

  const hasNatural = Boolean(correction.natural && correction.natural !== correction.corrected)

  return (
    <div className="mt-1.5 rounded-lg border border-stone-200 bg-white/70">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-left"
      >
        <span className="text-[11px]">💬</span>
        <span className="text-[11px] text-stone-500">也可以这样说</span>
        <span className="ml-auto text-[10px] text-stone-400">{open ? "▴" : "▾"}</span>
      </button>

      {open && (
        <div className="px-2.5 pb-2 space-y-1">
          <div className="text-[13px] text-stone-800 leading-relaxed">
            {correction.corrected}
          </div>
          {hasNatural && (
            <div className="text-[11px] text-stone-500 leading-relaxed">
              更自然：{correction.natural}
            </div>
          )}
          {correction.explanation && (
            <div className="text-[10px] text-stone-400 leading-relaxed">
              {correction.explanation}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
