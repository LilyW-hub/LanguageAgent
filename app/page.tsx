"use client"

import { useCallback, useEffect, useState } from "react"
import ChatView from "@/components/ChatView"
import CitySelect from "@/components/CitySelect"
import Onboarding from "@/components/Onboarding"
import ProfilePanel from "@/components/ProfilePanel"
import TracePanel from "@/components/TracePanel"
import { DEFAULT_NPC_ID, getNpc, listNpcs } from "@/lib/npcs"
import type { ChatMessage, ChatResponse, Level, Profile, TraceStep } from "@/lib/types"

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
      .then((data: { profile: Profile | null }) => {
        if (cancelled) return
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

  async function handleSend(text: string) {
    if (!profile || busy) return
    setBusy(true)
    setError(null)

    const targetNpc = npcId
    setMessages((prev) => ({
      ...prev,
      [targetNpc]: [
        ...(prev[targetNpc] ?? []),
        { id: nextId("user"), role: "user", content: text },
      ],
    }))

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, npcId: targetNpc }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ? `请求失败：${payload.error}` : `请求失败（${res.status}）`)
      }

      const payload = (await res.json()) as ChatResponse

      setMessages((prev) => ({
        ...prev,
        [targetNpc]: [
          ...(prev[targetNpc] ?? []),
          {
            id: nextId("npc"),
            role: "npc",
            content: payload.reply,
            correction: payload.correction,
            archiveCard: payload.archiveCard,
          },
        ],
      }))

      setProfile(payload.profile)
      setTrace((prev) => [...prev, ...payload.trace])
      if (payload.correction) setTab("trace")
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

  if (!profile) {
    return <Onboarding onSubmit={handleOnboard} busy={busy} />
  }

  const npc = getNpc(npcId)
  const archives = Object.values(messages)
    .flat()
    .filter((message) => message.archiveCard)

  return (
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
            onClick={handleReset}
            className="ml-auto mr-1 mb-1 text-[11px] px-2 py-1 rounded border border-stone-200 text-stone-500 hover:border-stone-400"
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
  )
}
