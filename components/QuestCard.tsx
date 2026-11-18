"use client"
import { useState } from "react"
import type { Npc, QuestPlan } from "@/lib/types"

export default function QuestCard({ npc, plan }: { npc: Npc; plan: QuestPlan | null }) {
  const [open,setOpen]=useState(false)
  const steps=npc.quest.steps
  const count=plan ? Math.min(plan.index+1,steps.length) : 0
  const completed=count===steps.length
  return <div className="quest-strip">
    <button type="button" onClick={()=>setOpen(!open)} aria-expanded={open} className="quest-toggle">
      <span className="quest-state">{completed?"✓":"○"}</span>
      <span className="quest-title"><strong>{npc.quest.title}</strong><span>{completed?"本场景任务已完成":`接下来：${steps[count]?.label ?? steps[0]!.label}`}</span></span>
      <span className="quest-count">{count}/{steps.length}<span aria-hidden="true">{open?" −":" ＋"}</span></span>
    </button>
    {open&&<div className="quest-detail"><p>{npc.quest.brief}</p><ol>{steps.map((step,i)=><li key={step.id} className={i<count?"step-done":""}><span aria-label={i<count?"已完成":"未完成"}>{i<count?"✓":"○"}</span> {step.label}</li>)}</ol><p>任务奖励：{npc.quest.reward}</p></div>}
  </div>
}
