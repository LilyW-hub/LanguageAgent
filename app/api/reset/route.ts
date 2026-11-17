import { NextResponse } from "next/server"
import { resetStore } from "@/lib/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** 演示前调用，一键清空 profile / 历史 / 纠错 / Trace */
export async function POST() {
  resetStore()
  return NextResponse.json({ ok: true })
}
