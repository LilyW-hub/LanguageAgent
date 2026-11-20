import { listNpcs } from "@/lib/npcRegistry"
import { loadNpcAvatar } from "@/lib/npcAvatar"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const npc = listNpcs().find(npc => npc.id === params.id)
  if (!npc) return new Response("NPC not found", { status: 404 })
  try {
    return new Response(await loadNpcAvatar(npc.id), {
      headers: {
        "Content-Type": "image/svg+xml; charset=utf-8",
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
      },
    })
  } catch {
    return new Response("头像服务暂时不可用，请稍后刷新", { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
