"use client"

import { useCallback, useEffect, useState } from "react"
import ChatView from "@/components/ChatView"
import CitySelect from "@/components/CitySelect"
import Onboarding from "@/components/Onboarding"
import ProfilePanel from "@/components/ProfilePanel"
import TracePanel from "@/components/TracePanel"
import { DEFAULT_NPC_ID, getNpc, listNpcs } from "@/lib/npcs"
import type {
  ChatMessage,
  ChatResponse,
  Level,
  Profile,
  PronunciationFeedback,
  TraceStep,
} from "@/lib/types"

/** 解析一个 SSE 事件块（"event: x\ndata: {...}"） */
function parseSseBlock(block: string): { event: string; data: unknown } | null {
  let event = "message"
  let data = ""

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim()
    else if (line.startsWith("data:")) data += line.slice(5).trim()
  }

  if (!data) return null
  try {
    return { event, data: JSON.parse(data) as unknown }
  } catch {
    return null
  }
}

let messageSeq = 0
function nextId(prefix: string): string {
  messageSeq += 1
  return `${prefix}-${Date.now()}-${messageSeq}`
}

export default function Home() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const [npcId, setNpcId] = useState(DEFAULT_NPC_ID)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [trace, setTrace] = useState<TraceStep[]>([])
  const [tab, setTab] = useState<"profile" | "trace">("profile")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [replay, setReplay] = useState(false)
  const [stage, setStage] = useState(0)

  // 启动即自检模型连通性，避免演示时才发现 Key/端点/模型名不匹配
  useEffect(() => {
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { ok: boolean; error?: string; config?: { baseURL: string; model: string } }) => {
        if (data.ok) {
          setHealthError(null)
          return
        }
        const where = data.config ? `${data.config.baseURL} · ${data.config.model}` : ""
        setHealthError(
          `${data.error ?? "模型不可用"}${where ? `（${where}）` : ""}　—　可点右上角「回放」继续演示`,
        )
      })
      .catch(() => setHealthError("无法访问 /api/health，请确认 dev 服务在运行"))
  }, [])

  const seedOpening = useCallback((id: string) => {
    const npc = getNpc(id)
    setMessages((prev) => {
      if (prev[id] && prev[id]!.length > 0) return prev
      return {
        ...prev,
        [id]: [{ id: nextId("npc"), role: "npc", content: npc.opening }],
      }
    })
  }, [])

  // 刷新页面时恢复服务端已有的 demo 状态
  useEffect(() => {
    let cancelled = false
    fetch("/api/onboard")
      .then((res) => res.json())
      .then((data: { profile: Profile | null; replay?: boolean }) => {
        if (cancelled) return
        if (typeof data.replay === "boolean") setReplay(data.replay)
        if (data.profile) {
          setProfile(data.profile)
          seedOpening(DEFAULT_NPC_ID)
        }
      })
      .catch(() => {
        /* 服务端无状态时正常从 onboarding 开始 */
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [seedOpening])

  async function handleOnboard(data: {
    level: Level
    goal: string
    profession: string
    interests: string[]
  }) {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/onboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (!res.ok) throw new Error(`初始化失败（${res.status}）`)
      const payload = (await res.json()) as { profile: Profile }
      setProfile(payload.profile)
      setMessages({})
      setTrace([])
      seedOpening(DEFAULT_NPC_ID)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function handleSelectNpc(id: string) {
    setNpcId(id)
    seedOpening(id)
  }

  async function handleSend(text: string, pronunciation?: PronunciationFeedback | null) {
    if (!profile || busy) return
    setBusy(true)
    setError(null)
    setStage(0)

    const targetNpc = npcId
    const assistantId = nextId("npc")

    setMessages((prev) => ({
      ...prev,
      [targetNpc]: [
        ...(prev[targetNpc] ?? []),
        {
          id: nextId("user"),
          role: "user",
          content: text,
          pronunciation: pronunciation ?? null,
        },
        // 先放一个空的 NPC 气泡，流式增量往里填
        { id: assistantId, role: "npc", content: "" },
      ],
    }))

    const patchAssistant = (patch: Partial<ChatMessage>) => {
      setMessages((prev) => ({
        ...prev,
        [targetNpc]: (prev[targetNpc] ?? []).map((item) =>
          item.id === assistantId ? { ...item, ...patch } : item,
        ),
      }))
    }

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({ message: text, npcId: targetNpc }),
      })

      if (!res.ok || !res.body) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ? `请求失败：${payload.error}` : `请求失败（${res.status}）`)
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let reply = ""
      let finished = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let boundary = buffer.indexOf("\n\n")
        while (boundary !== -1) {
          const block = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)

          const parsed = parseSseBlock(block)
          if (parsed) {
            if (parsed.event === "stage") {
              const stageName = (parsed.data as { stage?: string }).stage
              setStage(stageName === "tutor" ? 1 : stageName === "npc" ? 2 : 0)
            } else if (parsed.event === "delta") {
              const chunk = (parsed.data as { text?: string }).text ?? ""
              reply += chunk
              patchAssistant({ content: reply })
            } else if (parsed.event === "done") {
              const payload = parsed.data as ChatResponse
              finished = true
              patchAssistant({
                content: payload.reply,
                correction: payload.correction,
                archiveCard: payload.archiveCard,
              })
              setProfile(payload.profile)
              setTrace((prev) => [...prev, ...payload.trace])
              if (payload.correction) setTab("trace")
            } else if (parsed.event === "error") {
              const message = (parsed.data as { error?: string }).error ?? "未知错误"
              throw new Error(message)
            }
          }

          boundary = buffer.indexOf("\n\n")
        }
      }

      if (!finished) throw new Error("连接中断，没有得到完整回复")
    } catch (cause) {
      // 失败时移除空的 NPC 气泡，避免留下空白
      setMessages((prev) => ({
        ...prev,
        [targetNpc]: (prev[targetNpc] ?? []).filter(
          (item) => !(item.id === assistantId && item.content.length === 0),
        ),
      }))
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function toggleReplay() {
    const next = !replay
    setBusy(true)
    try {
      const res = await fetch("/api/mode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replay: next }),
      })
      const data = (await res.json()) as { replay?: boolean; error?: string }
      if (!res.ok) throw new Error(data.error ?? `切换失败（${res.status}）`)
      setReplay(Boolean(data.replay))
      setError(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  async function handleReset() {
    await fetch("/api/reset", { method: "POST" }).catch(() => undefined)
    setProfile(null)
    setMessages({})
    setTrace([])
    setNpcId(DEFAULT_NPC_ID)
    setError(null)
    setTab("profile")
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-stone-400">
        加载中…
      </div>
    )
  }

  const healthBanner = healthError ? (
    <div className="fixed top-0 left-0 right-0 z-50 bg-rose-600 text-white text-xs px-4 py-2 text-center">
      模型未连通：{healthError}
    </div>
  ) : null

  if (!profile) {
    return (
      <>
        {healthBanner}
        <Onboarding onSubmit={handleOnboard} busy={busy} />
      </>
    )
  }

  const npc = getNpc(npcId)
  const archives = Object.values(messages)
    .flat()
    .filter((message) => message.archiveCard)

  return (
    <>
      {healthBanner}
      <div className="h-screen flex overflow-hidden">
      <CitySelect
        npcs={listNpcs()}
        activeId={npcId}
        onSelect={handleSelectNpc}
        archivesCount={archives.length}
      />

      <ChatView
        npc={npc}
        messages={messages[npcId] ?? []}
        onSend={handleSend}
        busy={busy}
        stage={stage}
        error={error}
      />

      <aside className="w-80 shrink-0 border-l border-stone-200 bg-white flex flex-col">
        <div className="flex items-center gap-1 px-2 pt-2 border-b border-stone-200">
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={`px-3 py-2 text-xs rounded-t-lg ${
              tab === "profile"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            画像
          </button>
          <button
            type="button"
            onClick={() => setTab("trace")}
            className={`px-3 py-2 text-xs rounded-t-lg ${
              tab === "trace"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            Agent Trace
          </button>
          <button
            type="button"
            onClick={toggleReplay}
            disabled={busy}
            className={`ml-auto mb-1 text-[11px] px-2 py-1 rounded border transition ${
              replay
                ? "border-amber-400 bg-amber-100 text-amber-800"
                : "border-stone-200 text-stone-500 hover:border-stone-400"
            }`}
            title="回放模式：不调用模型，按剧本演示（现场兜底）"
          >
            {replay ? "▶ 回放中" : "回放"}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="mr-1 mb-1 text-[11px] px-2 py-1 rounded border border-stone-200 text-stone-500 hover:border-stone-400"
            title="清空所有状态，回到 Onboarding"
          >
            重置
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {tab === "profile" ? <ProfilePanel profile={profile} /> : <TracePanel trace={trace} />}
        </div>

        <div className="px-4 py-2 border-t border-stone-200 text-[10px] text-stone-400">
          📜 文明档案员 · demo 版本
        </div>
      </aside>
      </div>
    </>
  )
}
