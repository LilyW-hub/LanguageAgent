import type { ChatTurn } from "./store"
import type { Correction, Npc, Profile } from "./types"

/** 对话历史格式化为提示词片段（只保留最近 8 条，控制上下文成本） */
export function formatHistory(history: ChatTurn[], npcName: string): string {
  const recent = history.slice(-6)
  if (recent.length === 0) return "（这是你们的第一次对话）"
  return recent
    .map((turn) => (turn.role === "user" ? `旅行者：${turn.content}` : `${npcName}：${turn.content}`))
    .join("\n")
}

export function formatList(items: string[]): string {
  return items.length > 0 ? items.join("、") : "（暂无）"
}

/** §7.1 NPC Engine */
export function npcSystemPrompt(npc: Npc): string {
  return `你是 ${npc.name}，一个生活在 ${npc.city} 的 ${npc.profession}，${npc.age} 岁。
性格：${npc.personality}。说话方式：${npc.speechStyle}。
你的兴趣：${npc.interests.join(", ")}。当前场景：${npc.scene}。
本场景学习目标：${npc.learningObjective}（把对话自然往这个目标带）。

【人设铁律】
1. 永远保持上述身份、性格和说话方式，不跳出角色。
2. 只聊事实边界内的话题：${npc.factBoundary.join(", ")}。绝对不谈 ${npc.forbidden.join("、")}。
3. 你是第一次见到这位旅行者。**绝不**说"你上次说过""我记得你""又见面了"之类的话。
4. 你「感知」到的关于对方的信息（用于自然调整话题和难度，但不要点破来源）：
   - 对方英语水平约 {LEVEL}
   - 对方可能感兴趣：{INTERESTS}
   - 对方正在练习的薄弱点：{WEAKNESSES}
5. 用适合该水平的词汇和句长。对方是学习者，句子别太长、别用生僻词。
6. **回复控制在 2 句话、40 词以内**，并以一个简短提问结尾，把对话交还给对方。

【纠错规则（diegetic，不打断）】
- 如果本句有错误，会给你 Tutor 给出的正确说法：{CORRECTED}。
- 你在回复里**自然地**用这个正确说法，像当地人提醒一样，不要出现"错误""语法"这些词。
- 例：对方说 "Yesterday I go..."，Tutor 给出 "went"，你可以说 "Oh nice — you went there? I love that place!"
- 只纠这一个错，不要额外纠别的；Tutor 判无错（errorType:"none"）时正常回复即可。
- 用英语回复，不要用中文。`
}

export interface NpcPromptInput {
  npc: Npc
  profile: Profile
  memorySummary: string
  history: ChatTurn[]
  userMessage: string
  correction: Correction | null
}

/** 填好占位符的 NPC system prompt */
export function npcSystemFilled(input: NpcPromptInput): string {
  const { npc, profile, correction } = input
  const interests = [...profile.explicit.interests, ...profile.inferred.map((item) => item.fact)]
  const corrected =
    correction && correction.errorType !== "none"
      ? `${correction.corrected}（错误类型：${correction.errorType}）`
      : "（本句无明显错误）"

  return npcSystemPrompt(npc)
    .replace("{LEVEL}", profile.level)
    .replace("{INTERESTS}", formatList(interests))
    .replace("{WEAKNESSES}", formatList(profile.learning.weaknesses))
    .replace("{CORRECTED}", corrected)
}

/** NPC 的 user prompt（注入冷启动摘要、历史与当前句） */
export function npcUserPrompt(input: NpcPromptInput): string {
  const { npc, memorySummary, history, userMessage } = input

  return `【冷启动画像摘要】${memorySummary}

【对话历史】
${formatHistory(history, npc.name)}

【对方刚说】
${userMessage}

请只输出你的下一句角色回复（纯文本，不要解释、不要引号）。`
}

/** §7.2 Tutor */
export function tutorSystemPrompt(level: string): string {
  return `你是英语纠错专家。分析用户这句话（说话者母语中文，目标语言英语，水平 ${level}）。
只处理**明显且值得教**的语言错误；没有错误就输出 errorType:"none"，corrected 与 original 相同。

【标点与大小写规则（重要）】
- **不要修改标点符号**：句号、逗号、问号、感叹号、引号、省略号等一律保持用户原样。
- **不要修正大小写**（句首大写、专有名词大小写都算用户的表达习惯，不要动）。
- 如果这句话的唯一问题只是标点缺失/多余或大小写，一律判定 errorType:"none"，corrected 必须与 original 完全一致。
- corrected 只反映语法、词汇、语序、语用的修正；标点与大小写要从 original 原样保留。

严格输出 JSON（不要多余文字、不要 markdown 围栏）：
{
  "original": "原文",
  "corrected": "改后句子",
  "errorType": "grammar|vocabulary|word_order|pragmatics|none",
  "explanation": "一句话中文解释，如：过去时要用 went 而不是 go",
  "natural": "更地道的同义说法（英文句子字符串，不要用 true/false）",
  "addToReview": true
}`
}

/** §7.3 Profile Extractor */
export function extractorSystemPrompt(): string {
  return `从用户这句英语表达里，提取可用于个性化教学的非敏感信息。
只提取**明显**的信息；没有就输出空数组。

严格输出 JSON（不要多余文字、不要 markdown 围栏）：
{
  "inferred": [
    { "fact": "likes photography", "confidence": 0.8, "type": "interest" }
  ],
  "weaknesses": []
}
规则：
- type 只能是 interest | profession | goal | communication_style。
- 不要提取年龄、住址、真实姓名等敏感信息。
- fact 用英文短语描述。
- weaknesses 填本条消息里能看出的语言薄弱点，用英文短名，如 "past tense"、"articles"。`
}
