import { chatTextStream } from "../llm"
import { META_DELIMITER, mergedSystemFilled, npcUserPrompt, type NpcPromptInput } from "../prompts"

export type MergedStreamEvent =
  | { type: "delta"; text: string }
  | { type: "meta"; raw: string }

/**
 * 合并版 NPC Engine：一次调用同时产出「可见回复」和「结构化纠错」。
 *
 * 输出协议：`<回复正文> ===META=== <JSON>`
 * - 正文边生成边以 delta 吐出（用户立刻看到字）
 * - META 段单独累积，结束时交给调用方解析
 *
 * 这样把两次串行模型往返压成一次，延迟约减半；
 * 而且纠错与回复出自同一段输出，不会出现「NPC 纠一个错、课后卡纠另一个错」。
 */
export async function* runMergedStream(input: NpcPromptInput): AsyncGenerator<MergedStreamEvent> {
  // 把格式契约放在用户消息末尾：离生成最近，模型漏掉的概率最低
  const userPrompt = `${npcUserPrompt(input)}

【输出格式（务必遵守，不得省略）】
第一段：你的角色回复（纯文本，2 句以内，以简短提问结尾）。
第二段：单独一行 ${META_DELIMITER}
第三段：一个 JSON 对象，必须包含这八个字段：corrected / errorType / explanation / natural / addToReview / focus / plan / tools。
即使没有任何错误，也必须输出 META 段（errorType 填 "none"，focus 填 null，tools 可为空数组）。
`

  const stream = chatTextStream(mergedSystemFilled(input), userPrompt, {
    maxTokens: 700,
    temperature: 0.6,
  })

  let pending = ""
  let metaRaw = ""
  let inMeta = false
  const holdBack = META_DELIMITER.length - 1

  for await (const chunk of stream) {
    if (inMeta) {
      metaRaw += chunk
      continue
    }

    pending += chunk
    const index = pending.indexOf(META_DELIMITER)

    if (index !== -1) {
      const visible = pending.slice(0, index)
      if (visible.trim().length > 0) yield { type: "delta", text: visible }
      metaRaw = pending.slice(index + META_DELIMITER.length)
      pending = ""
      inMeta = true
      continue
    }

    // 保留可能构成分隔符的尾巴，避免把 "===MET" 这类半截内容显示给用户
    if (pending.length > holdBack) {
      const emit = pending.slice(0, pending.length - holdBack)
      if (emit.length > 0) {
        yield { type: "delta", text: emit }
        pending = pending.slice(pending.length - holdBack)
      }
    }
  }

  if (!inMeta && pending.length > 0) {
    yield { type: "delta", text: pending }
  }

  yield { type: "meta", raw: metaRaw }
}
