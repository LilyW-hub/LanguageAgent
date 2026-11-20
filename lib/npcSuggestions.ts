import type { Npc } from "./types"
type Suggestions = Npc["suggestions"]

const roleSuggestions: Array<{ match: RegExp; labels: [string,string]; texts: [string,string,string] }> = [
  {match:/florist|花商|花艺/i,labels:["花语故事","花束搭配"],texts:[
    "Yesterday I buy some flowers for my sister.",
    "What do different flowers mean when you give them as a gift?",
    "I prefer seasonal flowers because they feel more personal.",
  ]},
  {match:/cobbler|shoe repair|修鞋/i,labels:["老唱片","旧鞋翻新"],texts:[
    "These shoes is too tight for me.",
    "What music do you like listening to while repairing shoes?",
    "I would rather repair these shoes than buy a new pair.",
  ]},
  {match:/bus driver|公交|巴士/i,labels:["街巷故事","夜间广播"],texts:[
    "I take this bus last night.",
    "Do you collect stories about the places along your bus route?",
    "I enjoy late-night radio because the voices make the journey feel less lonely.",
  ]},
  {match:/clock|watch.*repair|钟表/i,labels:["周末板球","老钟收藏"],texts:[
    "My clock stop working yesterday.",
    "Do you prefer watching cricket or listening to it on the radio?",
    "I think old clocks are worth repairing because they hold memories.",
  ]},
  {match:/mudlark|foreshore|拾荒|滩涂/i,labels:["河滩寻宝","旧物故事"],texts:[
    "Yesterday I find an old coin near the river.",
    "What is the most interesting thing you have found on the foreshore?",
    "I think small everyday objects can tell us a lot about the past.",
  ]},
]

/** 保留已有三条快捷句；旧版仅有打招呼的角色自动补全。 */
export function npcSuggestions(npc: Pick<Npc,"profession"|"suggestions"> & Partial<Pick<Npc,"interests">>): Suggestions {
  if (npc.suggestions.length === 3 && npc.suggestions.every(item =>
    typeof item.label === "string" && item.label.trim().length > 0 && item.label.length <= 12 &&
    !/^(表达(?:偏好|意见|观点)|谈兴趣|角色相关兴趣|兴趣话题|具体兴趣话题|另一个具体兴趣话题)$/.test(item.label.replace(/^[^a-zA-Z\u4e00-\u9fa5]+/u, "")) &&
    typeof item.text === "string" && item.text.trim().length > 0 && item.text.length <= 200,
  ) && new Set(npc.suggestions.map(item => item.label)).size === 3) return npc.suggestions
  const role = roleSuggestions.find(item => item.match.test(npc.profession))
  const profession = npc.profession.toLowerCase()
  const texts = role?.texts ?? [
    `Yesterday I meet a ${profession}.`,
    "What first got you interested in this kind of work?",
    `I think working as a ${profession} takes a lot of patience.`,
  ]
  const topics = npc.interests?.filter(topic => topic.trim().length > 0 && topic.length <= 8) ?? []
  return [
    {label:"演示错误句",text:texts[0]!},
    {label:role?.labels[0] ?? topics[0] ?? "日常工作",text:texts[1]!},
    {label:role?.labels[1] ?? topics[1] ?? "职业经历",text:texts[2]!},
  ]
}
