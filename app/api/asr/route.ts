import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * 后端语音识别（备选通道）。
 *
 * 默认不启用：DeepSeek 端点不提供 /audio/transcriptions。
 * 配置 ASR_BASE_URL + ASR_API_KEY 后即可对接任意 OpenAI 兼容的转写服务
 * （OpenAI whisper-1、Groq whisper-large-v3、SiliconFlow 等）。
 */
export async function POST(request: Request) {
  const baseUrl = (process.env.ASR_BASE_URL ?? "").replace(/\/$/, "")
  const apiKey = process.env.ASR_API_KEY ?? ""
  const model = process.env.ASR_MODEL ?? "whisper-1"

  if (!baseUrl || !apiKey) {
    return NextResponse.json({ error: "ASR_NOT_CONFIGURED" }, { status: 503 })
  }

  let file: File | null = null
  try {
    const form = await request.formData()
    const value = form.get("audio")
    if (value instanceof File) file = value
  } catch {
    return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 })
  }

  if (!file) {
    return NextResponse.json({ error: "MISSING_AUDIO" }, { status: 400 })
  }

  const upstream = new FormData()
  upstream.append("file", file, file.name || "speech.webm")
  upstream.append("model", model)
  upstream.append("language", process.env.ASR_LANGUAGE ?? "en")

  try {
    const res = await fetch(`${baseUrl}/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `ASR_UPSTREAM_${res.status}`, detail: detail.slice(0, 300) },
        { status: 502 },
      )
    }

    const data = (await res.json()) as { text?: string }
    return NextResponse.json({ text: (data.text ?? "").trim() })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `ASR_REQUEST_FAILED: ${reason}` }, { status: 502 })
  }
}
