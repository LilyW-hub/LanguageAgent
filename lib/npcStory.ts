import { NPCS } from "./npcs"

/** 内置人物是写作基准；新人物学习叙述方式，不复制其职业和经历。 */
export const NPC_STORY_GUIDE = `【背景故事写作标准】
参考以下内置角色的生活感和叙述方式：
${JSON.stringify(["maya","leo"].map(id => {
  const npc = NPCS[id]!
  return {name:npc.name,profession:npc.profession,personality:npc.personality,story:npc.story}
}))}
story 必须像 Maya、Leo 一样简洁：中文一段，1—2句，约30—60字，最多80字。
故事和经历不要出现具体地名、道路名、社区名、店名或场馆名，只使用“公交车”“街道”“花市”“小店”等宽泛场景称谓。
只保留一条职业或生活经历，加一个日常爱好或最近关注的事即可。省略支线、冗长描写和完整人生履历，不必把所有人物设定都塞进背景。
各角色可以采用不同叙述顺序；不要写成条目、人物属性清单或任务指令，不要用“需要用户帮助”来推销任务。
从现有身份和场景出发，不照搬音乐专业、黑胶唱片、街头摄影等样例经历，不让每个人都继承父母的店铺，也不强行安排悲剧或宏大使命。
新增故事须与职业、年龄、性格、兴趣和当前场景相符；整理已有故事时只选最重要的一两条既定事实，其余省略，不增添或改写人生经历。`

export function validateNpcStory(value: unknown): string {
  if (typeof value !== "string" || value.trim().length < 30 || value.trim().length > 80) {
    throw new Error("背景故事应为30—80字的完整生活背景，请重新生成")
  }
  return value.trim()
}
