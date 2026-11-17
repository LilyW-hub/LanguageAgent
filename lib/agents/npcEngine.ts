import { chatText } from "../llm"
import { npcSystemFilled, npcUserPrompt, type NpcPromptInput } from "../prompts"

/**
 * NPC Engine：生成角色回复（后于 Tutor 执行）。
 * 它只引用 Tutor 给出的 corrected，不自行另判错误 → 两层纠错同源。
 *
 * 注意：这里**不做静默兜底**。模型失败时向上抛出带可执行提示的错误，
 * 由 API 层转成给用户看的信息——假回复会掩盖配置问题，比报错更糟。
 */
export async function runNpcEngine(input: NpcPromptInput): Promise<string> {
  return await chatText(npcSystemFilled(input), npcUserPrompt(input), { maxTokens: 400 })
}
