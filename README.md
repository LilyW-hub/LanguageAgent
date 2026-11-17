# LanguageAgent · 会教你的世界

黑客松 demo：**游戏化 AI 语言学习 Agent** 的垂直切片。
依据 PRD V2.0 与《黑客松 Demo 技术文档》，把「会说话、会教、会记住你」三件事做成真的，其余全部 mock。

---

## 快速开始

```bash
# 1) 配置模型
cp .env.example .env.local
# 编辑 .env.local，填入 OPENAI_API_KEY（以及 OPENAI_BASE_URL / MODEL_NAME）

# 2) 安装依赖
npm install     # 或 pnpm install

# 3) 启动
npm run dev     # http://localhost:3000
```

演示前想重置所有状态：点右上角「重置」，或 `curl -X POST http://localhost:3000/api/reset`。

---

## 演示脚本（约 5 分钟）

1. **Onboarding** → 点「一键填入演示数据」（A2 / job interview / designer / photography, travel）→ 开始探索。
2. 进入 **伦敦 · 咖啡馆**，Maya 打招呼。顶部可见 `📍 伦敦 · 咖啡馆` 与 `🎯 点单 + 过去时`。
3. 点 **😈 演示错误句** 按钮 → 发送
   `Yesterday I go to a nice cafe and I meet a friend.`
   → Maya 在对话里自然用 `went / met` 纠正（不打断），气泡下方出现 **课后卡** 与 **📜 档案卡**。
4. 看右栏 **画像** Tab：出现 `Inferred: likes photography (0.8)` 等推测条目。
5. 切到 **Agent Trace** Tab：看到 `🧠 memory → 🩺 tutor → 🎭 npc → 👤 profile` 完整编排。
6. 左栏切到 **Leo（摄影师）**：他不「认出」你，但话题/难度已经跟着画像走 —— 这就是「记忆跟随 + diegetic 连续性」。

---

## 架构

```
用户消息 → Orchestrator（确定性管线）
              ├─ 1. Memory      读画像 → 冷启动摘要
              ├─ 2. Tutor       纠错（唯一事实源）+ Profile Extractor（并行）
              ├─ 3. NPC Engine  引用 corrected 生成回复（diegetic 纠错）
              └─ 4. Profile     合并画像增量
           → { reply, correction, profileDelta, archiveCard, trace, profile }
```

四者是**同一应用内的专职模块**，不是四套独立服务（与 PRD「单主控 + 模块」一致）。
Agent 感由右侧 **Trace 面板**实时呈现。

| 文件 | 作用 |
|---|---|
| `lib/orchestrator.ts` | 管线调度、Trace 组装、档案卡生成 |
| `lib/agents/tutor.ts` | 纠错，输出结构化 JSON |
| `lib/agents/npcEngine.ts` | NPC 回复，只引用 Tutor 的 `corrected` |
| `lib/agents/profileExtractor.ts` | 画像提取（Inferred + 薄弱点） |
| `lib/agents/memory.ts` | 冷启动摘要（确定性压缩，零延迟零失败） |
| `lib/npcs.ts` | 2 张人工审校人设卡 |
| `lib/store.ts` | 单用户内存态（挂 globalThis，抗 HMR） |

---

## 真做 vs Mock

**真做**
- 多轮对话 + 人设一致性（人设卡铁律）
- diegetic 纠错 + 课后卡（双层同源）
- 画像提取（Explicit / Inferred + 置信度）+ 实时面板
- 记忆跟随（跨 NPC 冷启动，且不泄露「我记得你」）
- Agent 编排可视化（Trace）
- 档案卡产出（学习 → 档案）
- 语音输入（浏览器内置识别，可选后端 ASR 兜底）

**Mock / 未做**
- 地图（仅伦敦静态入口）、XP / 探索点数（不写入逻辑）
- 档案馆列表与详情（只有单张卡片）
- 注册登录（单用户）、支付、多语言

---

## 语音输入

底部输入框左侧的 🎤 按钮支持**英语语音输入**，自动降级三级：

| 优先级 | 通道 | 触发条件 | 说明 |
|---|---|---|---|
| 1 | **浏览器内置识别**（Web Speech API） | Chrome / Edge | 边说边出字，零后端、零成本 |
| 2 | **后端 ASR**（`POST /api/asr`） | 浏览器不支持内置识别，且配置了 `ASR_BASE_URL` | 录音上传，转写后回填 |
| 3 | 禁用 | 两者都没有 | 按钮变灰，保留键盘输入 |

- 内置识别使用的是浏览器厂商的语音服务，**首次使用需允许麦克风权限**；若提示「浏览器语音服务不可用（网络受限）」，请改用键盘或配置后端 ASR。
- Safari 对 Web Speech 支持不稳定，**建议演示用 Chrome**。
- 语音会把识别结果直接写入输入框，发送前可以手动修改（推荐这样做——纠错功能正是用来处理不完美表达的）。

### 启用后端 ASR（可选）

```bash
# .env.local
ASR_BASE_URL=https://api.groq.com/openai/v1   # 任意 OpenAI 兼容转写端点
ASR_API_KEY=gsk_xxx
ASR_MODEL=whisper-large-v3
ASR_LANGUAGE=en
```

> 注意：DeepSeek 端点**不支持** `/audio/transcriptions`，不要填 DeepSeek 地址。

---

## 关键实现说明

- **JSON 兜底**：`lib/llm.ts` 先试 `response_format: json_object`，失败降级为提示词约束，再用括号配平算法提取 JSON；解析失败时 Tutor 返回「无错误」，对话永不中断。
- **纠错同源**：Tutor 先跑产出 `corrected`，NPC Engine 只引用它，避免「NPC 纠一个错、课后卡纠另一个错」。
- **记忆不泄露**：NPC prompt 铁律 3 明令禁止「你上次说过 / 我记得你」；冷启动摘要只输出事实要点。
- **敏感信息**：Profile Extractor 命中 address / phone / passport / salary 等模式直接丢弃。

---

## 故障排查

| 现象 | 处理 |
|---|---|
| 「缺少 OPENAI_API_KEY」 | 检查 `.env.local`，改完需重启 `npm run dev` |
| 一直「正在输入…」 | 端点不通或超时；检查 `OPENAI_BASE_URL`、`MODEL_NAME` |
| 纠错不出现 | 用「😈 演示错误句」按钮；或检查模型是否支持 JSON 输出 |
| 状态错乱 | 点「重置」或 `POST /api/reset` |
