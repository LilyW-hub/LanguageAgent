"use client"

import { useCallback, useEffect, useRef, useState } from "react"

type Mode = "webspeech" | "recorder" | "unsupported"
type Status = "idle" | "listening" | "uploading"

export default function VoiceInput({
  onText,
  onError,
  disabled,
}: {
  /** 识别到的文本（interim 时是实时片段，final 时是整句） */
  onText: (text: string) => void
  /** 语音相关错误，交给父组件展示 */
  onError?: (message: string | null) => void
  disabled?: boolean
}) {
  const [mode, setMode] = useState<Mode>("unsupported")
  const [status, setStatus] = useState<Status>("idle")

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  // 能力探测：优先浏览器内置识别，其次录音上传，最后禁用
  useEffect(() => {
    const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (ctor) {
      setMode("webspeech")
      return
    }
    if (typeof window.MediaRecorder !== "undefined" && "mediaDevices" in navigator) {
      setMode("recorder")
      return
    }
    setMode("unsupported")
  }, [])

  const stopAll = useCallback(() => {
    recognitionRef.current?.abort()
    recognitionRef.current = null
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopAll(), [stopAll])

  function startWebSpeech() {
    const ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!ctor) return

    const recognition = new ctor()
    recognition.lang = "en-US"
    recognition.continuous = false
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onstart = () => {
      setStatus("listening")
      onError?.(null)
    }

    recognition.onresult = (event) => {
      let finalText = ""
      let interim = ""
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const transcript = result?.[0]?.transcript ?? ""
        if (result?.isFinal) finalText += transcript
        else interim += transcript
      }
      if (finalText.trim().length > 0) onText(finalText.trim())
      else if (interim.trim().length > 0) onText(interim.trim())
    }

    recognition.onerror = (event) => {
      const friendly =
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "麦克风权限被拒绝，请在地址栏允许麦克风访问"
          : event.error === "network"
            ? "浏览器语音服务不可用（网络受限），可改用键盘输入"
            : event.error === "no-speech"
              ? "没有听到声音，请再试一次"
              : `语音识别出错：${event.error}`
      onError?.(friendly)
      setStatus("idle")
    }

    recognition.onend = () => {
      setStatus("idle")
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch {
      onError?.("语音识别启动失败，请重试")
      setStatus("idle")
    }
  }

  async function startRecorder() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : ""
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop())
        streamRef.current = null

        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
        if (blob.size === 0) {
          setStatus("idle")
          onError?.("没有录到声音")
          return
        }

        setStatus("uploading")
        onError?.(null)
        try {
          const form = new FormData()
          form.append("audio", blob, "speech.webm")
          const res = await fetch("/api/asr", { method: "POST", body: form })
          const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string }

          if (!res.ok) {
            const message =
              data.error === "ASR_NOT_CONFIGURED"
                ? "未配置后端语音识别；请用 Chrome（内置识别）或配置 ASR_BASE_URL"
                : (data.error ?? `识别失败（${res.status}）`)
            onError?.(message)
            return
          }
          if (data.text && data.text.trim().length > 0) onText(data.text.trim())
          else onError?.("没有识别出内容")
        } catch (cause) {
          onError?.(cause instanceof Error ? cause.message : String(cause))
        } finally {
          setStatus("idle")
        }
      }

      recorder.start()
      recorderRef.current = recorder
      setStatus("listening")
      onError?.(null)
    } catch {
      onError?.("无法访问麦克风，请检查系统/浏览器权限")
      setStatus("idle")
    }
  }

  function toggle() {
    if (disabled) return
    if (status === "listening") {
      recognitionRef.current?.stop()
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop()
      setStatus("idle")
      return
    }
    if (status === "uploading") return

    if (mode === "webspeech") startWebSpeech()
    else if (mode === "recorder") void startRecorder()
  }

  const isDisabled = disabled || mode === "unsupported" || status === "uploading"
  const title =
    mode === "unsupported"
      ? "当前浏览器不支持语音输入，请使用 Chrome / Edge，或直接键盘输入"
      : status === "listening"
        ? "点击停止录音"
        : status === "uploading"
          ? "识别中…"
          : "点击开始说话（英语）"

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isDisabled}
      title={title}
      aria-label={title}
      className={`shrink-0 h-[42px] w-[42px] rounded-xl border text-lg transition flex items-center justify-center ${
        status === "listening"
          ? "bg-rose-500 border-rose-500 text-white animate-pulse"
          : "bg-white border-stone-200 text-stone-600 hover:border-stone-400"
      } ${isDisabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {status === "uploading" ? "…" : "🎤"}
    </button>
  )
}
