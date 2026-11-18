import { NextResponse } from "next/server"
import { answerPractice, startPractice } from "@/lib/archiveLearning"
export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export async function POST(request: Request) {
  try {
    const body = await request.json()
    if (body.action === "start" && typeof body.archiveId === "string") return NextResponse.json(await startPractice(body.archiveId))
    if (body.action === "answer" && typeof body.id === "string" && typeof body.answer === "string" && body.answer.trim() && body.answer.length <= 2000) return NextResponse.json(await answerPractice(body.id, body.answer.trim()))
    return NextResponse.json({error:"练习请求无效"}, {status:400})
  } catch (error) { return NextResponse.json({error:error instanceof Error ? error.message : "练习失败"}, {status:500}) }
}
