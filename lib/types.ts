/** 共享类型定义（对应技术文档 §5） */

export type Level = "A0" | "A1" | "A2" | "B1" | "B2"

export type FactType = "interest" | "profession" | "goal" | "communication_style"

export interface InferredFact {
  fact: string
  confidence: number
  sourceTurn: number
  type?: FactType
}

export interface Profile {
  level: Level
  goal: string
  explicit: {
    nativeLanguage: string
    targetLanguage: string
    interests: string[]
    profession?: string
  }
  inferred: InferredFact[]
  learning: {
    weaknesses: string[]
    recentErrors: string[]
  }
}

export type ErrorType = "grammar" | "vocabulary" | "word_order" | "pragmatics" | "none"

/**
 * 错误严重度：
 * - blocking：会让人误解意思，值得当面自然地复述一次
 * - minor：不影响理解的细节（冠词、单复数等），不当面纠，只放进折叠卡
 * - none：无错误
 */
export type ErrorSeverity = "blocking" | "minor" | "none"

export interface Correction {
  original: string
  corrected: string
  errorType: ErrorType
  severity: ErrorSeverity
  explanation: string
  natural: string
  addToReview: boolean
}

export interface ArchiveCard {
  id?: string
  npcId?: string
  title: string
  city: string
  category: "Language" | "Culture" | "Life" | "People"
  summary: string
}

export type TraceAgent = "memory" | "plan" | "probe" | "tutor" | "npc" | "tool" | "reward" | "profile"

export interface TraceStep {
  turn: number
  agent: TraceAgent
  action: string
  detail?: string
}

export interface ProfileDelta {
  inferred?: InferredFact[]
  weaknesses?: string[]
}

/** 发音清晰度反馈（本地启发式或云端评测） */
export interface PronunciationFeedback {
  clarity: "clear" | "fair" | "unclear" | "unknown"
  /** 0–100；浏览器未提供置信度时为 null */
  score: number | null
  transcript: string
  alternatives: string[]
  advice: string
  /** 数据来源：local=浏览器置信度启发式，cloud=云端音素级评测 */
  source?: "local" | "cloud"
}

export interface ChatMessage {
  id: string
  role: "user" | "npc"
  content: string
  correction?: Correction | null
  archiveCard?: ArchiveCard | null
  pronunciation?: PronunciationFeedback | null
}

export interface GrowthRecord {
  npcId: string
  index: number
  completedAt: string | null
}

/** 任务计划的当前进度 */
export interface QuestPlan {
  stepId: string
  stepLabel: string
  index: number
  total: number
}

/** 一次「薄弱点回收」的尝试记录 */
export interface ProbeRecord {
  target: string
  slot: string
  turn: number
  outcome: "hit" | "miss"
}

/** 薄弱点生命周期 */
export interface WeaknessState {
  status: "detected" | "probing" | "resolved"
  hits: number
  misses: number
  /** 已经用过的槽位，避免反复问同一个角度 */
  slotsUsed: string[]
  lastTurn: number
}

/** 间隔重复队列项 */
export interface ReviewItem {
  item: string
  note: string
  errorType: ErrorType
  dueAt: string
  npcId: string
  turn: number
}

/** 一次交互实际发放的奖励 */
export interface RewardSummary {
  /** 累计经验值 */
  total: number
  /** 本轮新增经验值 */
  gained: number
  /** 等级（每 100 XP 一级） */
  level: number
  /** 本轮奖励明细，例如「开口 +5」「回收成功 +15」 */
  items: string[]
  /** 本轮是否成功回收了一个薄弱点 */
  probeResolved?: string | null
}

export interface ChatResponse {
  growth: GrowthRecord[]
  reply: string
  plan: QuestPlan | null
  rewards: RewardSummary
  learningObjective: string
  correction: Correction | null
  profileDelta: ProfileDelta | null
  archiveCard: ArchiveCard | null
  trace: TraceStep[]
  profile: Profile
  /** 弱点生命周期总览（给侧栏用） */
  weaknesses?: Array<{ target: string; status: string; hits: number; misses: number }>
}

export interface Npc {
  id: string
  name: string
  city: string
  scene: string
  sceneLabel: string
  age: number
  profession: string
  personality: string
  interests: string[]
  speechStyle: string
  languageLevel: string
  learningObjective: string
  factBoundary: string[]
  forbidden: string[]
  opening: string
  story: string
  /** 该角色场景下的快捷句式（属于人设，不同 NPC 不同） */
  suggestions: Array<{ label: string; text: string }>
  /** 回收薄弱点时可用的对话角度（意图，不是句子模板） */
  probeSlots: Array<{ id: string; intent: string }>
  /** 与该场景绑定的今日任务 */
  quest: {
    title: string
    brief: string
    goals: string[]
    /**
     * 任务状态机的步骤（顺序推进）。
     * 推进一步需要「证据」：用户这句话命中 cues，或达到 minWords。
     * 没有 cues 也没有 minWords 的步骤（如打招呼）视为自动满足。
     */
    steps: Array<{ id: string; label: string; cues?: string[]; minWords?: number }>
    reward: string
    /** 需要几次有效纠错才算完成 */
    target: number
  }
  avatarEmoji: string
  /** 场景背景图（public/scenes 下的 SVG） */
  sceneImage: string
  accent: string
  bg: string
}
