import type { ArchiveCard, Correction, Profile, ProfileDelta, ReviewItem, TraceStep } from "./types"

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
  /** 回放模式：不调用模型，走 lib/demoScript.ts 的剧本（现场兜底） */
  replay: boolean
}

function createStore(): StoreState {
  return {
    profile: null,
    history: {},
    corrections: [],
    archives: [],
    trace: [],
    turn: 0,
    reviews: [],
    questStep: {},
    xp: 0,
    questRewarded: {},
    replay: false,
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

export function getReplayMode(): boolean {
  return store.replay
}

export function setReplayMode(value: boolean): void {
  store.replay = value
}

export function resetStore(): void {
  store.profile = null
  store.history = {}
  store.corrections = []
  store.archives = []
  store.trace = []
  store.turn = 0
  store.reviews = []
  store.questStep = {}
  store.xp = 0
  store.questRewarded = {}
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
  store.archives.push(card)
}

export function getArchives(): ArchiveCard[] {
  return store.archives
}

export function countArchives(): number {
  return store.archives.length
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

/** 任务进度只前进不后退 */
export function advanceQuest(npcId: string, stepIndex: number): number {
  const current = store.questStep[npcId] ?? 0
  const next = Math.max(current, stepIndex)
  store.questStep[npcId] = next
  return next
}

export function getQuestStep(npcId: string): number {
  return store.questStep[npcId] ?? 0
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
