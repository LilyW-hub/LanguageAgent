import { isTaskCompletionArchive } from "./archiveContent"
import { randomUUID } from "node:crypto"
import { lookupWord } from "./dictionary"
import { addArchive, addReview, countArchives, countReviews } from "./store"
import type { ArchiveCard, Correction, Npc } from "./types"

/**
 * 工具层：Agent 能真正执行的动作。
 *
 * 设计取舍：
 * - 工具由模型在 META 里"申请"（plan.tools），Orchestrator 按**白名单**校验后执行，
 *   而不是让模型自由调用任意函数——越权风险可控，且结果可复现。
 * - 学习闭环的两个关键动作（记录复习项、落档案）有确定性兜底：
 *   即使模型漏了，Orchestrator 也会补上，避免学习数据丢失。
 */

export interface ToolCall {
  name: string
  args: Record<string, unknown>
}

export interface ToolResult {
  name: string
  args: Record<string, unknown>
  ok: boolean
  /** 一句话结果，显示在 Trace 上 */
  summary: string
  /** 结构化返回，供 UI 使用 */
  data?: unknown
}

export const TOOL_NAMES = ["lookup_vocabulary", "schedule_review", "create_archive"] as const
export type ToolName = (typeof TOOL_NAMES)[number]

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
}

/** 校验并规整模型申请的工具调用；未知工具直接丢弃 */
export function sanitizeToolCalls(raw: unknown): ToolCall[] {
  if (!Array.isArray(raw)) return []
  const calls: ToolCall[] = []

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue
    const record = item as Record<string, unknown>
    const name = asString(record.name)
    if (!TOOL_NAMES.includes(name as ToolName)) continue

    const args =
      typeof record.args === "object" && record.args !== null
        ? (record.args as Record<string, unknown>)
        : {}

    calls.push({ name, args })
  }

  return calls.slice(0, 3)
}

/** 执行单个工具，任何异常都降级为 ok:false，不影响主流程 */
export async function executeTool(
  call: ToolCall,
  context: { npc: Npc; correction: Correction; turn: number },
): Promise<ToolResult> {
  const { npc, correction, turn } = context

  try {
    if (call.name === "lookup_vocabulary") {
      const word = asString(call.args.word, correction.corrected.split(" ")[0] ?? "")
      const result = lookupWord(word)

      if (!result.found || !result.entry) {
        return {
          name: call.name,
          args: { word },
          ok: false,
          summary: `词典未收录「${word}」${result.suggestions ? `，相近词：${result.suggestions.join(" / ")}` : ""}`,
        }
      }

      const entry = result.entry
      return {
        name: call.name,
        args: { word },
        ok: true,
        summary: `${entry.word} ${entry.pos} ${entry.meaning}`,
        data: entry,
      }
    }

    if (call.name === "schedule_review") {
      const item = asString(call.args.item, correction.corrected.slice(0, 40))
      const days = Number(call.args.dueInDays ?? 1)
      const dueAt = new Date(Date.now() + (Number.isFinite(days) ? days : 1) * 86400000)

      addReview({
        item,
        note: asString(call.args.note, correction.explanation.slice(0, 60)),
        errorType: correction.errorType,
        dueAt: dueAt.toISOString(),
        npcId: npc.id,
        turn,
      })

      return {
        name: call.name,
        args: { item, dueInDays: days },
        ok: true,
        summary: `复习队列 +1（${item}，${days} 天后），共 ${countReviews()} 条`,
      }
    }

    // create_archive
    const cityLabel = npc.city === "London" ? "伦敦" : npc.city
    const rawTitle = asString(call.args.title, `${cityLabel}·${npc.sceneLabel}日常用语`)
    const card: ArchiveCard = {
      id: randomUUID(),
      npcId: npc.id,
      // 模型可能用英文城市名，统一成中文展示
      title: (() => {
        const localized = rawTitle
          .replace(/^London/, "伦敦")
          .replace(/^New York/, "纽约")
          .replace(/^Tokyo/, "东京")
        // 模型偶尔给英文泛标题：补上城市与场景前缀，保持档案的可读性
        if (!localized.includes("·") && !/[\u4e00-\u9fa5]/.test(localized)) {
          return `${cityLabel}·${npc.sceneLabel}·${localized}`
        }
        return localized
      })(),
      city: cityLabel,
      category: (["Language", "Culture", "Life", "People"] as const).includes(
        call.args.category as ArchiveCard["category"],
      )
        ? (call.args.category as ArchiveCard["category"])
        : "Life",
      summary: asString(
        call.args.summary,
        `${npc.learningObjective} · ${correction.errorType}: ${correction.explanation || correction.corrected}`,
      ),
    }

    if (isTaskCompletionArchive(card)) {
      return { name: call.name, args: call.args, ok: false, summary: "任务完成情况已归入成长，不创建知识档案" }
    }
    addArchive(card)

    return {
      name: call.name,
      args: { title: card.title, category: card.category },
      ok: true,
      summary: `档案 +1（${card.title}），共 ${countArchives()} 张`,
      data: card,
    }
  } catch (error) {
    return {
      name: call.name,
      args: call.args,
      ok: false,
      summary: `执行失败：${error instanceof Error ? error.message : String(error)}`,
    }
  }
}
