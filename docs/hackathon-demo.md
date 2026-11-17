# 游戏化 AI 语言学习 Agent · 黑客松 Demo 技术文档

> 用途：交给实现智能体执行。目标：**2 天**内产出可在「AI + Agent」主题黑客松现场演示的垂直切片。
> 依据：PRD V2.0。原则：**「会说话、会教、会记住你」做真，其余全 mock。**

---

## 0. 目标与演示脚本（黄金路径）

**成功标准**：评委 90 秒内亲身体验到一条完整学习闭环，并且「看见」Agent 在背后工作。

**分镜脚本（约 5 分钟）**：

| 步骤 | 画面 | 要点 |
|---|---|---|
| 1 | Onboarding | 选目标语言=英语、水平=A2、兴趣勾选（一键填入 demo 数据，可跳过） |
| 2 | 进入伦敦·咖啡馆，见 NPC #1 Maya | 顶部显示「🎯 场景目标：点单 + 过去时」，开始对话 |
| 3 | 用户说出带过去时错误的话 | Maya **在人物语境里**自然纠正（不打断）→ 弹「课后卡」+「📜 档案卡」 |
| 4 | 画像面板实时更新 | 显示「Inferred：喜欢摄影（置信度 0.8，来自第 3 轮）」 |
| 5 | 切到 NPC #2 Leo（摄影师） | Leo **不「认出」你**，但话题/难度跟着画像走 → 证明「记忆跟随 + diegetic 连续性」 |
| 6 | Trace 面板 | 全程展示 Orchestrator 每步决策（读画像→纠错→生成回复→提取画像） |

**预埋错误（保证演示必现）**：演示者输入 `Yesterday I go to a nice cafe and I meet a friend.` → 触发过去时纠错（`went / met`）。

> 档案卡 = 本次学习任务的产出（故事给使命 → 学习给手段 → 档案给证明）。

---

## 1. 范围（In / Out）

**In（必须真做）**：
- 聊天 UI（多轮、流式输出）
- 2 个 NPC（Maya / Leo）+ 人设卡
- NPC 对话（保持人设 + 按 A2 难度）
- 双层纠错：对话内 diegetic 纠错 + 课后卡
- 画像提取（Explicit / Inferred 分类）+ 实时画像面板
- 记忆跟随：NPC #2 冷启动时读取画像摘要（不泄露「我记得你」）
- 场景学习目标（每个 NPC 挂 1–2 个语言目标，如「点单 + 过去时」）
- 档案卡（课后卡产出 1 张「📜 已收集档案」）
- Trace 面板（Agent 编排可视化）

**Out（mock / 砍掉）**：
- 真实地图 → 静态城市/人物卡片选择
- XP / 探索点数 → 硬编码展示，不写逻辑
- 完整档案馆 → 只做单张「档案卡」，不建分类/列表/详情
- 注册登录 → 单用户，假登录
- 语音 ASR/TTS、支付、多语言（只做英语）

---

## 2. 架构（单主控 + 3 个专职模块）

> 关键决策：**不做 LLM 编排器**，用「确定性管线 + 专职模块」实现多 Agent 感。理由：2 天里确定性管线更可靠、延迟更低，Agent 感用 Trace 面板讲出来即可。

```
用户消息
  │
  ▼
[Orchestrator — 确定性管线]
  1. 读画像 + 记忆（Profile Store）
  2. Tutor 分析错误 → correction（纠错唯一事实源）
  3. NPC Engine 生成回复（引用 correction + 场景学习目标）
  4. Profile Extractor 更新画像
  5. 组装 { reply, correction, profileDelta, archiveCard, trace }
  │
  ├── Tutor ────────────► correction
  ├── NPC Engine ───────► reply（含 diegetic 纠错）
  └── Profile Extractor ► profileDelta
```

- **Tutor（先跑）**：识别用户原句的语言错误，输出结构化纠正（原句/改后/错误类型/解释/是否加入复习）——纠错的**唯一事实源**。
- **NPC Engine（后跑）**：按人设卡 + 画像冷启动摘要 + 场景学习目标 + 短期历史 + Tutor 的 `corrected`，生成角色回复（在回复里自然地用 `corrected` 做 diegetic 纠错）。
- **Profile Extractor**：从用户消息提取兴趣/职业/目标等，标注 Explicit（用户明说）或 Inferred（推测+置信度），只存非敏感信息。
- **Memory（冷启动摘要）**：把画像压缩成「NPC 该知道的难度/话题/语气」，**绝不产出「我记得你上次…」**。
- 注：「4 个角色」是**单应用内的专职模块**（一个主控 + 三个模块），不是四套独立服务——与 PRD「MVP 单主控 + 模块」一致。

---

## 3. 技术选型与环境

| 项 | 选择 | 理由 |
|---|---|---|
| 框架 | **Next.js 14（App Router）+ TypeScript + Tailwind** | 单仓库、API 路由、易部署，UI 好看 |
| LLM | **openai SDK（OpenAI 兼容）**，`baseURL` 可配 | 兼容 OpenAI / DeepSeek / 任何兼容端点 |
| 存储 | **内存单例 + `/api/reset`**（可选：JSON 文件落盘） | 免装数据库，最快最稳；演示前 reset 即可 |
| 部署 | `npm run dev` 本地跑，或 Vercel 一键 | 现场离线可跑 |

**环境变量（`.env.local`）**：
```
OPENAI_API_KEY=sk-xxx
OPENAI_BASE_URL=https://api.deepseek.com/v1   # 或 https://api.openai.com/v1
MODEL_NAME=deepseek-v4-pro                     # 换成你手里的强模型
```
> 用带 JSON 输出能力的模型；若支持 `response_format={type:"json_object"}` 则开启，否则用「输出 JSON」提示词 + 正则兜底解析。

---

## 4. 目录结构

```
app/
  page.tsx                 # 单页：聊天 + 侧栏
  layout.tsx
  api/
    chat/route.ts          # 主入口：POST 用户消息 → 返回 { reply, correction, profileDelta, archiveCard, trace }
    onboard/route.ts       # 初始化/预填画像
    reset/route.ts         # 清空状态（演示前调用）
lib/
  store.ts                 # 内存单例：profile / corrections / history / npc
  llm.ts                   # openai SDK 封装 + JSON 解析兜底
  orchestrator.ts          # 管线调度
  agents/
    npcEngine.ts           # NPC 回复生成（后跑，引用 corrected）
    tutor.ts               # 纠错（先跑，唯一事实源）
    profileExtractor.ts    # 画像提取
    memory.ts              # 冷启动摘要
  prompts.ts               # 所有 prompt 模板集中管理
  npcs.ts                  # 2 张人设卡（含 learningObjective）
components/
  ChatView.tsx             # 对话流 + 输入框 + 场景目标徽章
  Onboarding.tsx           # 目标语言/水平/兴趣 chips（一键填 demo）
  CitySelect.tsx           # 静态：伦敦 + 2 NPC 卡片
  ProfilePanel.tsx         # 实时画像（显式/推测/学习弱点）
  ReviewCard.tsx           # 课后卡（纠错触发时弹出）
  ArchiveCard.tsx          # 档案卡（课后卡产出）
  TracePanel.tsx           # Agent 编排可视化
```

---

## 5. 数据模型（demo 精简版）

```ts
type Profile = {
  level: string                      // "A2"
  goal: string                       // "job interview"
  explicit: {
    nativeLanguage: string
    targetLanguage: string
    interests: string[]              // 用户勾选
    profession?: string
  }
  inferred: Array<{
    fact: string                     // "likes photography"
    confidence: number               // 0.8
    sourceTurn: number
  }>
  learning: {
    weaknesses: string[]             // ["past tense"]
    recentErrors: string[]
  }
}

type Correction = {
  original: string
  corrected: string
  errorType: "grammar" | "vocabulary" | "word_order" | "pragmatics" | "none"
  explanation: string                // 简短中文解释
  natural: string                    // 更地道的说法
  addToReview: boolean
}

type ArchiveCard = {
  title: string                      // "伦敦·咖啡馆日常用语"
  city: string                       // "London"
  category: "Language" | "Culture" | "Life" | "People"
  summary: string                    // "点单 + 过去时"
}

type TraceStep = {
  turn: number
  agent: "memory" | "tutor" | "npc" | "profile"
  action: string                     // "retrieved A2 + objective [ordering + past tense]"
  detail?: string
}

type ChatResponse = {
  reply: string
  learningObjective: string          // 当前场景目标（如 "Ordering + past tense"）
  correction: Correction | null
  profileDelta: { inferred?: Profile["inferred"]; weaknesses?: string[] } | null
  archiveCard: ArchiveCard | null
  trace: TraceStep[]
}
```

---

## 6. NPC 人设卡（可直接用）

```ts
export const NPCS = {
  maya: {
    id: "maya",
    name: "Maya",
    city: "London",
    scene: "Coffee shop",
    age: 24,
    profession: "Barista",
    personality: "warm, chatty, casual",
    interests: ["music", "coffee", "London city life"],
    speechStyle: "casual, short sentences, occasional British slang",
    languageLevel: "A2",
    learningObjective: "Ordering + past tense（点单 + 过去时）",
    factBoundary: ["coffee", "London daily life", "music"],
    forbidden: ["politics", "religion"],
    opening: "Morning! What can I get you? I'm Maya by the way.",
  },
  leo: {
    id: "leo",
    name: "Leo",
    city: "London",
    scene: "Street / gallery",
    age: 32,
    profession: "Photographer",
    personality: "gentle, witty, curious",
    interests: ["photography", "travel", "street art"],
    speechStyle: "calm, asks questions, light humor",
    languageLevel: "A2-B1",
    learningObjective: "Talking about interests + opinion（谈论兴趣 + 观点表达）",
    factBoundary: ["photography", "travel", "art"],
    forbidden: ["politics", "religion"],
    opening: "Hey — you look like someone who notices light. I'm Leo, I shoot around here.",
  },
}
```

---

## 7. 核心 Prompt 模板（可直接粘贴）

### 7.1 NPC Engine（含 diegetic 纠错 + diegetic 约束）

```
你是 {name}，一个生活在 {city} 的 {profession}，{age} 岁。
性格：{personality}。说话方式：{speechStyle}。
你的兴趣：{interests}。当前场景：{scene}。
本场景学习目标：{learningObjective}（把对话自然往这个目标带）。

【人设铁律】
1. 永远保持上述身份、性格和说话方式，不跳出角色。
2. 只聊事实边界内的话题：{factBoundary}。绝对不谈 {forbidden}。
3. 你是第一次见到这位旅行者。**绝不**说“你上次说过”“我记得你”“又见面了”之类的话。
4. 你「感知」到的关于对方的信息（用于自然调整话题和难度，但不要点破来源）：
   - 对方英语水平约 {level}
   - 对方可能感兴趣：{inferredInterests}
   - 对方正在练习的薄弱点：{weaknesses}
5. 用适合 {level} 的词汇和句长。对方是学习者，句子别太长、别用生僻词。

【纠错规则（diegetic，不打断）】
- 如果本句有错误，Tutor 会给你正确说法：{corrected}。
- 你在回复里**自然地**用这个正确说法，像当地人提醒一样，不要出现“错误”“语法”这些词。
- 例：对方说 “Yesterday I go...”，Tutor 给出 “went / met”，你可以说 “Oh nice — you went there? I love that place!”
- 只纠这一个错，不要额外纠别的；Tutor 判无错（errorType:"none"）时正常回复即可。

【对话历史】
{shortHistory}

【对方刚说】
{userMessage}

请只输出你的下一句角色回复（纯文本，不要解释、不要引号）。
```

### 7.2 Tutor（纠错，JSON 输出）

```
你是英语纠错专家。分析下面这句话（说话者母语中文，目标语言英语，水平 {level}）。
只处理**明显且值得教**的语言错误；没有错误就输出 errorType:"none"。

输入："{userMessage}"

严格输出 JSON（不要多余文字）：
{
  "original": "原文",
  "corrected": "改后句子",
  "errorType": "grammar|vocabulary|word_order|pragmatics|none",
  "explanation": "一句话中文解释，如：过去时要用 went 而不是 go",
  "natural": "更地道的同义说法",
  "addToReview": true
}
```

### 7.3 Profile Extractor（Explicit / Inferred）

```
从下面这句用户消息里，提取可用于个性化教学的非敏感信息。
只提取**明显**的信息；没有就输出空数组。

输入："{userMessage}"

严格输出 JSON：
{
  "inferred": [
    { "fact": "likes photography", "confidence": 0.8, "type": "interest" }
  ],
  "weaknesses": []   // 本条消息里能看出的语言薄弱点，如 "past tense"
}
规则：
- type 只能是 interest | profession | goal | communication_style。
- 不要提取年龄、住址、真实姓名等敏感信息。
- 用户明确说出的 → 记为 explicit（由前端勾选/显式字段处理）；推测的 → inferred + 置信度。
```

### 7.4 Memory 冷启动摘要（给 NPC Engine 用，不泄露「记得」）

```
把下面画像压缩成一段「NPC 冷启动该知道」的摘要，用于调节难度和话题。
【绝不】生成任何暗示“之前聊过/记得你”的句子，只输出事实性要点。

画像：
- 水平：{level}
- 目标：{goal}
- 兴趣（显式）：{explicitInterests}
- 兴趣（推测）：{inferredFacts}
- 薄弱点：{weaknesses}

输出（简洁要点，不超 80 字）：
```

---

## 8. API 路由规格

### `POST /api/chat`
请求：
```json
{ "message": "Yesterday I go to a nice cafe...", "npcId": "maya" }
```
响应：
```json
{
  "reply": "Oh nice — you went there? ...",
  "learningObjective": "Ordering + past tense",
  "correction": { "original": "...", "corrected": "...", "errorType": "grammar", "explanation": "...", "natural": "...", "addToReview": true },
  "profileDelta": { "inferred": [{"fact":"likes photography","confidence":0.8,"sourceTurn":3}], "weaknesses":["past tense"] },
  "archiveCard": { "title": "伦敦·咖啡馆日常用语", "city": "London", "category": "Life", "summary": "点单 + 过去时" },
  "trace": [
    {"turn":3,"agent":"memory","action":"retrieved level A2 + objective [ordering + past tense]"},
    {"turn":3,"agent":"tutor","action":"detected past tense error → corrected 'went'"},
    {"turn":3,"agent":"npc","action":"generated reply as Maya (used corrected)"},
    {"turn":3,"agent":"profile","action":"inferred likes photography (0.8)"}
  ]
}
```

### `POST /api/onboard`
请求：`{ "level":"A2", "goal":"job interview", "interests":["photography"], "profession":"designer" }` → 初始化 Profile（母语=中文、目标语言=英语固定）。

### `POST /api/reset`
清空 profile / corrections / history。演示前调用。

---

## 9. 前端页面（单页三栏）

- **左栏**：CitySelect（静态伦敦 + Maya/Leo 卡片，点选切换 NPC）。
- **中栏**：ChatView（对话流 + 输入框 + 「发送建议句」按钮，预埋错误演示）；顶部常驻场景目标徽章「🎯 {learningObjective}」。
- **右栏（Tab 切换）**：
  - ProfilePanel：显式信息 / 推测信息（带置信度）/ 学习弱点，实时刷新。
  - TracePanel：按时间顺序列出每次 `agent` 动作（这是「AI+Agent」主题的得分点）。
- **ReviewCard**：当 `correction` 非空时，在聊天流里插入「课后卡」；随后弹「📜 档案卡」（`archiveCard`），体现「学习 → 档案」产出。

---

## 10. 视觉呈现（人物形象与场景背景）

> 沉浸感靠视觉把人物和场景立起来。以下都是 2 天内可做、且离线可跑（图片提前放进 `public/`）。

### 10.1 人物形象（NPC 视觉）
- **头像**：每个 NPC 一张竖版半身像。优先级：AI 生图（DALL·E / 即梦 / Midjourney）> 免版权图库（Unsplash 搜 `barista portrait` / `photographer portrait`）> emoji 占位。
- **人设卡**：聊天区顶部常驻可展开卡片：头像 + 姓名 + 年龄/职业 + 性格标签 + 兴趣 + 语言难度（A2）+ 一句背景故事。让「这是谁」一眼可见。
- **风格一致性**：头像必须和人设卡一致（Maya=咖啡师→制服/咖啡场景；Leo=摄影师→相机/街头）。

### 10.2 场景背景（沉浸感）
- **背景图**：聊天区整屏/头部叠一张半透明场景图（咖啡馆 / 街道），2 张即可。
- **地点徽章**：聊天顶部显示「📍 伦敦 · 咖啡馆」，切 NPC 时背景图 + 徽章一起切换。
- **场景目标徽章**：地点旁显示「🎯 {learningObjective}」，让「学习优先」一眼可见。

### 10.3 背景故事与世界观（轻量、不打断）
- **任务简报卡**：Onboarding 后插一屏「你是文明档案员，任务是在文明迁徙前记录当地文化」——一句话 + 一张氛围图。
- **身份徽章**：聊天区角落常驻「📜 文明档案员」小徽章，点开看已收集档案（demo 里 1–2 条）。
- **人物背景故事**：放进人设卡的「人物介绍」折叠区，**不要在对话里硬塞**（会破坏 diegetic 自然感）。

### 10.4 用视觉强化 diegetic 一致性
- 每个 NPC 独立配色 + 气泡样式（Maya 暖色/随性，Leo 冷色/温和），切人时整体换肤，再强化一次「这是另一个人」。

### 10.5 两天预算与兜底
- **Day 1**：纯文本人设卡 + CSS 渐变背景 + emoji 头像（先跑通对话闭环）。
- **Day 2**：替换为 AI 生成 / 图库头像 + 场景图。
- **兜底**：没有生图 key 时，用图库免费图（提前下载到 `public/`，离线可用）。

---

## 11. Trace 面板（Agent 可视化，重点）

这是把「多 Agent」从 PPT 变成「看得见」的关键。每次对话后，把 `trace` 数组渲染成带图标的时间线：
```
🧠 memory  → 读取画像：A2 + 场景目标[点单 + 过去时]
🩺 tutor  → 检测到错误：过去时 → went
🎭 npc    → Maya 用 corrected 生成回复（diegetic 纠错）
👤 profile → 推测：喜欢摄影（置信度 0.8）
```
每步可展开看 `detail`。这一屏直接回应评审对「Agent 编排」的期待。

---

## 12. 两天里程碑

**Day 1（跑通闭环，晚前可对话+纠错）**
1. `create-next-app` 脚手架 + Tailwind + `.env.local`。
2. `lib/llm.ts`（openai 封装 + JSON 兜底）、`lib/store.ts`、`lib/npcs.ts`。
3. `tutor.ts`（先跑）+ `npcEngine.ts`（后跑，引用 corrected）+ `/api/chat`。
4. ChatView + ReviewCard + ArchiveCard + Onboarding。
5. ✅ 验收：与 Maya 对话，说错误句，能看到 diegetic 纠错 + 课后卡 + 档案卡。

**Day 2（补 Agent 感 + 记忆跟随 + 打磨）**
1. `profileExtractor.ts` + ProfilePanel（实时更新）。
2. `memory.ts` 冷启动摘要 + 第二个 NPC Leo + 切换 NPC。
3. TracePanel + 场景目标徽章 + `/api/reset`。
4. 预埋错误句按钮、流式输出、兜底与降级、录好演示脚本。
5. ✅ 验收：完整 5 分钟黄金路径可走通。

---

## 13. 验收清单

- [ ] 能选英语 + A2 + 兴趣，一键预填画像。
- [ ] 与 Maya 多轮对话，保持人设、不跳戏。
- [ ] 聊天区顶部显示场景学习目标（如「🎯 点单 + 过去时」）。
- [ ] 说错误句 → 对话内被自然纠正 + 弹出课后卡 + 档案卡。
- [ ] 画像面板实时出现「Inferred：喜欢摄影」。
- [ ] 切到 Leo：不「认出」用户，但话题/难度反映画像。
- [ ] Trace 面板完整展示 4 个 Agent 角色的动作（tutor 在 npc 之前）。
- [ ] `/api/reset` 一键重置，现场可反复演示。

---

## 14. 风险与兜底

| 风险 | 兜底 |
|---|---|
| LLM 纠错不触发 | 预埋固定错误句 + 「发送建议句」按钮，保证必现 |
| 两层纠错说法不一致 | Tutor 先产出 `corrected`，NPC Engine 只引用它（单一事实源） |
| NPC 跳出人设/泄露记忆 | 人设卡铁律 3、4 + 冷启动摘要「不输出记忆暗示」；演示前人工过一遍 |
| 结构化输出失败 | JSON 兜底解析（正则提取 `{...}`）+ 失败重试一次 + 失败时 `correction:null` 不阻断对话 |
| 现场无网/无 key | 准备一份「已录制对话」降级为回放模式（可选） |
| 延迟高 | 流式输出 NPC 回复；Tutor/Profile 用同一次调用的并行/后置处理，不阻塞首字 |

---

*本文档为可执行规格；实现智能体可据此直接开工。遇到二义处，以「让评委 90 秒看懂闭环 + 看见 Agent」为最高优先级取舍。*
