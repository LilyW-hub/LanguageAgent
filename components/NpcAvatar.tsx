"use client"

import { useEffect, useState } from "react"
import type { Npc } from "@/lib/types"

/** 所有角色通过 DiceBear 生成独立头像，由本地接口缓存。 */
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
  useEffect(() => setImageFailed(false), [npc.id])

  const style = { width: size, height: size }

  return (
    <div
      className={`shrink-0 rounded-full overflow-hidden flex items-center justify-center ${
        ring ? "ring-2 ring-white shadow-sm" : ""
      }`}
      style={{ ...style, background: "#ecf0f2" }}
    >
      {imageFailed ? (
        <span style={{ fontSize: Math.round(size * 0.46), lineHeight: 1 }}>{npc.name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()}</span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/npcs/${encodeURIComponent(npc.id)}/avatar?v=dicebear-personas-muted-10`}
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
