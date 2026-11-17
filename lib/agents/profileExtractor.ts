import { chatJson } from "../llm"
import { extractorSystemPrompt } from "../prompts"
import type { FactType, InferredFact, ProfileDelta } from "../types"

const FACT_TYPES: FactType[] = ["interest", "profession", "goal", "communication_style"]

/** 敏感词兜底：命中则丢弃该推测（对应 PRD「不采集敏感信息」） */
const SENSITIVE_PATTERNS = [
  /address/i,
  /phone/i,
  /passport/i,
  /id number/i,
  /real name/i,
  /salary/i,
  /religion/i,
  /politics/i,
]

function isSensitive(fact: string): boolean {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(fact))
}

export interface ExtractorResult {
  delta: ProfileDelta | null
  error: string | null
}

/**
 * Profile Extractor：从用户表达中提取非敏感画像信息。
 * 输出 Explicit/Inferred 中的 Inferred 部分 + 语言薄弱点。
 */
export async function runProfileExtractor(input: {
  userMessage: string
  turn: number
}): Promise<ExtractorResult> {
  const result = await chatJson<Record<string, unknown>>(
    extractorSystemPrompt(),
    `输入："${input.userMessage}"`,
  )

  if (!result.data) {
    return { delta: null, error: result.error ?? "画像提取未返回结果" }
  }

  const rawInferred = Array.isArray(result.data.inferred) ? result.data.inferred : []
  const rawWeaknesses = Array.isArray(result.data.weaknesses) ? result.data.weaknesses : []

  const inferred: InferredFact[] = []

  for (const item of rawInferred) {
    if (typeof item !== "object" || item === null) continue
    const record = item as Record<string, unknown>
    const fact = typeof record.fact === "string" ? record.fact.trim() : ""
    if (!fact || isSensitive(fact)) continue

    const confidenceRaw = typeof record.confidence === "number" ? record.confidence : 0.6
    const confidence = Math.min(1, Math.max(0, confidenceRaw))
    const type = FACT_TYPES.includes(record.type as FactType)
      ? (record.type as FactType)
      : "interest"

    inferred.push({ fact, confidence, type, sourceTurn: input.turn })
  }

  const weaknesses = rawWeaknesses
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())

  if (inferred.length === 0 && weaknesses.length === 0) {
    return { delta: null, error: null }
  }

  return { delta: { inferred, weaknesses }, error: null }
}
