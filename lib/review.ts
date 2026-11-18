import { getProfile, getWeaknessState, lastProbeTurn, listWeaknessStates } from "./store"
import type { Npc } from "./types"

/** 一次「薄弱点回收」的计划：用哪个角度把某个弱点自然地引回来 */
export interface ProbePlan {
  target: string
  slotId: string
  slotIntent: string
}

/** 同一个弱点至少隔一轮再回收，避免连续追问 */
const MIN_GAP_TURNS = 1

/**
 * 决定本轮要不要回收某个薄弱点。
 *
 * 候选来自画像里的 weaknesses（由上一轮的纠错沉淀而来）：
 * - 已 resolved 的跳过
 * - 刚回收过的跳过（隔一轮）
 * - 该角色还没用过的对话角度才可用（避免反复用同一句式）
 *
 * 返回 null 表示本轮不回收——宁可不回收，也不要生硬地追问。
 */
export function planProbe(npc: Npc, turn: number): ProbePlan | null {
  const profile = getProfile()
  if (!profile) return null

  const candidates = profile.learning.weaknesses
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((target) => {
      const state = getWeaknessState(target)
      if (state.status === "resolved") return false
      return turn - lastProbeTurn(target) > MIN_GAP_TURNS
    })

  for (const target of candidates) {
    const state = getWeaknessState(target)
    const slot = npc.probeSlots.find((item) => !state.slotsUsed.includes(item.id))
    if (!slot) continue
    return { target, slotId: slot.id, slotIntent: slot.intent }
  }

  return null
}

export interface WeaknessOverview {
  target: string
  status: "detected" | "probing" | "resolved"
  hits: number
  misses: number
}

/** 给 UI 的弱点总览 */
export function weaknessOverview(): WeaknessOverview[] {
  return listWeaknessStates().map(({ target, state }) => ({
    target,
    status: state.status,
    hits: state.hits,
    misses: state.misses,
  }))
}
