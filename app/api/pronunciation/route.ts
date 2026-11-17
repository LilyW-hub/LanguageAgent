import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * 云端发音评测（预留接口）。
 *
 * 现状：前端默认用「浏览器识别置信度」做本地启发式评估（lib/pronunciation.ts），
 * 不依赖任何音频服务。本接口用于接入真正的音素级评测。
 *
 * 启用方式：配置 PRONUNCIATION_BASE_URL + PRONUNCIATION_API_KEY，
 * 该端点需接受 multipart（audio + expectedText）并返回：
 *   { score: number, clarity: "clear"|"fair"|"unclear", issues: [{word, problem}], overall: string }
 *
 * 可对接：Azure Speech 发音评估、讯飞语音评测、阿里云口语评测、
 * 或任何自建的 wav2vec2 / GOP 评分服务。
 */
export async function POST(request: Request) {
  const baseUrl = (process.env.PRONUNCIATION_BASE_URL ?? "").replace(/\/$/, "")
  const apiKey = process.env.PRONUNCIATION_API_KEY ?? ""

  if (!baseUrl || !apiKey) {
    return NextResponse.json(
      {
        error: "PRONUNCIATION_NOT_CONFIGURED",
        hint: "未配置云端发音评测；前端会使用浏览器置信度做本地评估",
      },
      { status: 503 },
    )
  }

  let audio: File | null = null
  let expectedText = ""

  try {
    const form = await request.formData()
    const value = form.get("audio")
    if (value instanceof File) audio = value
    const text = form.get("expectedText")
    if (typeof text === "string") expectedText = text
  } catch {
    return NextResponse.json({ error: "INVALID_FORM" }, { status: 400 })
  }

  if (!audio) {
    return NextResponse.json({ error: "MISSING_AUDIO" }, { status: 400 })
  }

  const upstream = new FormData()
  upstream.append("audio", audio, audio.name || "speech.webm")
  upstream.append("expectedText", expectedText)
  upstream.append("language", process.env.PRONUNCIATION_LANGUAGE ?? "en-US")

  try {
    const res = await fetch(`${baseUrl}/assess`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: upstream,
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => "")
      return NextResponse.json(
        { error: `PRONUNCIATION_UPSTREAM_${res.status}`, detail: detail.slice(0, 300) },
        { status: 502 },
      )
    }

    const data = (await res.json()) as Record<string, unknown>
    return NextResponse.json({ ...data, source: "cloud" })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: `PRONUNCIATION_FAILED: ${reason}` }, { status: 502 })
  }
}
