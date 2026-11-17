"use client"

import { useState } from "react"
import type { Npc } from "@/lib/types"

/**
 * NPC 头像：优先使用 public/avatars/<id>.png（把 AI 生成或图库照片放进去即可自动生效），
 * 没有图片时回退到 emoji 徽章，保证任何环境都不会出现破图。
 */
export default function NpcAvatar({
  npc,
  size = 40,
  ring = true,
}: {
  npc: Npc
  size?: number
  ring?: boolean
}) {
  const [imageFailed, setImageFailed] = useState(false)

  const style = { width: size, height: size }

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center ${
        ring ? "ring-2 ring-white shadow-sm" : ""
      }`}
      style={{ ...style, background: npc.bg }}
    >
      {imageFailed ? (
        <span style={{ fontSize: Math.round(size * 0.46), lineHeight: 1 }}>{npc.avatarEmoji}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/avatars/${npc.id}.png`}
          alt={npc.name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      )}
    </div>
  )
}
