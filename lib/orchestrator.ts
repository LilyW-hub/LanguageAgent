import { runNpcEngine } from "./agents/npcEngine"
import { runProfileExtractor } from "./agents/profileExtractor"
import { runTutor } from "./agents/tutor"
import { buildMemorySummary } from "./agents/memory"
import { getNpc } from "./npcs"
import {
  addArchive,
  addCorrection,
  addTrace,
  applyProfileDelta,
  currentTurn,
  getHistory,
  getProfile,
  nextTurn,
  pushTurn,
} from "./store"
import type { ArchiveCard, ChatResponse, TraceStep } from "./types"

const CITY_LABEL: Record<string, string> = { London: "伦敦" }

/**
 * Orchestrator：确定性管线（对应技术文档 §2）。
 * 顺序固定为 memory → tutor → npc → profile，保证两层纠错同源。
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
  const [correction, profileDelta] = await Promise.all([
    runTutor({ userMessage: input.message, level: profile.level }),
    runProfileExtractor({ userMessage: input.message, turn }),
  ])

  trace.push({
    turn,
    agent: "tutor",
    action:
      correction.errorType === "none"
        ? "未检测到明显错误"
        : `检测到 ${correction.errorType} → corrected "${correction.corrected}"`,
    detail: correction.explanation || undefined,
  })

  // 3) NPC Engine：引用 corrected 生成回复
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

export { currentTurn }
