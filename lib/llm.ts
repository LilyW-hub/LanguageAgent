import OpenAI from "openai"

/** 模型名（可换成本地/云端任意兼容端点） */
export const MODEL = process.env.MODEL_NAME ?? "deepseek-v4-flash"

/** 单次请求超时（毫秒） */
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 60000)

let client: OpenAI | null = null

export function llm(): OpenAI {
  if (client) return client
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，请在 .env.local 中配置")
  }
  client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  })
  return client
}

/** 纯文本补全 */
export async function chatText(system: string, user: string): Promise<string> {
  const res = await llm().chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.8,
  })
  return (res.choices[0]?.message?.content ?? "").trim()
}

/**
 * 结构化 JSON 补全：优先用 response_format，失败则降级为提示词约束 + 兜底解析。
 * 解析失败返回 null，绝不抛错打断主流程。
 */
export async function chatJson<T>(system: string, user: string): Promise<T | null> {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ]

  // 第一次：尝试强制 JSON 模式
  try {
    const res = await llm().chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0,
      response_format: { type: "json_object" },
    })
    const parsed = extractJson(res.choices[0]?.message?.content ?? "")
    if (parsed) return parsed as T
  } catch {
    // 端点不支持 response_format 时落到下面
  }

  // 第二次：纯提示词约束
  try {
    const res = await llm().chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0,
    })
    const parsed = extractJson(res.choices[0]?.message?.content ?? "")
    if (parsed) return parsed as T
  } catch {
    // 忽略，交由调用方兜底
  }

  return null
}

/** 从任意文本中提取第一个完整的 JSON 对象（忽略 markdown 围栏、前后废话） */
export function extractJson(raw: string): unknown | null {
  const start = raw.indexOf("{")
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < raw.length; i += 1) {
    const ch = raw[i]

    if (inString) {
      if (escaped) escaped = false
      else if (ch === "\\") escaped = true
      else if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === "{") depth += 1
    if (ch === "}") {
      depth -= 1
      if (depth === 0) {
        try {
          return JSON.parse(raw.slice(start, i + 1))
        } catch {
          return null
        }
      }
    }
  }
  return null
}
