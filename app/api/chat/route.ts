import { NextResponse } from "next/server"
import { handleChat } from "@/lib/orchestrator"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { message?: unknown; npcId?: unknown }
    const message = typeof body.message === "string" ? body.message.trim() : ""
    const npcId = typeof body.npcId === "string" ? body.npcId : "maya"

    if (!message) {
      return NextResponse.json({ error: "EMPTY_MESSAGE" }, { status: 400 })
    }

    const result = await handleChat({ message, npcId })
    return NextResponse.json(result)
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    const status = reason === "PROFILE_MISSING" ? 409 : 500
    return NextResponse.json({ error: reason }, { status })
  }
}
