/** 演示用小型词库：覆盖两个场景里出现的高频词。真实产品接词典 API 或自建词库。 */

export interface DictEntry {
  word: string
  pos: string
  meaning: string
  example: string
  note?: string
}

const ENTRIES: DictEntry[] = [
  { word: "cafe", pos: "n.", meaning: "咖啡馆（英式拼写，美式为 café/cafe）", example: "There's a nice cafe around the corner." },
  { word: "barista", pos: "n.", meaning: "咖啡师", example: "The barista made me a flat white." },
  { word: "flat white", pos: "n.", meaning: "馥芮白：浓缩加少量细腻奶泡，澳洲/英国常见", example: "One flat white, please.", note: "在英国点单常用“Can I get a flat white?”" },
  { word: "latte", pos: "n.", meaning: "拿铁", example: "I'll have a latte, thanks." },
  { word: "order", pos: "v./n.", meaning: "点单；订单", example: "What did you order?", note: "点单说 order，不要说 buy coffee。" },
  { word: "recommend", pos: "v.", meaning: "推荐", example: "What would you recommend?", note: "比“What is good?”更自然。" },
  { word: "gallery", pos: "n.", meaning: "画廊；美术馆", example: "I went to a gallery yesterday." },
  { word: "photography", pos: "n.", meaning: "摄影（不可数）", example: "I'm really into photography.", note: "说 a photo / photos，但 photography 不加 s。" },
  { word: "photograph", pos: "n./v.", meaning: "照片；拍照", example: "She photographed the whole street." },
  { word: "shoot", pos: "v.", meaning: "拍摄（口语常用）", example: "I shoot around here.", note: "过去式 shot，不是 shooted。" },
  { word: "street", pos: "n.", meaning: "街道", example: "I like shooting on the street." },
  { word: "texture", pos: "n.", meaning: "质感、纹理", example: "Old buildings have so much texture." },
  { word: "building", pos: "n.", meaning: "建筑物", example: "That building is from the 1800s." },
  { word: "interesting", pos: "adj.", meaning: "有趣的", example: "I think street photography is more interesting.", note: "修饰事物用 interesting，人让你感兴趣才说 interested。" },
  { word: "interested", pos: "adj.", meaning: "（人）感兴趣", example: "I'm interested in photography.", note: "固定搭配 be interested in + 名词/动名词。" },
  { word: "yesterday", pos: "adv.", meaning: "昨天", example: "I went there yesterday.", note: "有 yesterday 就说明是过去，动词要用过去式。" },
  { word: "went", pos: "v.", meaning: "go 的过去式", example: "I went to a cafe.", note: "不是 goed。" },
  { word: "met", pos: "v.", meaning: "meet 的过去式", example: "I met a friend.", note: "不是 meeted。" },
  { word: "saw", pos: "v.", meaning: "see 的过去式", example: "I saw a great photo.", note: "不是 seed。" },
  { word: "travel", pos: "v./n.", meaning: "旅行", example: "I love travelling.", note: "英式双写 l：travelling。" },
  { word: "lovely", pos: "adj.", meaning: "很棒的、可爱的（英式口语高频）", example: "Sounds lovely!", note: "比 nice 更有温度，英国人常用。" },
  { word: "busy", pos: "adj.", meaning: "忙的、热闹的", example: "It gets busy at noon." },
  { word: "regular", pos: "n./adj.", meaning: "常客；规律的", example: "The regulars make it feel like family." },
  { word: "coming up", pos: "phrase", meaning: "马上就好（服务场景）", example: "One flat white coming right up!" },
  { word: "first time", pos: "phrase", meaning: "第一次", example: "Is this your first time here?" },
  { word: "music", pos: "n.", meaning: "音乐（不可数）", example: "I play music in the shop.", note: "不说 a music。" },
  { word: "apron", pos: "n.", meaning: "围裙", example: "She wiped her hands on her apron." },
  { word: "light", pos: "n./adj.", meaning: "光；明亮的", example: "You notice the light, don't you?", note: "摄影语境里 light 常指自然光质感。" },
  { word: "combo", pos: "n.", meaning: "组合（口语）", example: "Photography and travel — nice combo!" },
  { word: "opinion", pos: "n.", meaning: "观点", example: "In my opinion, film looks warmer." },
  { word: "prefer", pos: "v.", meaning: "更喜欢", example: "I prefer street work to studio." },
  { word: "studio", pos: "n.", meaning: "工作室、影棚", example: "Studio work feels too controlled." },
]

const MAP = new Map(ENTRIES.map((entry) => [entry.word.toLowerCase(), entry]))

export interface DictLookup {
  found: boolean
  entry?: DictEntry
  suggestions?: string[]
}

/** 查词：先精确匹配，再前缀模糊匹配 */
export function lookupWord(raw: string): DictLookup {
  const word = raw.trim().toLowerCase().replace(/[.?!,]$/, "")
  const exact = MAP.get(word)
  if (exact) return { found: true, entry: exact }

  const suggestions = ENTRIES.filter(
    (entry) => entry.word.includes(word) || word.includes(entry.word),
  )
    .slice(0, 3)
    .map((entry) => entry.word)

  return { found: false, suggestions: suggestions.length > 0 ? suggestions : undefined }
}
