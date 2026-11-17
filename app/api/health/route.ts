import { NextResponse } from "next/server"
import { chatText, describeConfig } from "@/lib/llm"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * 模型连通性自检。演示前先打开 /api/health，
 * 一次请求就能确认 Key / 端点 / 模型名三者是否匹配。
 */
export async function GET() {
  const config = describeConfig()
  const started = Date.now()

  try {
    const reply = await chatText(
      "You are a health check responder. Reply with exactly one word.",
      "Reply with the single word: pong",
    )
    return NextResponse.json({
      ok: true,
      latencyMs: Date.now() - started,
      sample: reply.slice(0, 80),
      config,
    })
  } catch (error) {
    return NextResponse.json({
      ok: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
      config,
    })
  }
}
