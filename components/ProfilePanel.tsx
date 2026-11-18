"use client"

import type { Profile } from "@/lib/types"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-stone-400">{title}</div>
      <div className="mt-1.5">{children}</div>
    </div>
  )
}

export default function ProfilePanel({
  profile,
  weaknesses = [],
}: {
  profile: Profile
  weaknesses?: Array<{ target: string; status: string; hits: number; misses: number }>
}) {
  const interests = profile.explicit.interests

  return (
    <div className="p-4 space-y-4 text-sm">
      <Section title="显式 Explicit">
        <div className="space-y-1 text-stone-700">
          <div className="flex justify-between gap-2">
            <span className="text-stone-500">母语 / 目标</span>
            <span>
              {profile.explicit.nativeLanguage} → {profile.explicit.targetLanguage}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-stone-500">水平</span>
            <span>{profile.level}</span>
          </div>
          {profile.explicit.profession && (
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">职业</span>
              <span>{profile.explicit.profession}</span>
            </div>
          )}
          {profile.goal && (
            <div className="flex justify-between gap-2">
              <span className="text-stone-500">目标</span>
              <span className="text-right">{profile.goal}</span>
            </div>
          )}
          <div>
            <span className="text-stone-500">兴趣：</span>
            {interests.length > 0 ? (
              <span className="text-stone-700">{interests.join("、")}</span>
            ) : (
              <span className="text-stone-400">未填</span>
            )}
          </div>
        </div>
      </Section>

      <Section title={`推测 Inferred (${profile.inferred.length})`}>
        {profile.inferred.length === 0 ? (
          <div className="text-xs text-stone-400">暂无 —— 聊几句后自动出现</div>
        ) : (
          <ul className="space-y-1.5">
            {profile.inferred.map((item, index) => (
              <li
                key={`${item.fact}-${index}`}
                className="flex items-start justify-between gap-2 rounded-lg bg-indigo-50/70 border border-indigo-100 px-2.5 py-1.5"
              >
                <span className="text-stone-700 text-xs leading-relaxed">{item.fact}</span>
                <span className="shrink-0 text-[10px] text-indigo-600 tabular-nums">
                  {item.confidence.toFixed(1)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="学习 Learning">
        {weaknesses.length === 0 ? (
          <div className="text-xs text-stone-400">暂无 —— 说错一次后会自动出现在这里</div>
        ) : (
          <ul className="space-y-1.5">
            {weaknesses.map((item) => {
              const meta =
                item.status === "resolved"
                  ? { label: "已掌握", cls: "text-emerald-700 bg-emerald-50 border-emerald-200" }
                  : item.status === "probing"
                    ? { label: "回收中", cls: "text-cyan-700 bg-cyan-50 border-cyan-200" }
                    : { label: "新发现", cls: "text-stone-600 bg-stone-50 border-stone-200" }
              return (
                <li
                  key={item.target}
                  className="flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5"
                >
                  <span className="text-xs text-stone-700">{item.target}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${meta.cls}`}>
                    {meta.label} · 对 {item.hits} / 错 {item.misses}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>

      <div className="text-[10px] text-stone-400 leading-relaxed pt-1 border-t border-stone-100">
        推测信息不会被当作事实；它只用于调整 NPC 的话题与难度。
      </div>
    </div>
  )
}
