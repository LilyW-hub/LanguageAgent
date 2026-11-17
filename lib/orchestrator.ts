import { runMergedStream } from "./agents/mergedStream"
import { runProfileExtractor } from "./agents/profileExtractor"
import { sameExceptPunctuation, toCorrection } from "./agents/tutor"
import { buildMemorySummary } from "./agents/memory"
import { extractJson } from "./llm"
import { fallbackReply, findScriptedTurn } from "./demoScript"
import { getNpc } from "./npcs"
import {
  addArchive,
  addCorrection,
  addTrace,
  applyProfileDelta,
  getHistory,
  getProfile,
  getReplayMode,
  nextTurn,
  pushTurn,
} from "./store"
import type { ArchiveCard, ChatResponse, Correction, Profile, ProfileDelta, TraceStep } from "./types"

const CITY_LABEL: Record<string, string> = { London: "伦敦" }

export type ChatStage = "memory" | "tutor" | "npc"

export type ChatStreamEvent =
  | { event: "stage"; data: { stage: ChatStage } }
  | { event: "delta"; data: { text: string } }
  | { event: "done"; data: ChatResponse }

const NO_CORRECTION = (text: string): Correction => ({
  original: text,
  corrected: text,
  errorType: "none",
  explanation: "",
  natural: text,
  addToReview: false,
})

/** 解析合并调用尾部的 META JSON；任何异常都降级为「无错误」，不弹课后卡 */
function parseMeta(raw: string, userMessage: string): Correction {
  if (process.env.DEBUG_META === "1") {
    console.log("[meta raw]", JSON.stringify(raw.slice(0, 500)))
  }

  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== "object") return NO_CORRECTION(userMessage)

  const correction = toCorrection(parsed as Record<string, unknown>, userMessage)

  // 只差标点/大小写 → 不算错误
  if (sameExceptPunctuation(correction.corrected, userMessage)) return NO_CORRECTION(userMessage)

  // 模型说没错误，但用词确实不同 → 以「有错误」为准
  if (correction.errorType === "none") {
    return { ...correction, errorType: "grammar", addToReview: true }
  }

  return correction
}

/**
 * Orchestrator：memory → (profile 并行) → 合并调用流式产出回复 + 纠错 → 收尾。
 *
 * 相比早期版本的关键变化：tutor 与 npc **合并为一次模型往返**，
 * 延迟约减半，且纠错与回复同源（同一段输出里拆出来的）。
 *
 * 错误策略：
 * - Profile 提取失败：非致命，Trace 告警。
 * - NPC 生成失败：致命，抛出可执行提示的错误。
 */
export async function* handleChatStream(input: {
  message: string
  npcId: string
}): AsyncGenerator<ChatStreamEvent> {
  const profile = getProfile()
  if (!profile) throw new Error("PROFILE_MISSING")

  const npc = getNpc(input.npcId)
  const replay = getReplayMode()
  const turn = nextTurn()

  // 1) Memory：读画像 + 冷启动摘要
  const memory = buildMemorySummary(profile, npc)
  yield { event: "stage", data: { stage: "memory" } }

  // 2) 画像提取与回复并行（不阻塞首字）
  const extractorPromise = replay
    ? Promise.resolve({ delta: null as ProfileDelta | null, error: null as string | null })
    : runProfileExtractor({ userMessage: input.message, turn })

  // 3) 回复 + 纠错
  yield { event: "stage", data: { stage: "tutor" } }

  let reply = ""
  let correction: Correction
  let npcStageSent = false

  if (replay) {
    const scripted = findScriptedTurn(npc.id, input.message)
    reply = scripted?.reply ?? fallbackReply(npc.id)
    correction = scripted?.correction ?? NO_CORRECTION(input.message)
    yield { event: "stage", data: { stage: "npc" } }
    npcStageSent = true
    yield { event: "delta", data: { text: reply } }
  } else {
    let metaRaw = ""

    for await (const item of runMergedStream({
      npc,
      profile,
      memorySummary: memory.summary,
      history: getHistory(npc.id),
      userMessage: input.message,
      correction: null,
    })) {
      if (item.type === "delta") {
        if (!npcStageSent) {
          npcStageSent = true
          yield { event: "stage", data: { stage: "npc" } }
        }
        reply += item.text
        yield { event: "delta", data: { text: item.text } }
      } else {
        metaRaw = item.raw
      }
    }

    if (reply.trim().length === 0) {
      throw new Error("模型返回了空内容")
    }

    correction = parseMeta(metaRaw, input.message)
  }

  // 4) 收集画像结果
  const extractorResult = await extractorPromise
  const profileDelta = replay
    ? (() => {
        const scripted = findScriptedTurn(npc.id, input.message)
        if (!scripted?.inferred && !scripted?.weaknesses) return null
        return {
          ...(scripted.inferred
            ? { inferred: scripted.inferred.map((item) => ({ ...item, sourceTurn: turn })) }
            : {}),
          ...(scripted.weaknesses ? { weaknesses: scripted.weaknesses } : {}),
        }
      })()
    : extractorResult.delta

  applyProfileDelta(profileDelta)

  // 5) Trace
  const inferredCount = profileDelta?.inferred?.length ?? 0
  const weaknessCount = profileDelta?.weaknesses?.length ?? 0

  const trace: TraceStep[] = [
    {
      turn,
      agent: "memory",
      action: `读取画像 → ${memory.focus.join(" / ")}`,
      detail: memory.summary,
    },
    {
      turn,
      agent: "tutor",
      action:
        correction.errorType === "none"
          ? "未检测到明显错误"
          : `检测到 ${correction.errorType} → corrected "${correction.corrected}"`,
      detail: correction.explanation || undefined,
    },
    {
      turn,
      agent: "npc",
      action:
        correction.errorType === "none"
          ? `${npc.name} 生成回复`
          : `${npc.name} 用 corrected 生成回复（diegetic 纠错）`,
    },
    {
      turn,
      agent: "profile",
      action: extractorResult.error
        ? `⚠️ 画像提取不可用：${extractorResult.error}`
        : inferredCount + weaknessCount === 0
          ? "无新的画像信号"
          : [
              inferredCount > 0
                ? `推测 ${profileDelta?.inferred?.map((item) => `${item.fact} (${item.confidence.toFixed(1)})`).join(", ")}`
                : "",
              weaknessCount > 0 ? `记录薄弱点 ${profileDelta?.weaknesses?.join(", ")}` : "",
            ]
              .filter(Boolean)
              .join(" / "),
    },
  ]

  // 6) 档案卡：学习 → 档案
  let archiveCard: ArchiveCard | null = null
  if (correction.errorType !== "none") {
    archiveCard = {
      title: `${CITY_LABEL[npc.city] ?? npc.city}·${npc.sceneLabel}日常用语`,
      city: npc.city,
      category: "Life",
      summary: `${npc.learningObjective} · ${correction.errorType}: ${correction.explanation || correction.corrected}`,
    }
    addArchive(archiveCard)
  }

  // 7) 落库
  pushTurn(npc.id, { role: "user", content: input.message })
  pushTurn(npc.id, { role: "npc", content: reply })
  if (correction.errorType !== "none") addCorrection(correction)
  addTrace(trace)

  yield {
    event: "done",
    data: {
      reply,
      learningObjective: npc.learningObjective,
      correction: correction.errorType === "none" ? null : correction,
      profileDelta,
      archiveCard,
      trace,
      profile: profile as Profile,
    },
  }
}

/** 非流式封装：消费生成器，只取最终结果（供脚本与 curl 调试使用） */
export async function handleChat(input: { message: string; npcId: string }): Promise<ChatResponse> {
  let result: ChatResponse | undefined
  for await (const event of handleChatStream(input)) {
    if (event.event === "done") result = event.data
  }
  if (!result) throw new Error("管线未产出结果")
  return result
}
