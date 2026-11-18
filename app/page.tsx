"use client"

import { useCallback, useEffect, useState } from "react"
import ArchivePanel, { type ArchiveEntry } from "@/components/ArchivePanel"
import ChatView from "@/components/ChatView"
import WorldMap from "@/components/WorldMap"
import CitySelect from "@/components/CitySelect"
import Onboarding from "@/components/Onboarding"
import ProfilePanel from "@/components/ProfilePanel"
import GrowthPanel from "@/components/GrowthPanel"
import { DEFAULT_NPC_ID, getNpc, listNpcs } from "@/lib/npcs"
import type {
  Npc,
  ArchiveCard,
  GrowthRecord,
  ChatMessage,
  ChatResponse,
  Level,
  Profile,
  PronunciationFeedback,
  QuestPlan,
  RewardSummary,
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
  const [npcs, setNpcs] = useState<Npc[]>(listNpcs)
  const [archiveCards, setArchiveCards] = useState<ArchiveCard[]>([])
  const [generating, setGenerating] = useState(false)
  const [generateError, setGenerateError] = useState<string | null>(null)
  const [growth, setGrowth] = useState<GrowthRecord[]>([])
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const [npcId, setNpcId] = useState(DEFAULT_NPC_ID)
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>({})
  const [pane, setPane] = useState<"people" | "notes" | null>(null)
  const [tab, setTab] = useState<"profile" | "growth" | "archive">("profile")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const [stage, setStage] = useState(0)
  const [view, setView] = useState<"map" | "city">("map")
  const [toast, setToast] = useState<string | null>(null)
  const [plans, setPlans] = useState<Record<string, QuestPlan>>({})
  const [rewards, setRewards] = useState<Record<string, RewardSummary>>({})
  const [weaknesses, setWeaknesses] = useState<Array<{ target: string; status: string; hits: number; misses: number }>>([])

  // 面板提供可分享的定位链接，也让刷新后能回到正在使用的工作区。
  useEffect(() => {
    const restoreLocation = () => {
      const destination = window.location.hash.slice(1)
      if (destination === "practice") setView("city")
      else if (destination === "archive" || destination === "growth" || destination === "profile") {
        setView("city")
        setTab(destination)
        setPane("notes")
      } else setView("map")
    }
    restoreLocation()
    window.addEventListener("hashchange", restoreLocation)
    return () => window.removeEventListener("hashchange", restoreLocation)
  }, [])

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
          `${data.error ?? "模型不可用"}${where ? `（${where}）` : ""}`,
        )
      })
      .catch(() => setHealthError("无法访问 /api/health，请确认 dev 服务在运行"))
  }, [])

  const seedOpening = useCallback((id: string, character?: Npc) => {
    const npc = character ?? getNpc(id)
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
      .then((data: { profile: Profile | null; growth?: GrowthRecord[]; npcs?: Npc[]; archives?: ArchiveCard[] }) => {
        if (cancelled) return
        setNpcs(data.npcs ?? listNpcs())
        setArchiveCards(data.archives ?? [])
        setGrowth(data.growth ?? [])
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
      const payload = (await res.json()) as { profile: Profile; growth: GrowthRecord[]; npcs: Npc[]; archives: ArchiveCard[] }
      setNpcs(payload.npcs)
      setArchiveCards(payload.archives)
      setGrowth(payload.growth)
      setProfile(payload.profile)
      setMessages({})
      setPlans({})
      setRewards({})
      setWeaknesses([])
      seedOpening(DEFAULT_NPC_ID)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
    } finally {
      setBusy(false)
    }
  }

  function handleSelectNpc(id: string) {
    setPane(null)
    setNpcId(id)
    seedOpening(id, npcs.find(npc => npc.id === id))
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
              if (payload.archiveCard) {
                const card = payload.archiveCard
                setArchiveCards(prev => card.id && prev.some(item => item.id === card.id) ? prev : [...prev, card])
              }
              setGrowth(payload.growth)
              setProfile(payload.profile)
              if (payload.plan) {
                setPlans((prev) => ({ ...prev, [targetNpc]: payload.plan as QuestPlan }))
              }
              if (payload.rewards) {
                setRewards((prev) => ({ ...prev, [targetNpc]: payload.rewards }))
              }
              if (payload.weaknesses) setWeaknesses(payload.weaknesses)
              if (payload.rewards && payload.rewards.gained > 0) {
                const bits = [
                  payload.archiveCard ? `📜 ${payload.archiveCard.title}` : "",
                  `⭐ +${payload.rewards.gained} XP`,
                ].filter(Boolean)
                setToast(bits.join("　·　"))
                window.setTimeout(() => setToast(null), 3000)
              }
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

  async function handleGenerateNpc() {
    if (generating) return
    setGenerating(true)
    setGenerateError(null)
    try {
      const res = await fetch("/api/npcs", { method: "POST" })
      const data = await res.json() as { npc?: Npc; error?: string }
      if (!res.ok || !data.npc) throw new Error(data.error ?? "角色生成失败")
      const character = data.npc
      setNpcs(prev => [...prev, character])
      setNpcId(character.id)
      seedOpening(character.id, character)
    } catch (cause) {
      setGenerateError(cause instanceof Error ? cause.message : String(cause))
    } finally { setGenerating(false) }
  }

  async function handleReset() {
    await fetch("/api/reset", { method: "POST" }).catch(() => undefined)
    setArchiveCards([])
    setGrowth([])
    setProfile(null)
    setMessages({})
    setPlans({})
    setRewards({})
    setWeaknesses([])
    setNpcId(DEFAULT_NPC_ID)
    setError(null)
    setTab("profile")
    setView("map")
    window.location.hash = ""
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

  const archiveEntries: ArchiveEntry[] = archiveCards.map(card => ({
    card, npcName: npcs.find(npc => npc.id === card.npcId)?.name ?? "当地人",
  }))

  const archives = archiveEntries

  if (view === "map") {
    return (
      <>
        {healthBanner}
        <WorldMap
          peopleCount={npcs.length}
          archives={archives.length}
          xp={Object.values(rewards)[0]?.total ?? 0}
          level={Object.values(rewards)[0]?.level ?? 1}
          onEnterLondon={() => { setView("city"); window.location.hash = "practice" }}
        />
      </>
    )
  }

  const npc = npcs.find(item => item.id === npcId) ?? npcs[0]!
  const progress = growth.find(item => item.npcId === npc.id)
  const activePlan = plans[npcId] ?? (progress ? { index: progress.index, total: npc.quest.steps.length, stepId: npc.quest.steps[progress.index]!.id, stepLabel: npc.quest.steps[progress.index]!.label } : null)

  return (
    <>
      {healthBanner}
      <div className="workspace" data-pane={pane ?? ""}>
      <header className="workspace-toolbar">
        <button type="button" onClick={() => { setView("map"); window.location.hash = "" }} className="brand-name">LanguageAgent<span className="brand-dot">.</span></button>
        <span className="toolbar-context">英语练习 <span>/</span> 伦敦</span>
        <nav aria-label="工作区面板"><button type="button" aria-expanded={pane === "people"} onClick={() => setPane(pane === "people" ? null : "people")}>当地人</button><button type="button" aria-expanded={pane === "notes"} onClick={() => setPane(pane === "notes" ? null : "notes")}>学习笔记</button></nav>
      </header>
      <div className="workspace-body">
      {pane && <button className="panel-backdrop" aria-label="关闭面板" onClick={() => setPane(null)} />}

      <CitySelect
        npcs={npcs}
        generating={generating}
        generateError={generateError}
        onGenerate={handleGenerateNpc}
        activeId={npcId}
        onSelect={handleSelectNpc}
        archivesCount={archives.length}
        onBack={() => { setView("map"); window.location.hash = "" }}
      />

      {toast && (
        <div className="pointer-events-none fixed left-1/2 bottom-24 z-50 -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-5 py-2.5 text-sm font-medium text-amber-900 shadow-lg">
          {toast}
        </div>
      )}

      <ChatView
        npc={npc}
        messages={messages[npcId] ?? []}
        onSend={handleSend}
        busy={busy}
        stage={stage}
        plan={activePlan}
        rewards={rewards[npcId] ?? null}
        error={error}
      />

      <aside className="notes-panel">
        <div className="notes-heading"><h2>学习笔记</h2><button type="button" onClick={() => setPane(null)} className="panel-close" aria-label="关闭学习笔记">✕</button></div>
        <div className="notes-tabs" role="tablist" aria-label="学习笔记">
          <button
            type="button"
            role="tab" aria-selected={tab === "profile"} onClick={() => setTab("profile")}
            className={`px-3 py-2 text-xs rounded-t-lg ${
              tab === "profile"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            了解自己
          </button>
          <button
            type="button"
            role="tab" aria-selected={tab === "archive"} onClick={() => setTab("archive")}
            className={`px-3 py-2 text-xs rounded-t-lg ${
              tab === "archive"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            档案{archiveEntries.length > 0 ? ` ${archiveEntries.length}` : ""}
          </button>
          <button
            type="button"
            role="tab" aria-selected={tab === "growth"} onClick={() => setTab("growth")}
            className={`px-3 py-2 text-xs rounded-t-lg ${
              tab === "growth"
                ? "bg-stone-100 text-stone-900 font-medium"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            成长
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
          {tab === "profile" ? (
            <ProfilePanel profile={profile} weaknesses={weaknesses} />
          ) : tab === "archive" ? (
            <ArchivePanel entries={archiveEntries} />
          ) : (
            <GrowthPanel records={growth} npcs={npcs} />
          )}
        </div>

        <div className="px-4 py-2 border-t border-stone-200 text-[10px] text-stone-400">
          每一段对话，都有迹可循。
        </div>
      </aside>
      </div>
      </div>
    </>
  )
}
