"use client"

import { useEffect, useRef, useState } from "react"
import ArchiveCardView from "./ArchiveCardView"
import ReviewCard from "./ReviewCard"
import VoiceInput from "./VoiceInput"
import type { ChatMessage, Npc } from "@/lib/types"

const SUGGESTIONS = [
  { label: "😈 演示错误句", text: "Yesterday I go to a nice cafe and I meet a friend." },
  { label: "☕ 正常点单", text: "Can I have a flat white, please?" },
  { label: "📷 谈兴趣", text: "I am really interested in photography and travel." },
]

export default function ChatView({
  npc,
  messages,
  onSend,
  busy,
  error,
}: {
  npc: Npc
  messages: ChatMessage[]
  onSend: (text: string) => void
  busy: boolean
  error: string | null
}) {
  const [draft, setDraft] = useState("")
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [stage, setStage] = useState(0)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, busy, stage])

  // 管线是 tutor → npc 的固定顺序，用阶段文案把等待过程讲清楚
  useEffect(() => {
    if (!busy) {
      setStage(0)
      return
    }
    setStage(0)
    const toTutor = setTimeout(() => setStage(1), 900)
    const toNpc = setTimeout(() => setStage(2), 3200)
    return () => {
      clearTimeout(toTutor)
      clearTimeout(toNpc)
    }
  }, [busy])

  function submit() {
    const text = draft.trim()
    if (!text || busy) return
    onSend(text)
    setDraft("")
  }

  return (
    <section className="flex-1 min-w-0 flex flex-col relative">
      {/* 场景背景 */}
      <div
        className="absolute inset-0 opacity-40 pointer-events-none"
        style={{ background: npc.bg }}
      />

      <header className="relative px-5 py-3 border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="h-9 w-9 rounded-full flex items-center justify-center text-base"
            style={{ background: npc.bg }}
          >
            {npc.avatarEmoji}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-stone-900">{npc.name}</span>
              <span className="text-xs text-stone-400">
                {npc.profession} · {npc.age}
              </span>
            </div>
            <div className="text-xs text-stone-500 truncate">
              📍 {npc.city} · {npc.sceneLabel}
            </div>
          </div>
          <div
            className="text-[11px] px-2 py-1 rounded-full border bg-white/70"
            style={{ borderColor: npc.accent, color: npc.accent }}
          >
            🎯 {npc.learningObjective}
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.map((message) => (
          <div key={message.id}>
            <div className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                  message.role === "user"
                    ? "bg-stone-900 text-white rounded-br-sm"
                    : "bg-white text-stone-800 border border-stone-200 rounded-bl-sm shadow-sm"
                }`}
              >
                {message.content}
              </div>
            </div>

            {message.correction && (
              <div className="max-w-[78%] mt-1">
                <ReviewCard correction={message.correction} />
              </div>
            )}
            {message.archiveCard && (
              <div className="max-w-[78%]">
                <ArchiveCardView card={message.archiveCard} />
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm text-stone-400 flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.2s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce [animation-delay:-0.1s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-stone-400 animate-bounce" />
              </span>
              <span>
                {stage === 0
                  ? "🧠 读取画像…"
                  : stage === 1
                    ? "🩺 分析你的表达…"
                    : `🎭 ${npc.name} 正在回复…`}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      <footer className="relative border-t border-stone-200 bg-white/85 backdrop-blur px-4 py-3">
        <div className="flex flex-wrap gap-2 mb-2">
          {SUGGESTIONS.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => setDraft(item.text)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-stone-200 bg-white text-stone-600 hover:border-stone-400"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <VoiceInput
            onText={(text) => setDraft(text)}
            onError={setVoiceError}
            disabled={busy}
          />
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={`用英语和 ${npc.name} 说话，或点麦克风…（Enter 发送）`}
            className="flex-1 resize-none px-3 py-2.5 rounded-xl border border-stone-200 text-sm outline-none focus:border-stone-400 max-h-32"
          />
          <button
            type="button"
            onClick={submit}
            disabled={busy || draft.trim().length === 0}
            className="px-4 py-2.5 rounded-xl bg-stone-900 text-white text-sm font-medium hover:bg-stone-800 disabled:opacity-40"
          >
            发送
          </button>
        </div>

        {voiceError && (
          <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
            {voiceError}
          </div>
        )}
      </footer>
    </section>
  )
}
