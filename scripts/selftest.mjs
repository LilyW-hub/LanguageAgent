#!/usr/bin/env node
/**
 * 端到端自测：把所有已实现的功能真实跑一遍。
 *
 * 用法：
 *   npm run dev            # 另开一个终端，先起服务
 *   node scripts/selftest.mjs
 *
 * 会真实调用模型（若未开回放模式），耗时约 60–120 秒。
 */

const BASE = process.env.SELFTEST_BASE ?? "http://127.0.0.1:3000"

let passed = 0
let failed = 0
const failures = []

function record(name, ok, detail = "") {
  if (ok) {
    passed += 1
    console.log(`  ✅ ${name}${detail ? `  — ${detail}` : ""}`)
  } else {
    failed += 1
    failures.push({ name, detail })
    console.log(`  ❌ ${name}${detail ? `  — ${detail}` : ""}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

async function json(path, init) {
  const res = await fetch(BASE + path, init)
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

const post = (path, payload) =>
  json(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload ?? {}),
  })

async function onboard(payload) {
  return post("/api/onboard", payload ?? {
    level: "A2",
    goal: "travel",
    profession: "designer",
    interests: ["photography"],
  })
}

async function chat(message, npcId = "maya") {
  return post("/api/chat", { message, npcId })
}

/** 消费 SSE，返回 { stages, deltas, done, error, firstDeltaMs, totalMs } */
async function streamChat(message, npcId = "maya") {
  const started = Date.now()
  const res = await fetch(BASE + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message, npcId }),
  })

  if (!res.ok || !res.body) {
    return { status: res.status, stages: [], deltas: [], done: null, error: `HTTP ${res.status}` }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const stages = []
  const deltas = []
  let done = null
  let error = null
  let firstDeltaMs = null

  while (true) {
    const { done: finished, value } = await reader.read()
    if (finished) break
    buffer += decoder.decode(value, { stream: true })

    let index
    while ((index = buffer.indexOf("\n\n")) !== -1) {
      const block = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)

      const event = (block.match(/^event:\s*(.+)$/m) ?? [])[1]?.trim()
      const raw = (block.match(/^data:\s*(.+)$/m) ?? [])[1]
      if (!event || !raw) continue

      let data
      try {
        data = JSON.parse(raw)
      } catch {
        continue
      }

      if (event === "stage") stages.push(data.stage)
      else if (event === "delta") {
        if (firstDeltaMs === null) firstDeltaMs = Date.now() - started
        deltas.push(data.text)
      } else if (event === "done") done = data
      else if (event === "error") error = data.error
    }
  }

  return { status: res.status, stages, deltas, done, error, firstDeltaMs, totalMs: Date.now() - started }
}

const MEMORY_LEAK = /I remember|you told me|last time|we talked|as I said|你上次|还记得你/i

async function main() {
  console.log(`\n自测目标：${BASE}\n${"—".repeat(52)}`)

  // ── 1. 基础连通 ────────────────────────────────
  section("1. 基础连通")
  const page = await fetch(BASE + "/").then((r) => ({ status: r.status, text: r.text() }))
  const pageText = await page.text
  record("首页可访问", page.status === 200, `HTTP ${page.status}`)
  record("页面标题正确", pageText.includes("LanguageAgent"))

  const health = await json("/api/health")
  record("模型连通 /api/health", health.body.ok === true, health.body.ok ? `${health.body.latencyMs}ms` : health.body.error)

  // ── 2. 用户流程 ────────────────────────────────
  section("2. 用户流程（Onboarding）")
  const reset = await post("/api/reset")
  record("重置状态", reset.status === 200)

  const emptyOnboard = await json("/api/onboard")
  record("重置后无画像", emptyOnboard.body.profile === null)

  const created = await onboard()
  record("创建画像", created.status === 200 && created.body.profile?.level === "A2", created.body.profile?.level)

  const readBack = await json("/api/onboard")
  record("画像可读回", readBack.body.profile?.goal === "travel")

  // ── 3. 对话与纠错 ──────────────────────────────
  section("3. 对话与纠错")

  const errTurn = await chat("Yesterday I go to a nice cafe and I meet a friend.")
  record("语法错误句：HTTP 200", errTurn.status === 200)
  record("语法错误句：产出课后卡", Boolean(errTurn.body.correction), errTurn.body.correction?.corrected)
  record(
    "语法错误句：纠对过去时",
    /went/i.test(errTurn.body.correction?.corrected ?? ""),
    errTurn.body.correction?.corrected,
  )
  record("语法错误句：产出档案卡", Boolean(errTurn.body.archiveCard), errTurn.body.archiveCard?.title)
  record("语法错误句：回复非空", (errTurn.body.reply ?? "").length > 0)

  const traceAgents = (errTurn.body.trace ?? []).map((item) => item.agent)
  record(
    "Trace 全链齐全",
    ["memory", "plan", "tutor", "npc", "tool", "profile"].every((agent) =>
      traceAgents.includes(agent),
    ),
    traceAgents.join(" → "),
  )

  const tools = (errTurn.body.trace ?? []).filter((item) => item.agent === "tool")
  record(
    "工具被真实调用",
    tools.length >= 2,
    tools.map((item) => item.action.slice(0, 30)).join(" | "),
  )
  record(
    "工具含复习排程与档案",
    tools.some((item) => item.action.includes("schedule_review")) &&
      tools.some((item) => item.action.includes("create_archive")),
  )
  record(
    "任务计划有步骤",
    Boolean(errTurn.body.plan?.stepLabel) && errTurn.body.plan.total === 4,
    errTurn.body.plan ? `${errTurn.body.plan.stepLabel} ${errTurn.body.plan.index + 1}/4` : "无",
  )

  record(
    "奖励真实发放（XP 与明细）",
    (errTurn.body.rewards?.gained ?? 0) > 0 && (errTurn.body.rewards?.items?.length ?? 0) > 0,
    errTurn.body.rewards
      ? `+${errTurn.body.rewards.gained} (总 ${errTurn.body.rewards.total}) ${errTurn.body.rewards.items.join("、")}`
      : "无",
  )
  record(
    "Trace 记录奖励发放",
    (errTurn.body.trace ?? []).some((item) => item.agent === "reward"),
  )

  const cleanTurn = await chat("Can I have a flat white please?")
  record("正确句子：不误报", cleanTurn.body.correction === null, cleanTurn.body.correction?.corrected)
  record(
    "正确句子：不产生档案",
    cleanTurn.body.archiveCard === null,
    cleanTurn.body.archiveCard?.title,
  )
  record(
    "任务步骤单步推进",
    (cleanTurn.body.plan?.index ?? 0) <= (errTurn.body.plan?.index ?? 0) + 1,
    `${errTurn.body.plan?.index} → ${cleanTurn.body.plan?.index}`,
  )

  const punctTurn = await chat("i like coffee")
  record("纯标点/大小写：不误报", punctTurn.body.correction === null)

  // ── 4. 记忆跟随 / diegetic ─────────────────────
  section("4. 记忆跟随 / diegetic 连续性")
  const leoTurn = await chat("Hello! Nice to meet you.", "leo")
  record("切换 NPC 可对话", leoTurn.status === 200 && (leoTurn.body.reply ?? "").length > 0)
  record(
    "NPC 不泄露「记得你」",
    !MEMORY_LEAK.test(leoTurn.body.reply ?? ""),
    (leoTurn.body.reply ?? "").slice(0, 60),
  )
  record(
    "画像跨 NPC 生效",
    (leoTurn.body.profile?.explicit?.interests ?? []).length > 0 ||
      (leoTurn.body.profile?.inferred ?? []).length > 0,
  )

  // ── 5. 流式输出 ────────────────────────────────
  section("5. 流式输出（SSE）")
  const sse = await streamChat("I am really interested in photography and travel.")
  record("SSE 有 stage 事件", sse.stages.length > 0, sse.stages.join(" → "))
  record("stage 顺序正确", sse.stages[0] === "memory" && sse.stages.includes("npc"), sse.stages.join(" → "))
  record("SSE 有增量文本", sse.deltas.length > 1, `${sse.deltas.length} 段`)
  record("SSE 有 done 事件", Boolean(sse.done))
  record("增量拼接等于最终回复", sse.deltas.join("") === sse.done?.reply)
  record("首字延迟 < 8s", sse.firstDeltaMs !== null && sse.firstDeltaMs < 8000, `${sse.firstDeltaMs}ms`)
  console.log(`      （首字 ${sse.firstDeltaMs}ms，完整 ${sse.totalMs}ms）`)

  const nonStream = await chat("hello there")
  record("非流式 JSON 仍可用", nonStream.status === 200 && Boolean(nonStream.body.reply))

  // ── 6. 回放模式 ────────────────────────────────
  section("6. 回放模式（演示兜底）")
  await post("/api/mode", { replay: true })

  const replayStart = Date.now()
  const replayErr = await chat("Yesterday I go to a nice cafe and I meet a friend.")
  const replayMs = Date.now() - replayStart

  record("回放：错误句出卡", Boolean(replayErr.body.correction), replayErr.body.correction?.corrected)
  record("回放：响应瞬时", replayMs < 1000, `${replayMs}ms`)

  const replayLeo = await chat("Yesterday I go to a gallery and I see a great photo.", "leo")
  record(
    "回放：Leo 剧本命中",
    /saw/i.test(replayLeo.body.correction?.corrected ?? ""),
    replayLeo.body.correction?.corrected,
  )

  const replayInterest = await chat("I think street photography is more interesting than studio work.", "leo")
  record("回放：Leo 观点句式命中", (replayInterest.body.reply ?? "").includes("street"), (replayInterest.body.reply ?? "").slice(0, 50))

  const replayMayaWork = await chat("Do you like working in a coffee shop?")
  record("回放：Maya 工作句式命中", (replayMayaWork.body.reply ?? "").includes("regular"), (replayMayaWork.body.reply ?? "").slice(0, 40))

  await post("/api/mode", { replay: false })
  const modeOff = await json("/api/mode")
  record("退出回放模式", modeOff.body.replay === false)

  // ── 7. 语音相关接口 ────────────────────────────
  section("7. 语音相关接口")
  const asr = await fetch(BASE + "/api/asr", {
    method: "POST",
    body: (() => {
      const form = new FormData()
      form.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "t.webm")
      return form
    })(),
  })
  const asrBody = await asr.json().catch(() => ({}))
  record("ASR 未配置时优雅降级", asr.status === 503 && asrBody.error === "ASR_NOT_CONFIGURED", `HTTP ${asr.status}`)

  const pron = await fetch(BASE + "/api/pronunciation", {
    method: "POST",
    body: (() => {
      const form = new FormData()
      form.append("audio", new Blob([new Uint8Array([1, 2, 3])], { type: "audio/webm" }), "t.webm")
      return form
    })(),
  })
  const pronBody = await pron.json().catch(() => ({}))
  record(
    "发音评测未配置时优雅降级",
    pron.status === 503 && pronBody.error === "PRONUNCIATION_NOT_CONFIGURED",
    `HTTP ${pron.status}`,
  )

  // ── 8. 收尾 ────────────────────────────────────
  section("8. 收尾")
  const finalReset = await post("/api/reset")
  record("重置回干净状态", finalReset.status === 200)

  console.log(`\n${"—".repeat(52)}`)
  console.log(`通过 ${passed}　失败 ${failed}`)

  if (failed > 0) {
    console.log("\n失败项：")
    for (const item of failures) console.log(`  · ${item.name}${item.detail ? ` — ${item.detail}` : ""}`)
    process.exitCode = 1
  } else {
    console.log("全部通过 ✅")
  }
}

main().catch((error) => {
  console.error("\n自测脚本异常：", error)
  process.exitCode = 1
})
