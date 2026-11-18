import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { listNpcs } from "./npcRegistry"
import type { GrowthRecord } from "./types"

const directory = join(process.cwd(), ".data")
const file = join(directory, "growth.json")

function load(): GrowthRecord[] {
  try {
    const data: unknown = JSON.parse(readFileSync(file, "utf8"))
    if (!Array.isArray(data)) return []
    return data.filter((item): item is GrowthRecord =>
      item && typeof item.npcId === "string" && Number.isInteger(item.index) &&
      item.index >= 0 && (item.completedAt === null || typeof item.completedAt === "string"))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("读取成长记录失败", error)
    return []
  }
}

// 本地单用户演示：成长记录独立落盘，由服务端任务状态机更新。
const state = globalThis as unknown as { __growthRecords?: GrowthRecord[] }
function records() { return state.__growthRecords ?? (state.__growthRecords = load()) }
function save(next: GrowthRecord[]) {
  mkdirSync(directory, { recursive: true })
  writeFileSync(file + ".tmp", JSON.stringify(next), { mode: 0o600 })
  renameSync(file + ".tmp", file)
  state.__growthRecords = next
}
export function getGrowth(): GrowthRecord[] { return records() }
export function recordGrowth(npcId: string, index: number) {
  const npc = listNpcs().find(item => item.id === npcId)
  if (!npc) return
  const previous = records().find(item => item.npcId === npcId)
  if (previous && previous.index >= index) return
  const completed = index >= npc.quest.steps.length - 1
  const record = { npcId, index, completedAt: previous?.completedAt ?? (completed ? new Date().toISOString() : null) }
  save([...records().filter(item => item.npcId !== npcId), record])
}
export function resetGrowth() { save([]) }
