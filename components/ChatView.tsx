"use client"

import { useEffect, useRef, useState } from "react"
import ArchiveCardView from "./ArchiveCardView"
import NpcAvatar from "./NpcAvatar"
import PersonaCard from "./PersonaCard"
import QuestCard from "./QuestCard"
import PronunciationCard from "./PronunciationCard"
import ReviewCard from "./ReviewCard"
import VoiceInput from "./VoiceInput"
import { assessPronunciation } from "@/lib/pronunciation"
import type { ChatMessage, Npc, PronunciationFeedback, QuestPlan, RewardSummary } from "@/lib/types"

export default function ChatView({
  npc,
  messages,
  onSend,
  busy,
  stage,
  plan,
  rewards,
  error,
}: {
  npc: Npc
  messages: ChatMessage[]
  onSend: (text: string, pronunciation?: PronunciationFeedback | null) => void
  busy: boolean
  /** 真实管线阶段：0=读画像 1=分析表达 2=生成回复 */
  stage: number
  /** 当前任务计划（服务端判定） */
  plan: QuestPlan | null
  /** 累计经验值 */
  rewards: RewardSummary | null
  error: string | null
}) {
  const [draft, setDraft] = useState("")
  const [voiceError, setVoiceError] = useState<string | null>(null)
  const [voiceMeta, setVoiceMeta] = useState<PronunciationFeedback | null>(null)
  const [showPersona, setShowPersona] = useState(false)
  const bottomRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages.length, busy, stage])

  function submit() {
    const text = draft.trim()
    if (!text || busy) return
    onSend(text, voiceMeta)
    setDraft("")
    setVoiceMeta(null)
  }

  useEffect(() => {
    setShowPersona(false)
  }, [npc.id])

  const lastMessage = messages[messages.length - 1]
  const showTyping =
    busy && !(lastMessage?.role === "npc" && lastMessage.content.length > 0)

  return (
    <section className="flex-1 min-w-0 flex flex-col relative">
      {/* 场景背景：渐变打底 + 场景图叠加，离线可用 */}
      <div className="absolute inset-0 pointer-events-none" style={{ background: npc.bg }} />
      <div
        className="absolute inset-0 pointer-events-none opacity-25 bg-cover bg-center"
        style={{ backgroundImage: `url(${npc.sceneImage})` }}
      />

      <header className="relative px-5 py-3 border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="flex items-center gap-3">
          <NpcAvatar npc={npc} size={38} />
          <button
            type="button"
            onClick={() => setShowPersona((prev) => !prev)}
            className="min-w-0 flex-1 text-left group"
            title="查看人物介绍"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium text-stone-900 group-hover:underline">{npc.name}</span>
              <span className="text-xs text-stone-400">
                {npc.profession} · {npc.age}
              </span>
              <span className="text-[10px] text-stone-400">
                {showPersona ? "▴" : "ⓘ 人物"}
              </span>
            </div>
            <div className="text-xs text-stone-500 truncate">
              📍 {npc.city} · {npc.sceneLabel}
            </div>
          </button>
          <div className="flex items-center gap-2">
            {rewards && (
              <div className="text-[11px] px-2 py-1 rounded-full border border-amber-300 bg-amber-50 text-amber-800 tabular-nums">
                ⭐ {rewards.total} XP · Lv.{rewards.level}
              </div>
            )}
            <div
              className="text-[11px] px-2 py-1 rounded-full border bg-white/70"
              style={{ borderColor: npc.accent, color: npc.accent }}
            >
              🎯 {npc.learningObjective}
            </div>
          </div>
        </div>
      </header>

      <QuestCard key={npc.id} npc={npc} plan={plan} />

      {showPersona && (
        <div className="relative">
          <PersonaCard npc={npc} onClose={() => setShowPersona(false)} />
        </div>
      )}

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

            {message.pronunciation && (
              <div className="flex justify-end">
                <div className="max-w-[78%]">
                  <PronunciationCard feedback={message.pronunciation} />
                </div>
              </div>
            )}

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

        {showTyping && (
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
                    ? "🩺 理解你的表达…"
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
          {npc.suggestions.map((item) => (
            <button
              key={`${npc.id}-${item.label}`}
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
            onText={(text, meta) => {
              setDraft(text)
              setVoiceMeta(
                meta
                  ? assessPronunciation({
                      transcript: text,
                      confidence: meta.confidence,
                      alternatives: meta.alternatives,
                    })
                  : null,
              )
            }}
            onError={setVoiceError}
            disabled={busy}
          />
          <textarea
            value={draft}
            onChange={(event) => {
              setDraft(event.target.value)
              if (voiceMeta) setVoiceMeta(null)
            }}
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
