import type { Npc } from "./types"

export function validateNpcTags(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== 3 || !value.every(tag => typeof tag === "string" && /^[\u4e00-\u9fff]{2,4}$/.test(tag.trim()))) {
    throw new Error("角色标签须为3个中文短词，每个2—4字，请重新生成")
  }
  const tags = [...new Set(value.map(tag => tag.trim()))]
  if (tags.length !== 3) throw new Error("角色标签不能重复，请重新生成")
  return tags
}

/** 旧角色只展示短词，不再把性格长文当作标签。 */
export function getNpcTags(npc: Npc): string[] {
  const candidates = npc.tags ?? npc.personality.split(/[,，、；。]/)
  return [...new Set(candidates.map(tag => tag.trim()).filter(tag => tag.length > 0 && tag.length <= 8))].slice(0, 3)
}
