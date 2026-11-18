"use client"
import NpcAvatar from "./NpcAvatar"
import type { Npc } from "@/lib/types"

export default function CitySelect({ npcs, activeId, onSelect, archivesCount, onBack, onGenerate, generating, generateError }: {
  npcs: Npc[]; activeId: string; onSelect: (id: string) => void; archivesCount: number
  onGenerate: () => void; generating: boolean; generateError: string | null; onBack: () => void
}) {
  return <aside className="people-panel">
    <div className="people-heading">
      <button type="button" onClick={onBack} className="back-link">← 城市地图</button>
      <h2>伦敦 <span>London</span></h2>
      <p>{npcs.length} 位当地人 · {archivesCount} 条知识档案</p>
    </div>
    <div className="people-list">
      {npcs.map(npc => <button key={npc.id} type="button" aria-pressed={npc.id === activeId} onClick={() => onSelect(npc.id)} className="person-row card">
        <NpcAvatar npc={npc} size={44} />
        <span className="person-details"><strong>{npc.name}</strong><span>{npc.sceneLabel}</span><small>{npc.profession}</small></span>
        <span className="person-arrow" aria-hidden="true">↗</span>
      </button>)}
    </div>
    <div className="people-bottom">
      <button type="button" onClick={onGenerate} disabled={generating} className="btn generate-person">{generating ? "正在生成角色…" : "＋ 认识新角色"}</button>
      <p>{generating ? "正在设计人物背景和生活任务，可先继续练习。" : "生成一位拥有独立背景和任务的当地人。"}</p>
      {generateError && <p role="alert" className="error-text">{generateError}</p>}
    </div>
  </aside>
}
