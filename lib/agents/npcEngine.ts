import { chatText } from "../llm"
import { npcSystemFilled, npcUserPrompt, type NpcPromptInput } from "../prompts"

/**
 * NPC Engine：生成角色回复（后于 Tutor 执行）。
 * 它只引用 Tutor 给出的 corrected，不自行另判错误 → 两层纠错同源。
 */
export async function runNpcEngine(input: NpcPromptInput): Promise<string> {
  const system = npcSystemFilled(input)
  const user = npcUserPrompt(input)

  try {
    const reply = await chatText(system, user)
    if (reply.length > 0) return reply
  } catch {
    // 降级到下方兜底
  }

  // 兜底：至少保证演示不断线
  return input.correction && input.correction.errorType !== "none"
    ? `Oh — you mean "${input.correction.corrected}"? That sounds right. Tell me more!`
    : "Tell me a bit more about that?"
}
