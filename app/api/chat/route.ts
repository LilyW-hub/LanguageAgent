import { NextResponse } from "next/server"
import { handleChat, handleChatStream } from "@/lib/orchestrator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * 对话接口。
 *
 * - `Accept: text/event-stream` → SSE 流式：stage / delta / done 三类事件
 * - 其他 → 一次性 JSON（便于 curl 调试与脚本调用）
 */
export async function POST(request: Request) {
  let message = ""
  let npcId = "maya"

  try {
    const body = (await request.json()) as { message?: unknown; npcId?: unknown }
    message = typeof body.message === "string" ? body.message.trim() : ""
    npcId = typeof body.npcId === "string" ? body.npcId : "maya"
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 })
  }

  if (!message) {
    return NextResponse.json({ error: "EMPTY_MESSAGE" }, { status: 400 })
  }

  const wantsStream = (request.headers.get("accept") ?? "").includes("text/event-stream")

  if (!wantsStream) {
    try {
      const result = await handleChat({ message, npcId })
      return NextResponse.json(result)
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      return NextResponse.json({ error: reason }, { status: reason === "PROFILE_MISSING" ? 409 : 500 })
    }
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }

      try {
        for await (const item of handleChatStream({ message, npcId })) {
          send(item.event, item.data)
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)
        send("error", { error: reason })
      } finally {
        closed = true
        try {
          controller.close()
        } catch {
          // 客户端已断开时会抛，忽略
        }
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}
