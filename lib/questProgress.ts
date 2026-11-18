import type { GrowthRecord, Npc } from "./types"

/** index 是已经达到的步骤；无记录时任何 todo 都不能勾选。 */
export function growthSteps(npc: Npc, record?: GrowthRecord) {
  return npc.quest.steps.map((step, index) => ({
    ...step,
    completed: !!record && index <= record.index,
  }))
}
