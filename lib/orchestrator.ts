import { runNpcEngine } from "./agents/npcEngine"
import { runProfileExtractor } from "./agents/profileExtractor"
import { runTutor } from "./agents/tutor"
import { buildMemorySummary } from "./agents/memory"
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
import type { ArchiveCard, ChatResponse, Correction, TraceStep } from "./types"

const CITY_LABEL: Record<string, string> = { London: "伦敦" }

/**
 * Orchestrator：确定性管线（对应技术文档 §2）。
 * 顺序固定为 memory → tutor → npc → profile，保证两层纠错同源。
 *
 * 错误策略：
 * - Tutor / Profile 失败：非致命，对话继续，但 Trace 里显式告警。
 * - NPC 生成失败：致命，抛出带可执行提示的错误（假回复会掩盖配置问题）。
 */
export async function handleChat(input: {
  message: string
  npcId: string
}): Promise<ChatResponse> {
  const profile = getProfile()
  if (!profile) {
    throw new Error("PROFILE_MISSING")
  }

  const npc = getNpc(input.npcId)

  // 回放模式：不调用模型，按剧本返回（现场兜底）
  if (getReplayMode()) {
    return handleReplayChat({ message: input.message, npcId: input.npcId, profile })
  }

  const turn = nextTurn()
  const trace: TraceStep[] = []

  // 1) Memory：读画像 + 冷启动摘要
  const memory = buildMemorySummary(profile, npc)
  trace.push({
    turn,
    agent: "memory",
    action: `读取画像 → ${memory.focus.join(" / ")}`,
    detail: memory.summary,
  })

  // 2) Tutor + Profile Extractor 并行（互不依赖）
  const [tutorResult, extractorResult] = await Promise.all([
    runTutor({ userMessage: input.message, level: profile.level }),
    runProfileExtractor({ userMessage: input.message, turn }),
  ])

  const correction = tutorResult.correction
  const profileDelta = extractorResult.delta

  trace.push({
    turn,
    agent: "tutor",
    action: tutorResult.error
      ? `⚠️ 纠错不可用：${tutorResult.error}`
      : correction.errorType === "none"
        ? "未检测到明显错误"
        : `检测到 ${correction.errorType} → corrected "${correction.corrected}"`,
    detail: correction.explanation || undefined,
  })

  // 3) NPC Engine：引用 corrected 生成回复（失败直接抛出，不做假回复）
  const reply = await runNpcEngine({
    npc,
    profile,
    memorySummary: memory.summary,
    history: getHistory(npc.id),
    userMessage: input.message,
    correction,
  })

  trace.push({
    turn,
    agent: "npc",
    action:
      correction.errorType === "none"
        ? `${npc.name} 生成回复`
        : `${npc.name} 用 corrected 生成回复（diegetic 纠错）`,
  })

  // 4) Profile：合并画像增量
  applyProfileDelta(profileDelta)

  const inferredCount = profileDelta?.inferred?.length ?? 0
  const weaknessCount = profileDelta?.weaknesses?.length ?? 0

  trace.push({
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
  })

  // 5) 档案卡：只有产生纠错时才产出一张（学习 → 档案）
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

  // 6) 落库：历史、纠错、Trace
  pushTurn(npc.id, { role: "user", content: input.message })
  pushTurn(npc.id, { role: "npc", content: reply })
  if (correction.errorType !== "none") addCorrection(correction)
  addTrace(trace)

  return {
    reply,
    learningObjective: npc.learningObjective,
    correction: correction.errorType === "none" ? null : correction,
    profileDelta,
    archiveCard,
    trace,
    profile,
  }
}

/**
 * 回放模式：走 lib/demoScript.ts 的剧本。
 * 输出结构与真实链路一致（reply / correction / profileDelta / archiveCard / trace），
 * 前端无需任何改动，切回来就是实时模型。
 */
function handleReplayChat(input: {
  message: string
  npcId: string
  profile: NonNullable<ReturnType<typeof getProfile>>
}): ChatResponse {
  const npc = getNpc(input.npcId)
  const turn = nextTurn()
  const trace: TraceStep[] = []
  const scripted = findScriptedTurn(npc.id, input.message)

  const memory = buildMemorySummary(input.profile, npc)
  trace.push({
    turn,
    agent: "memory",
    action: `读取画像 → ${memory.focus.join(" / ")}`,
    detail: `${memory.summary}（回放模式）`,
  })

  const correction: Correction = scripted?.correction ?? {
    original: input.message,
    corrected: input.message,
    errorType: "none",
    explanation: "",
    natural: input.message,
    addToReview: false,
  }

  trace.push({
    turn,
    agent: "tutor",
    action:
      correction.errorType === "none"
        ? "未检测到明显错误"
        : `检测到 ${correction.errorType} → corrected "${correction.corrected}"`,
    detail: correction.explanation || undefined,
  })

  const reply = scripted?.reply ?? fallbackReply(npc.id)

  trace.push({
    turn,
    agent: "npc",
    action:
      correction.errorType === "none"
        ? `${npc.name} 生成回复`
        : `${npc.name} 用 corrected 生成回复（diegetic 纠错）`,
  })

  const profileDelta =
    scripted?.inferred || scripted?.weaknesses
      ? {
          ...(scripted.inferred
            ? { inferred: scripted.inferred.map((item) => ({ ...item, sourceTurn: turn })) }
            : {}),
          ...(scripted.weaknesses ? { weaknesses: scripted.weaknesses } : {}),
        }
      : null

  applyProfileDelta(profileDelta)

  const inferredCount = profileDelta?.inferred?.length ?? 0
  const weaknessCount = profileDelta?.weaknesses?.length ?? 0

  trace.push({
    turn,
    agent: "profile",
    action:
      inferredCount + weaknessCount === 0
        ? "无新的画像信号"
        : [
            inferredCount > 0
              ? `推测 ${profileDelta?.inferred?.map((item) => `${item.fact} (${item.confidence.toFixed(1)})`).join(", ")}`
              : "",
            weaknessCount > 0 ? `记录薄弱点 ${profileDelta?.weaknesses?.join(", ")}` : "",
          ]
            .filter(Boolean)
            .join(" / "),
  })

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

  pushTurn(npc.id, { role: "user", content: input.message })
  pushTurn(npc.id, { role: "npc", content: reply })
  if (correction.errorType !== "none") addCorrection(correction)
  addTrace(trace)

  return {
    reply,
    learningObjective: npc.learningObjective,
    correction: correction.errorType === "none" ? null : correction,
    profileDelta,
    archiveCard,
    trace,
    profile: input.profile,
  }
}
