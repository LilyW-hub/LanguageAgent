"use client"

import { growthSteps } from "@/lib/questProgress"
import type { GrowthRecord, Npc } from "@/lib/types"

export default function GrowthPanel({ records, npcs }: { records: GrowthRecord[]; npcs: Npc[] }) {
  const completed = npcs.filter(npc => records.some(record => record.npcId === npc.id && record.completedAt)).length
  return <section className="p-4 space-y-5">
    <div><h2 className="font-semibold text-stone-900">成长</h2><p className="mt-1 text-xs text-stone-500">完成场景任务，自动积累你的生活技能。</p></div>
    <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900"><strong>{completed}</strong> / {npcs.length} 项生活技能已完成
      <div className="mt-3 h-2 rounded bg-emerald-100"><div className="h-2 rounded bg-emerald-500 transition-all" style={{ width: `${npcs.length ? completed / npcs.length * 100 : 0}%` }} /></div>
    </div>
    <ul className="space-y-3">{npcs.map(npc => {
      const record = records.find(item => item.npcId === npc.id)
      const steps = growthSteps(npc, record)
      const done = !!record?.completedAt
      return <li key={npc.id} className={`rounded-xl border p-3 ${done ? "border-emerald-200 bg-emerald-50/50" : "border-stone-200"}`}>
        <div className="flex items-start gap-2"><span aria-hidden="true">{done ? "✅" : "○"}</span><div className="min-w-0">
          <h3 className="text-sm font-medium text-stone-800">{npc.quest.title}</h3>
          <p className="mt-1 text-xs text-stone-500">{npc.sceneLabel} · {npc.name}</p>
          <p className="mt-2 text-xs text-stone-600">{done ? "已完成" : record ? `进行中 · ${steps.filter(step => step.completed).length}/${steps.length} 步已完成` : "待探索"}</p>
          {record?.completedAt && <p className="mt-1 text-xs text-emerald-700">{new Date(record.completedAt).toLocaleDateString("zh-CN")} 完成</p>}
          <ul className="mt-3 space-y-2" aria-label={npc.quest.title + "任务清单"}>
            {steps.map(step => <li key={step.id} className="flex items-start gap-2">
              <input type="checkbox" checked={step.completed} disabled aria-label={step.label} className="mt-0.5 accent-emerald-600" />
              <span className={`text-xs ${step.completed ? "text-emerald-700" : "text-stone-500"}`}>{step.label}</span>
            </li>)}
          </ul>
        </div></div>
      </li>
    })}</ul>
    <p className="text-[11px] text-stone-400">由任务完成情况自动记录并保存，刷新或重启后保留。重置会清空记录。</p>
  </section>
}
