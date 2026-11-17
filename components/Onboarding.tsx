"use client"

import { useState } from "react"
import type { Level, Profile } from "@/lib/types"

const LEVELS: Level[] = ["A0", "A1", "A2", "B1", "B2"]

const INTEREST_OPTIONS = [
  "photography",
  "music",
  "travel",
  "technology",
  "movies",
  "cooking",
  "reading",
  "sports",
]

const DEMO_DATA = {
  level: "A2" as Level,
  goal: "job interview",
  profession: "designer",
  interests: ["photography", "travel"],
}

export default function Onboarding({
  onSubmit,
  busy,
}: {
  onSubmit: (data: {
    level: Level
    goal: string
    profession: string
    interests: string[]
  }) => void
  busy: boolean
}) {
  const [level, setLevel] = useState<Level>("A2")
  const [goal, setGoal] = useState("")
  const [profession, setProfession] = useState("")
  const [interests, setInterests] = useState<string[]>([])

  function toggleInterest(item: string) {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((value) => value !== item) : [...prev, item],
    )
  }

  function fillDemo() {
    setLevel(DEMO_DATA.level)
    setGoal(DEMO_DATA.goal)
    setProfession(DEMO_DATA.profession)
    setInterests(DEMO_DATA.interests)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-sm border border-stone-200 p-8">
        <div className="text-xs tracking-widest text-stone-400 mb-2">CIVILIZATION ARCHIVIST</div>
        <h1 className="text-2xl font-semibold text-stone-900">文明档案员，你好</h1>
        <p className="mt-2 text-sm text-stone-500 leading-relaxed">
          在文明迁徙计划启动之前，你需要尽可能多地记录地球上的人类文化。
          先告诉我们一点你的信息，我们会为你安排第一位当地向导。
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <div className="flex items-baseline justify-between">
              <label className="text-sm font-medium text-stone-700">母语 / 目标语言</label>
              <span className="text-xs text-stone-400">demo 固定</span>
            </div>
            <div className="mt-2 flex gap-2">
              <span className="px-3 py-1.5 rounded-lg bg-stone-100 text-sm text-stone-600">中文</span>
              <span className="text-stone-300 self-center">→</span>
              <span className="px-3 py-1.5 rounded-lg bg-amber-100 text-sm text-amber-800">英语</span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">当前英语水平</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {LEVELS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLevel(item)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition ${
                    level === item
                      ? "bg-stone-900 text-white border-stone-900"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">学习目标</label>
            <input
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              placeholder="如：job interview / travel / study abroad"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-stone-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">
              职业 <span className="text-stone-400 font-normal">（可跳过）</span>
            </label>
            <input
              value={profession}
              onChange={(event) => setProfession(event.target.value)}
              placeholder="如：designer"
              className="mt-2 w-full px-3 py-2 rounded-lg border border-stone-200 text-sm outline-none focus:border-stone-400"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-stone-700">
              兴趣 <span className="text-stone-400 font-normal">（可跳过多选）</span>
            </label>
            <div className="mt-2 flex flex-wrap gap-2">
              {INTEREST_OPTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleInterest(item)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition ${
                    interests.includes(item)
                      ? "bg-amber-100 text-amber-900 border-amber-300"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-400"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmit({ level, goal, profession, interests })}
            className="px-5 py-2.5 rounded-lg bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-50"
          >
            开始探索
          </button>
          <button
            type="button"
            onClick={fillDemo}
            className="px-4 py-2.5 rounded-lg border border-stone-200 text-sm text-stone-600 hover:border-stone-400"
          >
            一键填入演示数据
          </button>
        </div>
      </div>
    </div>
  )
}
