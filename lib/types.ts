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

export type TraceAgent = "memory" | "tutor" | "npc" | "profile"

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

export interface ChatMessage {
  id: string
  role: "user" | "npc"
  content: string
  correction?: Correction | null
  archiveCard?: ArchiveCard | null
}

export interface ChatResponse {
  reply: string
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
  avatarEmoji: string
  /** 场景背景图（public/scenes 下的 SVG） */
  sceneImage: string
  accent: string
  bg: string
}
