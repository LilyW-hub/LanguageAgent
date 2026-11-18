import { runMergedStream } from "./agents/mergedStream"
import { runProfileExtractor } from "./agents/profileExtractor"
import { sameExceptPunctuation, toCorrection } from "./agents/tutor"
import { buildMemorySummary } from "./agents/memory"
import { extractJson } from "./llm"
import { fallbackReply, findScriptedTurn } from "./demoScript"
import { getNpc } from "./npcs"
import { executeTool, sanitizeToolCalls, type ToolCall, type ToolResult } from "./tools"
import {
  addCorrection,
  addTrace,
  addXp,
  advanceQuest,
  applyProfileDelta,
  getHistory,
  getProfile,
  getQuestStep,
  getReplayMode,
  getXp,
  dueReviews,
  rescheduleDueReviews,
  isQuestRewarded,
  markQuestRewarded,
  nextTurn,
  pushTurn,
} from "./store"
import type {
  ArchiveCard,
  ChatResponse,
  Correction,
  Profile,
  ProfileDelta,
  QuestPlan,
  RewardSummary,
  TraceStep,
} from "./types"

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

interface MetaBundle {
  correction: Correction
  focus: { word: string; note: string } | null
  planStep: string | null
  planReason: string | null
  tools: ToolCall[]
}

/** 解析合并调用的 META：纠错 + 复习焦点 + 任务计划 + 工具申请 */
function parseMeta(raw: string, userMessage: string): MetaBundle {
  if (process.env.DEBUG_META === "1") {
    console.log("[meta raw]", JSON.stringify(raw.slice(0, 600)))
  }

  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== "object") {
    return { correction: NO_CORRECTION(userMessage), focus: null, planStep: null, planReason: null, tools: [] }
  }

  const record = parsed as Record<string, unknown>
  const correction = toCorrection(record, userMessage)

  const rawFocus = record.focus
  const focus =
    typeof rawFocus === "object" && rawFocus !== null
      ? (() => {
          const word = (rawFocus as Record<string, unknown>).word
          if (typeof word !== "string" || word.trim().length === 0) return null
          const note = (rawFocus as Record<string, unknown>).note
          return { word: word.trim(), note: typeof note === "string" ? note.trim() : "" }
        })()
      : null

  const rawPlan = record.plan
  let planStep: string | null = null
  let planReason: string | null = null
  if (typeof rawPlan === "object" && rawPlan !== null) {
    const step = (rawPlan as Record<string, unknown>).step
    if (typeof step === "string" && step.trim().length > 0) planStep = step.trim()
    const reason = (rawPlan as Record<string, unknown>).reason
    if (typeof reason === "string" && reason.trim().length > 0) planReason = reason.trim()
  }

  // 只差标点/大小写 → 不算错误
  const finalCorrection = sameExceptPunctuation(correction.corrected, userMessage)
    ? NO_CORRECTION(userMessage)
    : correction.errorType === "none"
      ? { ...correction, errorType: "grammar" as const, addToReview: true }
      : correction

  return {
    correction: sameExceptPunctuation(correction.corrected, userMessage) ? NO_CORRECTION(userMessage) : finalCorrection,
    focus,
    planStep,
    planReason,
    tools: sanitizeToolCalls(record.tools),
  }
}

/** 把模型给的计划步骤映射成本地任务进度；非法步骤不前进 */
function resolvePlan(
  npc: ReturnType<typeof getNpc>,
  stepId: string | null,
  reason: string | null,
): { plan: QuestPlan; advanced: boolean } {
  const steps = npc.quest.steps
  const currentIndex = getQuestStep(npc.id)

  let targetIndex = currentIndex
  const found = stepId ? steps.findIndex((step) => step.id === stepId) : -1
  // 每轮最多前进一步：避免模型一次性跳到收尾
  if (found >= 0) targetIndex = Math.min(found, currentIndex + 1)

  const advanced = targetIndex > currentIndex
  const index = advanceQuest(npc.id, targetIndex)
  const step = steps[Math.min(index, steps.length - 1)]!

  return {
    plan: { stepId: step.id, stepLabel: step.label, index, total: steps.length },
    advanced: advanced || Boolean(reason),
  }
}

/**
 * Orchestrator：memory → (profile 并行) → 合并调用（回复 + 纠错 + 计划 + 工具申请）
 *               → 执行工具 → 收尾。
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

  const memory = buildMemorySummary(profile, npc)
  yield { event: "stage", data: { stage: "memory" } }

  const extractorPromise = replay
    ? Promise.resolve({ delta: null as ProfileDelta | null, error: null as string | null })
    : runProfileExtractor({ userMessage: input.message, turn })

  yield { event: "stage", data: { stage: "tutor" } }

  let reply = ""
  let meta: MetaBundle = {
    correction: NO_CORRECTION(input.message),
    focus: null,
    planStep: null,
    planReason: null,
    tools: [],
  }

  if (replay) {
    const scripted = findScriptedTurn(npc.id, input.message)
    reply = scripted?.reply ?? fallbackReply(npc.id)
    meta.correction = scripted?.correction ?? NO_CORRECTION(input.message)
    // 回放模式按轮次推进任务步骤
    const steps = npc.quest.steps
    meta.planStep = steps[Math.min(turn - 1, steps.length - 1)]!.id
    yield { event: "stage", data: { stage: "npc" } }
    yield { event: "delta", data: { text: reply } }
  } else {
    let metaRaw = ""
    let npcStageSent = false

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

    if (reply.trim().length === 0) throw new Error("模型返回了空内容")
    meta = parseMeta(metaRaw, input.message)
  }

  const correction = meta.correction

  // ── 任务计划 ──
  const { plan, advanced } = resolvePlan(npc, meta.planStep, meta.planReason)

  // ── 工具：模型申请 + 学习闭环兜底 ──
  const calls: ToolCall[] = [...meta.tools]

  // 档案产自「任务推进」，而不是「说错了」：
  // 步骤推进时以步骤为准，模型同轮的散装档案申请让位，保证每轮最多一张
  if (advanced) {
    const existing = calls.findIndex((call) => call.name === "create_archive")
    if (existing >= 0) calls.splice(existing, 1)
    calls.push({
      name: "create_archive",
      args: {
        title: `${npc.city === "London" ? "伦敦" : npc.city}·${npc.sceneLabel}·${plan.stepLabel}`,
        category: "Life",
        summary: `完成「${plan.stepLabel}」这一步的交流`,
      },
    })
  }

  if (correction.errorType !== "none") {
    if (!calls.some((call) => call.name === "schedule_review")) {
      calls.push({
        name: "schedule_review",
        args: {
          item: meta.focus?.word ?? correction.corrected,
          dueInDays: 1,
          note: correction.explanation || meta.focus?.note || "",
        },
      })
    }

  }

  const results: ToolResult[] = []
  for (const call of calls) {
    results.push(await executeTool(call, { npc, correction, turn }))
  }

  const archiveCard =
    (results.find((item) => item.name === "create_archive" && item.ok)?.data as ArchiveCard | undefined) ??
    null

  // ── 画像 ──
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

  // ── 奖励：真实发放，UI 显示的是这里算出来的数 ──
  const rewardItems: string[] = []
  let xpGained = 0

  // 开口就给分：奖励「说」这个行为本身，而不是「说错」
  xpGained += 5
  rewardItems.push("开口 +5")

  // 巩固：有到期复习项、且本轮没在该点上出错 → 说明用对了
  const due = dueReviews()
  if (due.length > 0 && correction.errorType === "none") {
    const count = rescheduleDueReviews()
    xpGained += 15
    rewardItems.push(`巩固 ${count} 个复习点 +15`)
  }
  if (plan.index >= plan.total - 1 && !isQuestRewarded(npc.id)) {
    xpGained += 25
    rewardItems.push(`任务完成 +25`)
    markQuestRewarded(npc.id)
  }

  const xpTotal = xpGained > 0 ? addXp(xpGained) : getXp()

  const rewards: RewardSummary = {
    total: xpTotal,
    gained: xpGained,
    level: Math.floor(xpTotal / 100) + 1,
    items: rewardItems,
  }

  // ── Trace ──
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
      agent: "plan",
      action: `任务推进到 ${plan.index + 1}/${plan.total} · ${plan.stepLabel}${advanced ? "（前进）" : ""}`,
      detail: meta.planReason ?? undefined,
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
    ...(xpGained > 0
      ? [
          {
            turn,
            agent: "reward" as const,
            action: `发放奖励：${rewardItems.join(" / ")} → 累计 ${xpTotal} XP`,
            detail: `等级 ${rewards.level}`,
          },
        ]
      : []),
    ...results.map<TraceStep>((result) => ({
      turn,
      agent: "tool",
      action: `🔧 ${result.name}(${JSON.stringify(result.args)})`,
      detail: result.summary,
    })),
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

  // ── 落库 ──
  pushTurn(npc.id, { role: "user", content: input.message })
  pushTurn(npc.id, { role: "npc", content: reply })
  if (correction.errorType !== "none") addCorrection(correction)
  addTrace(trace)

  yield {
    event: "done",
    data: {
      reply,
      plan,
      rewards,
      learningObjective: npc.learningObjective,
      correction: correction.errorType === "none" ? null : correction,
      profileDelta,
      archiveCard,
      trace,
      profile: profile as Profile,
    },
  }
}

/** 非流式封装：消费生成器，只取最终结果 */
export async function handleChat(input: { message: string; npcId: string }): Promise<ChatResponse> {
  let result: ChatResponse | undefined
  for await (const event of handleChatStream(input)) {
    if (event.event === "done") result = event.data
  }
  if (!result) throw new Error("管线未产出结果")
  return result
}
