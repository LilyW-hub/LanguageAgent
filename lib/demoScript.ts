import type { Correction, FactType } from "./types"

/**
 * 演示回放剧本。
 *
 * 用途：现场无网、模型限流或超时时，一键切到回放模式，
 * 整条黄金路径（纠错 → 课后卡 → 画像 → 档案 → Trace）依然完整可演。
 *
 * 匹配规则：先做归一化（小写、去标点空白），再用关键词命中，
 * 所以演示者怎么说、带不带句号，都能命中同一段剧本。
 */

export interface ScriptedTurn {
  npcId: string
  /** 命中关键词（全部包含才算命中，均为小写） */
  keywords: string[]
  reply: string
  correction?: Correction
  inferred?: Array<{ fact: string; confidence: number; type: FactType }>
  weaknesses?: string[]
}

export const SCRIPTED_TURNS: ScriptedTurn[] = [
  // ── Maya（咖啡馆）──────────────────────────────────
  {
    npcId: "maya",
    keywords: ["yesterday", "cafe"],
    reply:
      "Oh nice — you went to a nice cafe and met a friend? Sounds like a good day. What did you order?",
    correction: {
      original: "Yesterday I go to a nice cafe and I meet a friend.",
      corrected: "Yesterday I went to a nice cafe and met a friend.",
      errorType: "grammar",
      severity: "blocking",
      explanation: "Yesterday 表示过去，动词要用过去式：go → went，meet → met。",
      natural: "Yesterday I went to a nice cafe and met up with a friend.",
      addToReview: true,
    },
    weaknesses: ["past tense"],
  },
  {
    npcId: "maya",
    keywords: ["flat white"],
    reply: "Coming right up! Nice choice — have you had a flat white before, or is this your first?",
  },
  {
    npcId: "maya",
    keywords: ["photography"],
    reply:
      "Oh, photography's amazing! Do you shoot film or digital? I'd love to hear what you like to photograph.",
    inferred: [
      { fact: "interested in photography", confidence: 0.95, type: "interest" },
      { fact: "likes coffee shops", confidence: 0.6, type: "interest" },
    ],
  },
  {
    npcId: "maya",
    keywords: ["coffee shop", "working"],
    reply:
      "Most days, yeah! It gets busy but I love it — the regulars make it feel like a small family. Do you have a place like that back home?",
  },
  {
    npcId: "maya",
    keywords: ["travel"],
    reply: "Travelling is the best. Where was the last place you went? Anywhere you'd go back to?",
    inferred: [{ fact: "enjoys travelling", confidence: 0.9, type: "interest" }],
  },

  // ── Leo（街头 / 画廊）────────────────────────────────
  {
    npcId: "leo",
    keywords: ["gallery"],
    reply:
      "Oh you went to a gallery? Nice — which one? I'd love to hear what caught your eye in there.",
    correction: {
      original: "Yesterday I go to a gallery and I see a great photo.",
      corrected: "Yesterday I went to a gallery and saw a great photo.",
      errorType: "grammar",
      severity: "blocking",
      explanation: "Yesterday 表示过去，动词要用过去式：go → went，see → saw。",
      natural: "Yesterday I went to a gallery and saw a great photo there.",
      addToReview: true,
    },
    weaknesses: ["past tense"],
  },
  {
    npcId: "leo",
    keywords: ["old buildings"],
    reply:
      "Old buildings are my favourite subject too — all that texture and history. Which city has the best ones you've shot?",
    inferred: [{ fact: "likes photographing old buildings", confidence: 0.9, type: "interest" }],
  },
  {
    npcId: "leo",
    keywords: ["street photography"],
    reply:
      "Ha, I'm with you — street keeps you honest, nothing is staged. Studio work feels too controlled for me. What's the last thing you shot on the street?",
    inferred: [{ fact: "prefers street photography over studio work", confidence: 0.85, type: "interest" }],
  },
  {
    npcId: "leo",
    keywords: ["photography"],
    reply:
      "A fellow photographer! I mostly shoot the old streets before they're gone. What catches your eye when you walk around?",
    inferred: [{ fact: "interested in photography", confidence: 0.95, type: "interest" }],
  },
  {
    npcId: "leo",
    keywords: ["travel"],
    reply: "Travel changes how you see light, doesn't it? Which trip stayed with you the longest?",
  },
  {
    npcId: "leo",
    keywords: ["hello"],
    reply: "Hi there, nice to meet you too! Are you visiting London or do you live here?",
  },
]

/** 归一化：小写、去标点、压缩空白 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,!?;:'"`()[\]{}<>—–_/\\|@#$%^&*+=~…·、。，！？；：（）【】《》「」『』]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/** 找出命中的剧本；未命中返回 undefined（由调用方给通用回复） */
export function findScriptedTurn(npcId: string, message: string): ScriptedTurn | undefined {
  const text = normalizeForMatch(message)
  return SCRIPTED_TURNS.find(
    (turn) => turn.npcId === npcId && turn.keywords.every((word) => text.includes(word)),
  )
}

/** 未命中时的通用回复（保持人设，不暴露"回放"） */
export function fallbackReply(npcId: string): string {
  return npcId === "leo"
    ? "That's interesting — tell me more about that. What made you think about it?"
    : "Ha, tell me more! What happened next?"
}

/** 脚本里用于生成课后卡的说明 */
export function scriptedArchiveSummary(turn: ScriptedTurn): string {
  return turn.correction?.explanation ?? "完成一次情景对话"
}
