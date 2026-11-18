"use client"
import { CITIES } from "@/lib/world"
export default function WorldMap({ archives, xp, level, onEnterLondon, peopleCount }: {
  archives: number; xp: number; level: number; peopleCount: number; onEnterLondon: () => void
}) {
  return <main id="main-content" className="city-home"><section className="hero city-screen" data-enter><div className="wrap city-wrap">
    <header className="home-header"><span className="brand-name">LanguageAgent<span className="brand-dot">.</span></span><span>你的语言旅行手记</span></header>
    <div className="city-intro">
      <div className="city-intro-copy"><span className="section-kicker">当前目的地 · 英国</span><h1>从伦敦的一次<br/>日常对话开始。</h1><p>和当地人聊聊生活，在真实场景中练习英语。把学到的表达留在档案里，把完成的任务记在成长里。</p><button className="btn primary-button" onClick={onEnterLondon}>开始练习 <span aria-hidden="true">↗</span></button><div className="home-facts"><span>{peopleCount} 位当地人</span><span>{archives} 条知识档案</span><span>{xp} XP · 等级 {level}</span></div></div>
      <div className="city-art" role="img" aria-label="世界旅行地图，当前开放伦敦"><div className="city-art-title">London<span>英国 · 英语</span></div><img src="/scenes/world.svg" alt="" /><span className="map-pin">● London</span></div>
    </div>
    <footer className="destinations"><span>旅途中的城市</span><div>{CITIES.map(city => <button key={city.id} disabled={!city.unlocked} onClick={onEnterLondon} className={city.unlocked ? "city-current" : ""}>{city.name}<small>{city.unlocked ? "可进入 ↗" : "暂未开放"}</small></button>)}</div></footer>
  </div></section></main>
}
