import type { PronunciationFeedback } from "./types"

/** 编辑距离（用于判断多个识别候选之间的分歧程度） */
function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let previous = Array.from({ length: n + 1 }, (_, i) => i)

  for (let i = 1; i <= m; i += 1) {
    const current = [i]
    for (let j = 1; j <= n; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      current[j] = Math.min(
        (current[j - 1] ?? 0) + 1,
        (previous[j] ?? 0) + 1,
        (previous[j - 1] ?? 0) + cost,
      )
    }
    previous = current
  }
  return previous[n] ?? 0
}

/** 两个候选的差异比例 0~1 */
function divergence(a: string, b: string): number {
  const longest = Math.max(a.length, b.length)
  if (longest === 0) return 0
  return editDistance(a, b) / longest
}

const ADVICE: Record<PronunciationFeedback["clarity"], string> = {
  clear: "识别很有把握，发音清晰。",
  fair: "识别把握一般。可以放慢一点、把词尾辅音说完整，再试一次。",
  unclear: "识别把握偏低。可能说得太快或太轻，建议拆短句、逐个词慢慢说。",
  unknown: "当前浏览器未提供识别置信度，暂时无法判断发音清晰度。",
}

/**
 * 本地发音评估（无需任何音频服务）。
 *
 * 依据两个真实信号：
 * 1. Web Speech 的 confidence —— 浏览器对这次识别有多确定
 * 2. 多个候选之间的分歧 —— 分歧越大，说明声音越容易被听成别的词
 *
 * 这是**启发式**而非音素级评测：它衡量的是「机器听你的话有多确定」，
 * 与「母语者听感」相关但不完全等价。接入云端评测后由 /api/pronunciation 提供更精确结果。
 */
export function assessPronunciation(input: {
  transcript: string
  confidence: number
  alternatives: string[]
}): PronunciationFeedback {
  const alternatives = input.alternatives.filter(
    (item) => item.trim().length > 0 && item.trim() !== input.transcript.trim(),
  )

  // 浏览器可能始终返回 0：此时不臆造分数
  if (!Number.isFinite(input.confidence) || input.confidence <= 0) {
    return {
      clarity: "unknown",
      score: null,
      transcript: input.transcript,
      alternatives,
      advice: ADVICE.unknown,
    }
  }

  const confidenceScore = Math.min(1, Math.max(0, input.confidence)) * 100

  // 候选分歧惩罚：只有明显分歧才扣分，最多扣 15 分。
  // 阈值偏保守——浏览器给出的次选候选常有小差异，不该因此把「清晰」判成「含糊」。
  const worstDivergence = alternatives.reduce(
    (max, item) => Math.max(max, divergence(input.transcript, item)),
    0,
  )
  const penalty = worstDivergence > 0.25 ? Math.min(15, (worstDivergence - 0.25) * 40) : 0

  const score = Math.max(0, Math.round(confidenceScore - penalty))

  const clarity: PronunciationFeedback["clarity"] =
    score >= 85 ? "clear" : score >= 60 ? "fair" : "unclear"

  return {
    clarity,
    score,
    transcript: input.transcript,
    alternatives,
    advice: ADVICE[clarity],
  }
}
