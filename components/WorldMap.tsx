"use client"

import { useState } from "react"
import { CITIES, type CityNode } from "@/lib/world"

/**
 * 世界地图：文明档案员的出发点。
 *
 * 叙事在此处立住：不是「选个课程」，而是「在文明消失前，尽可能多地记录它」。
 * 演示版本只开放伦敦，其余城市明确标注为即将开放——不假装有内容。
 */
export default function WorldMap({
  archives,
  onEnterLondon,
}: {
  archives: number
  onEnterLondon: () => void
}) {
  const [hint, setHint] = useState<string | null>(null)

  function handleClick(city: CityNode) {
    if (city.unlocked) {
      onEnterLondon()
      return
    }
    setHint(`${city.name}：${city.requirement}`)
    window.setTimeout(() => setHint(null), 2600)
  }

  const goal = 6

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#14110F] text-stone-100">
      {/* 地图底图 */}
      <div
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: "url(/scenes/world.svg)" }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />

      {/* 顶部：使命 */}
      <header className="relative px-10 pt-9 flex items-start justify-between gap-8">
        <div>
          <div className="text-[11px] tracking-[0.3em] text-amber-400/80">
            CIVILIZATION TRANSFER PROGRAM
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            文明迁徙计划
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-stone-300/90">
            在文明消失之前，尽可能多地探索城市、认识当地人、记录他们的语言与生活。
            你是<strong className="text-amber-300"> 文明档案员 </strong>——你保存的每一条，都是未来人类理解这个世界的依据。
          </p>
        </div>

        <div className="shrink-0 w-56 rounded-xl border border-white/10 bg-black/30 px-4 py-3 backdrop-blur">
          <div className="flex items-baseline justify-between">
            <span className="text-[11px] text-stone-400">主线收集进度</span>
            <span className="text-xs tabular-nums text-amber-300">
              {archives} / {goal}
            </span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-amber-400 transition-all"
              style={{ width: `${Math.min(100, (archives / goal) * 100)}%` }}
            />
          </div>
          <div className="mt-2 text-[10px] text-stone-500">
            每完成一次「被纠正的表达」，就收录一张档案
          </div>
        </div>
      </header>

      {/* 城市节点 */}
      <div className="absolute inset-0">
        {CITIES.map((city) => {
          const active = city.unlocked
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => handleClick(city)}
              className="absolute -translate-x-1/2 -translate-y-1/2 group"
              style={{ left: `${city.x}%`, top: `${city.y}%` }}
            >
              <span
                className={`block rounded-full transition ${
                  active
                    ? "h-3 w-3 bg-amber-300 ring-4 ring-amber-400/25 group-hover:ring-amber-400/50"
                    : "h-2 w-2 bg-stone-500 group-hover:bg-stone-300"
                }`}
              />
              <span
                className={`absolute left-4 top-[-6px] whitespace-nowrap text-[11px] px-2 py-0.5 rounded ${
                  active
                    ? "bg-amber-400/15 text-amber-200 border border-amber-400/30"
                    : "bg-black/40 text-stone-400 border border-white/10"
                }`}
              >
                {city.name}
                {!active && <span className="ml-1 opacity-60">🔒</span>}
              </span>
            </button>
          )
        })}
      </div>

      {/* 底部：入口 */}
      <footer className="absolute inset-x-0 bottom-0 px-10 pb-9 flex items-end justify-between">
        <div className="text-[11px] text-stone-400/80 leading-relaxed">
          <div>🌍 当前开放：伦敦 · 2 位当地人</div>
          <div className="mt-1 text-stone-500">
            其余城市按主线推进解锁，不消耗付费点数
          </div>
        </div>

        <button
          type="button"
          onClick={onEnterLondon}
          className="rounded-xl bg-amber-400 px-6 py-3 text-sm font-semibold text-stone-900 hover:bg-amber-300 transition"
        >
          出发去伦敦 →
        </button>
      </footer>

      {hint && (
        <div className="absolute left-1/2 bottom-28 -translate-x-1/2 rounded-lg border border-white/10 bg-black/70 px-4 py-2 text-xs text-amber-200 backdrop-blur">
          {hint}
        </div>
      )}
    </div>
  )
}
