import type { Npc, Profile } from "../types"

export interface MemoryResult {
  summary: string
  /** 进入 NPC 上下文的关键点（用于 Trace 展示） */
  focus: string[]
}

/**
 * 冷启动画像摘要（对应技术文档 §7.4）。
 *
 * 实现说明：这里用确定性压缩而非再调一次 LLM —— 演示场景下零延迟、零失败率，
 * 且「不泄露记忆」的约束由模板天然保证。若后续画像维度变复杂，可换成 LLM 摘要。
 */
export function buildMemorySummary(profile: Profile, npc: Npc): MemoryResult {
  const explicitInterests = profile.explicit.interests
  const inferredFacts = profile.inferred.map((item) => item.fact)
  const weaknesses = profile.learning.weaknesses

  const focus: string[] = [`level ${profile.level}`, `objective [${npc.learningObjective}]`]
  if (explicitInterests.length > 0) focus.push(`interests: ${explicitInterests.join(", ")}`)
  if (inferredFacts.length > 0) focus.push(`inferred: ${inferredFacts.slice(0, 3).join(", ")}`)
  if (weaknesses.length > 0) focus.push(`weak: ${weaknesses.slice(0, 3).join(", ")}`)

  const parts = [
    `Level ${profile.level}.`,
    profile.goal ? `Learning goal: ${profile.goal}.` : "",
    explicitInterests.length > 0 ? `Stated interests: ${explicitInterests.join(", ")}.` : "",
    inferredFacts.length > 0 ? `Likely interests: ${inferredFacts.slice(0, 3).join(", ")}.` : "",
    weaknesses.length > 0 ? `Needs practice: ${weaknesses.slice(0, 3).join(", ")}.` : "",
    `Keep language at ${profile.level}; naturally steer toward ${npc.learningObjective}.`,
  ].filter(Boolean)

  return {
    summary: parts.join(" ").slice(0, 300),
    focus,
  }
}
