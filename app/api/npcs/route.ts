import { NextResponse } from "next/server"
import { generateNpc, listNpcs } from "@/lib/npcRegistry"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function GET() { return NextResponse.json({ npcs: listNpcs() }) }
export async function POST() {
  try { return NextResponse.json({ npc: await generateNpc() }) }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "角色生成失败" }, {status: 500}) }
}
