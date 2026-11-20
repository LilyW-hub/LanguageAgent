import { createHash, randomUUID } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"

const inFlight = new Map<string, Promise<string>>()

/** 仅发送角色 ID 的摘要，不向头像服务发送姓名、故事或用户资料。 */
export function npcAvatarUrl(id: string): string {
  const base = (process.env.AVATAR_API_BASE_URL || "https://api.dicebear.com/10.x").replace(/\/+$/, "")
  const url = new URL(base + "/personas/svg")
  url.searchParams.set("seed", createHash("sha256").update(id).digest("hex"))
  url.searchParams.set("backgroundColor", "ecf0f2")
  url.searchParams.set("clothingColor", "6b7d86")
  url.searchParams.set("hairColor", "504640")
  url.searchParams.set("facialHairColor", "504640")
  url.searchParams.set("mouthVariant", "smile")
  return url.toString()
}

function validSvg(svg: string): boolean {
  return svg.length <= 200_000 && /<svg[\s>]/i.test(svg) && /<\/svg>\s*$/i.test(svg) &&
    !/<(?:script|foreignObject)\b|\bon[a-z]+\s*=/i.test(svg)
}

async function fetchAndCache(url: string): Promise<string> {
  const directory = join(process.cwd(), ".data", "avatars")
  const file = join(directory, createHash("sha256").update(url).digest("hex") + ".svg")
  try {
    const cached = await readFile(file, "utf8")
    if (validSvg(cached)) return cached
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.warn("[avatar] cache read failed")
  }
  const response = await fetch(url, { signal: AbortSignal.timeout(8000), cache: "no-store" })
  if (!response.ok) throw new Error("头像服务暂时不可用")
  const svg = await response.text()
  if (!response.headers.get("content-type")?.includes("image/svg+xml") || !validSvg(svg)) {
    throw new Error("头像服务返回的图片无效")
  }
  // 缓存写入失败不阻止本次头像显示。
  try {
    await mkdir(directory, { recursive: true })
    const temporary = file + "." + randomUUID() + ".tmp"
    await writeFile(temporary, svg, { mode: 0o600 })
    await rename(temporary, file)
  } catch { console.warn("[avatar] cache write failed") }
  return svg
}

export async function loadNpcAvatar(id: string): Promise<string> {
  const url = npcAvatarUrl(id)
  const pending = inFlight.get(url)
  if (pending) return pending
  const request = fetchAndCache(url)
  inFlight.set(url, request)
  try { return await request } finally { inFlight.delete(url) }
}
