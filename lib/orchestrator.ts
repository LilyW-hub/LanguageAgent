import { archiveContext } from "./archiveLearning"
import { getGrowth } from "./growth"
import { runMergedStream } from "./agents/mergedStream"
import { runProfileExtractor } from "./agents/profileExtractor"
import { sameExceptPunctuation, toCorrection } from "./agents/tutor"
import { buildMemorySummary } from "./agents/memory"
import { extractJson } from "./llm"
import { getNpc } from "./npcRegistry"
import { executeTool, sanitizeToolCalls, type ToolCall, type ToolResult } from "./tools"
import { planProbe, weaknessOverview } from "./review"
import {
  addCorrection,
  addTrace,
  addXp,
  advanceQuest,
  applyProfileDelta,
  getHistory,
  getProfile,
  getQuestStep,
  getXp,
  recordProbe,
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
  severity: "none",
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
  probe: { target: string | null; slot: string | null; triggered: boolean; usedCorrectly: boolean } | null
}

/** 解析合并调用的 META：纠错 + 复习焦点 + 任务计划 + 工具申请 */
function parseMeta(raw: string, userMessage: string): MetaBundle {
  if (process.env.DEBUG_META === "1") {
    console.log("[meta raw]", JSON.stringify(raw.slice(0, 600)))
  }

  const parsed = extractJson(raw)
  if (!parsed || typeof parsed !== "object") {
    return {
      correction: NO_CORRECTION(userMessage),
      focus: null,
      planStep: null,
      planReason: null,
      tools: [],
      probe: null,
    }
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

  const rawProbe = record.probe
  const probe =
    typeof rawProbe === "object" && rawProbe !== null
      ? {
          target:
            typeof (rawProbe as Record<string, unknown>).target === "string"
              ? String((rawProbe as Record<string, unknown>).target)
              : null,
          slot:
            typeof (rawProbe as Record<string, unknown>).slot === "string"
              ? String((rawProbe as Record<string, unknown>).slot)
              : null,
          triggered: (rawProbe as Record<string, unknown>).triggered === true,
          usedCorrectly: (rawProbe as Record<string, unknown>).usedCorrectly === true,
        }
      : null

  return {
    correction: sameExceptPunctuation(correction.corrected, userMessage) ? NO_CORRECTION(userMessage) : finalCorrection,
    focus,
    planStep,
    planReason,
    tools: sanitizeToolCalls(record.tools),
    probe,
  }
}

/** 判断这句话是否构成「完成这一步」的证据 */
function stepEvidence(step: { cues?: string[]; minWords?: number }, message: string): boolean {
  const text = message.toLowerCase()
  if (step.minWords && text.split(/\s+/).filter(Boolean).length >= step.minWords) return true
  if (!step.cues || step.cues.length === 0) return true
  return step.cues.some((cue) => text.includes(cue))
}

/**
 * 把模型给的计划步骤映射成本地任务进度。
 *
 * 两条约束（防止「聊几句任务就自动走完」）：
 * 1. 每轮最多前进一步
 * 2. 下一步必须被**用户这句话的内容**证明——命中该步的 cues，或达到 minWords。
 *    证据不足就停在原地，并把原因写进 trace。
 */
function resolvePlan(
  npc: ReturnType<typeof getNpc>,
  stepId: string | null,
  reason: string | null,
  message: string,
): { plan: QuestPlan; advanced: boolean; blockedBy: string | null } {
  const steps = npc.quest.steps
  const currentIndex = getQuestStep(npc.id)

  const found = stepId ? steps.findIndex((step) => step.id === stepId) : -1
  let targetIndex = currentIndex
  let blockedBy: string | null = null

  if (found > currentIndex) {
    const next = steps[currentIndex + 1]
    if (next && stepEvidence(next, message)) {
      targetIndex = Math.min(found, currentIndex + 1)
    } else if (next) {
      blockedBy = next.label
    }
  }

  const advanced = targetIndex > currentIndex
  const index = advanceQuest(npc.id, targetIndex)
  const step = steps[Math.min(index, steps.length - 1)]!

  return {
    plan: { stepId: step.id, stepLabel: step.label, index, total: steps.length },
    advanced,
    blockedBy: blockedBy ?? reason === null ? null : blockedBy,
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
  const turn = nextTurn()

  const memory = buildMemorySummary(profile, npc)
  yield { event: "stage", data: { stage: "memory" } }

  const extractorPromise = runProfileExtractor({ userMessage: input.message, turn })
  const probePlan = planProbe(npc, turn)

  yield { event: "stage", data: { stage: "tutor" } }

  let reply = ""
  let meta: MetaBundle = {
    correction: NO_CORRECTION(input.message),
    focus: null,
    planStep: null,
    planReason: null,
    tools: [],
    probe: null,
  }

  {
    let metaRaw = ""
    let npcStageSent = false

    for await (const item of runMergedStream({
      npc,
      profile,
      memorySummary: memory.summary,
      archiveContext: archiveContext(npc, input.message, turn),
      history: getHistory(npc.id),
      userMessage: input.message,
      correction: null,
      probe: probePlan,
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
  const { plan, advanced, blockedBy } = resolvePlan(npc, meta.planStep, meta.planReason, input.message)

  // ── 工具：模型申请 + 学习闭环兜底 ──
  const calls: ToolCall[] = [...meta.tools]

  // 任务推进仅写入成长记录；档案保留模型提炼的实际知识。
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
  const profileDelta = extractorResult.delta

  applyProfileDelta(profileDelta)

  // ── 奖励：真实发放，UI 显示的是这里算出来的数 ──
  const rewardItems: string[] = []
  let xpGained = 0

  // 开口就给分：奖励「说」这个行为本身，而不是「说错」
  xpGained += 5
  rewardItems.push("开口 +5")

  // 回收薄弱点：真的引出、且这次用对了，才发奖励
  let probeOutcome: "hit" | "miss" | null = null
  let probeResolved: string | null = null

  if (probePlan && meta.probe?.triggered) {
    probeOutcome = meta.probe.usedCorrectly ? "hit" : "miss"
    recordProbe({
      target: probePlan.target,
      slot: probePlan.slotId,
      turn,
      outcome: probeOutcome,
    })

    if (probeOutcome === "hit") {
      xpGained += 15
      probeResolved = probePlan.target
      rewardItems.push(`回收「${probePlan.target}」+15`)
    }
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
    probeResolved,
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
      action: advanced
        ? `任务推进到 ${plan.index + 1}/${plan.total} · ${plan.stepLabel}（前进）`
        : blockedBy
          ? `停在 ${plan.index + 1}/${plan.total} · ${plan.stepLabel}（完成「${blockedBy}」的证据不足）`
          : `停在 ${plan.index + 1}/${plan.total} · ${plan.stepLabel}`,
      detail: meta.planReason ?? undefined,
    },
    ...(probePlan
      ? [
          {
            turn,
            agent: "probe" as const,
            action:
              probeOutcome === "hit"
                ? `回收「${probePlan.target}」成功（角度 ${probePlan.slotId}）`
                : probeOutcome === "miss"
                  ? `回收「${probePlan.target}」未成（角度 ${probePlan.slotId}）`
                  : `本轮计划回收「${probePlan.target}」，模型未引出`,
            detail: probePlan.slotIntent,
          },
        ]
      : []),
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
      growth: getGrowth(),
      plan,
      rewards,
      learningObjective: npc.learningObjective,
      correction: correction.errorType === "none" ? null : correction,
      profileDelta,
      archiveCard,
      trace,
      profile: profile as Profile,
      weaknesses: weaknessOverview(),
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
