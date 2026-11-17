import { chatJson } from "../llm"
import { tutorSystemPrompt } from "../prompts"
import type { Correction, ErrorType } from "../types"

const ERROR_TYPES: ErrorType[] = ["grammar", "vocabulary", "word_order", "pragmatics", "none"]

export interface TutorResult {
  correction: Correction
  /** 非空表示纠错服务不可用（对话仍可继续，但要在 Trace 里显式标注） */
  error: string | null
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

function normalizeErrorType(value: unknown): ErrorType {
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase()
    if (ERROR_TYPES.includes(raw as ErrorType)) return raw as ErrorType
    // 模型常返回自由描述（"Verb tense" / "past tense" / "preposition"…），做一次归类
    if (/tense|verb|agreement|article|preposition|plural|grammar/.test(raw)) return "grammar"
    if (/vocab|word choice|lexical|collocation/.test(raw)) return "vocabulary"
    if (/word order|order|syntax/.test(raw)) return "word_order"
    if (/pragmat|politeness|register|natural/.test(raw)) return "pragmatics"
    if (/none|no error/.test(raw)) return "none"
    return "none"
  }
  return "none"
}

function normalize(raw: Record<string, unknown>, userMessage: string): Correction {
  const errorType = normalizeErrorType(raw.errorType)

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
 * 失败时返回「无错误」保证对话继续，但通过 error 字段暴露原因。
 */
export async function runTutor(input: { userMessage: string; level: string }): Promise<TutorResult> {
  const fallback: Correction = {
    original: input.userMessage,
    corrected: input.userMessage,
    errorType: "none",
    explanation: "",
    natural: input.userMessage,
    addToReview: false,
  }

  const result = await chatJson<Record<string, unknown>>(
    tutorSystemPrompt(input.level),
    `输入："${input.userMessage}"`,
    { maxTokens: 260 },
  )

  if (!result.data) {
    return { correction: fallback, error: result.error ?? "纠错服务未返回结果" }
  }

  const correction = normalize(result.data, input.userMessage)

  // 模型说没错误，但 corrected 与原文不同 → 以「有错误」为准，避免漏纠
  if (
    correction.errorType === "none" &&
    correction.corrected.trim() !== input.userMessage.trim() &&
    correction.corrected.trim().length > 0
  ) {
    correction.errorType = "grammar"
    correction.addToReview = true
  }

  return { correction, error: null }
}
