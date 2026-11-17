import type { ArchiveCard, Correction, Profile, ProfileDelta, TraceStep } from "./types"

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
}

function createStore(): StoreState {
  return {
    profile: null,
    history: {},
    corrections: [],
    archives: [],
    trace: [],
    turn: 0,
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
  store.profile = null
  store.history = {}
  store.corrections = []
  store.archives = []
  store.trace = []
  store.turn = 0
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
