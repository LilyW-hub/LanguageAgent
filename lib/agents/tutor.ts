import { chatJson } from "../llm"
import { tutorSystemPrompt } from "../prompts"
import type { Correction, ErrorType } from "../types"

const ERROR_TYPES: ErrorType[] = ["grammar", "vocabulary", "word_order", "pragmatics", "none"]

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function normalize(raw: Record<string, unknown>, userMessage: string): Correction {
  const errorType = ERROR_TYPES.includes(raw.errorType as ErrorType)
    ? (raw.errorType as ErrorType)
    : "none"

  const corrected = asString(raw.corrected, userMessage)

  return {
    original: asString(raw.original, userMessage),
    corrected,
    errorType,
    explanation: asString(raw.explanation, ""),
    natural: asString(raw.natural, corrected),
    addToReview: raw.addToReview !== false && errorType !== "none",
  }
}

/**
 * Tutor：纠错的唯一事实源（先于 NPC Engine 执行）。
 * 任何失败都降级为「无错误」，绝不阻断对话。
 */
export async function runTutor(input: { userMessage: string; level: string }): Promise<Correction> {
  const fallback: Correction = {
    original: input.userMessage,
    corrected: input.userMessage,
    errorType: "none",
    explanation: "",
    natural: input.userMessage,
    addToReview: false,
  }

  const parsed = await chatJson<Record<string, unknown>>(
    tutorSystemPrompt(input.level),
    `输入："${input.userMessage}"`,
  )

  if (!parsed) return fallback

  const correction = normalize(parsed, input.userMessage)

  // 模型说没错误，但 corrected 与原文不同 → 以「有错误」为准，避免漏纠
  if (
    correction.errorType === "none" &&
    correction.corrected.trim() !== input.userMessage.trim() &&
    correction.corrected.trim().length > 0
  ) {
    correction.errorType = "grammar"
    correction.addToReview = true
  }

  return correction
}
