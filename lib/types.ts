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

export interface Correction {
  original: string
  corrected: string
  errorType: ErrorType
  explanation: string
  natural: string
  addToReview: boolean
}

export interface ArchiveCard {
  title: string
  city: string
  category: "Language" | "Culture" | "Life" | "People"
  summary: string
}

export type TraceAgent = "memory" | "plan" | "tutor" | "npc" | "tool" | "profile"

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

/** 任务计划的当前进度 */
export interface QuestPlan {
  stepId: string
  stepLabel: string
  index: number
  total: number
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

export interface ChatResponse {
  reply: string
  plan: QuestPlan | null
  learningObjective: string
  correction: Correction | null
  profileDelta: ProfileDelta | null
  archiveCard: ArchiveCard | null
  trace: TraceStep[]
  profile: Profile
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
  /** 与该场景绑定的今日任务 */
  quest: {
    title: string
    brief: string
    goals: string[]
    /** 任务状态机的步骤（顺序推进） */
    steps: Array<{ id: string; label: string }>
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
