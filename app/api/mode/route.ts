import { NextResponse } from "next/server"
import { getReplayMode, setReplayMode } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** 读取当前是否处于回放模式 */
export async function GET() {
  return NextResponse.json({ replay: getReplayMode() })
}

/** 切换回放模式：演示兜底用，不调用模型 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { replay?: unknown }
    if (typeof body.replay !== "boolean") {
      return NextResponse.json({ error: "INVALID_BODY" }, { status: 400 })
    }
    setReplayMode(body.replay)
    return NextResponse.json({ replay: getReplayMode() })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: reason }, { status: 400 })
  }
}
