import { NextResponse } from "next/server"
import { getProfile, setProfile } from "@/lib/store"
import type { Level, Profile } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LEVELS: Level[] = ["A0", "A1", "A2", "B1", "B2"]

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>

    const level = LEVELS.includes(body.level as Level) ? (body.level as Level) : "A2"
    const goal = typeof body.goal === "string" ? body.goal.trim() : ""
    const profession = typeof body.profession === "string" ? body.profession.trim() : ""
    const interests = Array.isArray(body.interests)
      ? body.interests.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : []

    const profile: Profile = {
      level,
      goal,
      explicit: {
        nativeLanguage: "中文",
        targetLanguage: "英语",
        interests: interests.map((item) => item.trim()),
        ...(profession ? { profession } : {}),
      },
      inferred: [],
      learning: {
        weaknesses: [],
        recentErrors: [],
      },
    }

    setProfile(profile)
    return NextResponse.json({ profile })
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: reason }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ profile: getProfile() })
}
