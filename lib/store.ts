import { isTaskCompletionArchive } from "./archiveContent"
import { randomUUID } from "node:crypto"
import { readData, writeData } from "./localData"
import { getGrowth, recordGrowth, resetGrowth } from "./growth"
import type {
  ArchiveCard,
  Correction,
  ProbeRecord,
  Profile,
  ProfileDelta,
  ReviewItem,
  TraceStep,
  WeaknessState,
} from "./types"

/** 单条对话轮次（短期上下文） */
export interface ChatTurn {
  role: "user" | "npc"
  content: string
}

interface StoreState {
  profile: Profile | null
  history: Record<string, ChatTurn[]>
  corrections: Correction[]
  archives: ArchiveCard[]
  trace: TraceStep[]
  turn: number
  reviews: ReviewItem[]
  /** 每个 NPC 的任务推进到第几步 */
  questStep: Record<string, number>
  /** 累计经验值 */
  xp: number
  /** 已经发过完成奖励的 NPC（避免重复发放） */
  questRewarded: Record<string, boolean>
  /** 薄弱点回收记录 */
  probes: ProbeRecord[]
  /** 每个薄弱点的生命周期 */
  weaknessStatus: Record<string, WeaknessState>

}

function createStore(): StoreState {
  return {
    profile: null,
    history: {},
    corrections: [],
    archives: readData<ArchiveCard[]>("archives", []),
    trace: [],
    turn: 0,
    reviews: [],
    questStep: {},
    xp: 0,
    questRewarded: {},
    probes: [],
    weaknessStatus: {},
  }
}

// 单用户内存态。挂到 globalThis 上，避免 Next dev 热更新时状态丢失。
const globalForStore = globalThis as unknown as { __langAgentStore?: StoreState }

const store: StoreState = globalForStore.__langAgentStore ?? createStore()
globalForStore.__langAgentStore = store

export function getProfile(): Profile | null {
  return store.profile
}

export function setProfile(profile: Profile): void {
  store.profile = profile
}

export function resetStore(): void {
  resetGrowth()
  store.profile = null
  store.history = {}
  store.corrections = []
  writeData("archives", [])
  store.archives = []
  store.trace = []
  store.turn = 0
  store.reviews = []
  store.questStep = {}
  store.xp = 0
  store.questRewarded = {}
  store.probes = []
  store.weaknessStatus = {}
}

export function currentTurn(): number {
  return store.turn
}

export function nextTurn(): number {
  store.turn += 1
  return store.turn
}

export function getHistory(npcId: string): ChatTurn[] {
  return store.history[npcId] ?? []
}

export function pushTurn(npcId: string, turn: ChatTurn): void {
  const list = store.history[npcId] ?? []
  list.push(turn)
  store.history[npcId] = list
}

export function addCorrection(correction: Correction): void {
  store.corrections.push(correction)
}

export function addArchive(card: ArchiveCard): void {
  if (isTaskCompletionArchive(card)) return
  const next = [...store.archives, card]
  writeData("archives", next)
  store.archives = next
}

export function getArchives(): ArchiveCard[] {
  const knowledge = store.archives.filter(card => !isTaskCompletionArchive(card))
  if (knowledge.length !== store.archives.length || knowledge.some(card => !card.id)) {
    const next = knowledge.map(card => ({ ...card, id: card.id ?? randomUUID() }))
    writeData("archives", next)
    store.archives = next
  }
  return store.archives
}

export function countArchives(): number {
  return getArchives().length
}

export function addReview(item: ReviewItem): void {
  store.reviews.push(item)
}

export function getReviews(): ReviewItem[] {
  return store.reviews
}

export function countReviews(): number {
  return store.reviews.length
}

/** 已到期的复习项 */
export function dueReviews(now = Date.now()): ReviewItem[] {
  return store.reviews.filter((item) => new Date(item.dueAt).getTime() <= now)
}

/** 复习完成：把到期项向后顺延（间隔重复的简化版） */
export function rescheduleDueReviews(now = Date.now()): number {
  const due = dueReviews(now)
  const next = new Date(now + 3 * 86400000).toISOString()
  for (const item of due) item.dueAt = next
  return due.length
}

/** 任务进度只前进不后退 */
export function advanceQuest(npcId: string, stepIndex: number): number {
  const current = getQuestStep(npcId)
  const next = Math.max(current, stepIndex)
  recordGrowth(npcId, next)
  store.questStep[npcId] = next
  return next
}

export function getQuestStep(npcId: string): number {
  return store.questStep[npcId] ?? getGrowth().find(item => item.npcId === npcId)?.index ?? 0
}

export function addXp(amount: number): number {
  store.xp += Math.max(0, Math.round(amount))
  return store.xp
}

export function getXp(): number {
  return store.xp
}

export function isQuestRewarded(npcId: string): boolean {
  return store.questRewarded[npcId] === true
}

export function markQuestRewarded(npcId: string): void {
  store.questRewarded[npcId] = true
}

export function addTrace(steps: TraceStep[]): void {
  store.trace.push(...steps)
}

export function getTrace(): TraceStep[] {
  return store.trace
}

/** 合并画像增量（推测信息去重、薄弱点去重） */
export function applyProfileDelta(delta: ProfileDelta | null): void {
  if (!delta || !store.profile) return
  const profile = store.profile

  for (const fact of delta.inferred ?? []) {
    if (!fact?.fact) continue
    const key = fact.fact.trim().toLowerCase()
    const exists = profile.inferred.some((item) => item.fact.trim().toLowerCase() === key)
    if (!exists) profile.inferred.push(fact)
  }

  for (const weakness of delta.weaknesses ?? []) {
    if (!weakness) continue
    const key = weakness.trim().toLowerCase()
    const exists = profile.learning.weaknesses.some((item) => item.trim().toLowerCase() === key)
    if (!exists) profile.learning.weaknesses.push(weakness)
  }
}


// ── 薄弱点回收 ──────────────────────────────

export function getWeaknessState(target: string): WeaknessState {
  const existing = store.weaknessStatus[target]
  if (existing) return existing
  const fresh: WeaknessState = { status: "detected", hits: 0, misses: 0, slotsUsed: [], lastTurn: 0 }
  store.weaknessStatus[target] = fresh
  return fresh
}

export function listWeaknessStates(): Array<{ target: string; state: WeaknessState }> {
  return Object.entries(store.weaknessStatus).map(([target, state]) => ({ target, state }))
}

export function recordProbe(record: ProbeRecord): void {
  store.probes.push(record)
  const state = getWeaknessState(record.target)
  state.slotsUsed = [...new Set([...state.slotsUsed, record.slot])]
  state.lastTurn = record.turn

  if (record.outcome === "hit") {
    state.hits += 1
    state.status = state.hits >= 2 ? "resolved" : "probing"
  } else {
    state.misses += 1
    state.status = "probing"
  }
}

export function getProbes(): ProbeRecord[] {
  return store.probes
}

/** 某个弱点最近一次被回收尝试的轮次（用于「隔一轮再试」） */
export function lastProbeTurn(target: string): number {
  const state = store.weaknessStatus[target]
  return state?.lastTurn ?? 0
}
