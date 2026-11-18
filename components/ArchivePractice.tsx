"use client"
import { useState } from "react"
type Exercise = { id: string; question: string; goal: string }
type Result = { passed: boolean; feedback: string; example: string }
export default function ArchivePractice({ archiveId }: { archiveId: string }) {
  const [exercise,setExercise]=useState<Exercise|null>(null)
  const [result,setResult]=useState<Result|null>(null)
  const [answer,setAnswer]=useState("")
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState("")
  async function run(action: "start"|"answer") {
    setBusy(true);setError("")
    try {
      const res=await fetch("/api/practice",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(action==="start"?{action,archiveId}:{action,id:exercise?.id,answer})})
      const data=await res.json()
      if(!res.ok) throw new Error(data.error || "请求失败")
      if(action==="start"){setExercise(data);setResult(null);setAnswer("")}else setResult(data)
    }catch(e){setError(e instanceof Error?e.message:"请求失败")}finally{setBusy(false)}
  }
  return <div className="mt-3 border-t border-amber-200 pt-2">
    <button disabled={busy} onClick={()=>run("start")} className="text-xs text-amber-800 underline disabled:opacity-40">{busy?"处理中…":exercise?"再练一道":"针对这个知识点练习"}</button>
    {exercise&&<div className="mt-2 space-y-2">
      <p className="text-[11px] text-amber-800">知识点：{exercise.goal}</p>
      <p className="text-xs text-stone-700 whitespace-pre-wrap">{exercise.question}</p>
      {!result&&<form onSubmit={e=>{e.preventDefault();if(answer.trim()&&!busy)void run("answer")}} className="space-y-2">
        <textarea aria-label="练习答案" value={answer} onChange={e=>setAnswer(e.target.value)} maxLength={2000} placeholder="用英语回答…" className="w-full rounded border border-amber-200 bg-white p-2 text-xs" rows={3}/>
        <button disabled={busy||!answer.trim()} className="rounded bg-amber-800 px-3 py-1.5 text-xs text-white disabled:opacity-40">提交答案</button>
      </form>}
      {result&&<div role="status" className="rounded bg-white/80 p-2 text-xs space-y-1"><strong>{result.passed?"✓ 知识点运用成功":"继续练习"}</strong><p>{result.feedback}</p><p className="text-stone-500">参考表达：{result.example}</p></div>}
    </div>}
    {error&&<p role="alert" className="mt-2 text-xs text-rose-600">{error}</p>}
  </div>
}
