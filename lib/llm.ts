import OpenAI from "openai"

/** 模型名（可换成本地/云端任意兼容端点） */
export const MODEL = process.env.MODEL_NAME ?? "deepseek-v4-flash"

/** SDK 级超时（毫秒） */
const TIMEOUT_MS = Number(process.env.LLM_TIMEOUT_MS ?? 60000)

/** 单次请求超时：演示场景下宁可快速失败重试，也别让用户干等 60 秒 */
const REQUEST_TIMEOUT_MS = Number(process.env.LLM_REQUEST_TIMEOUT_MS ?? 25000)

/** 可重试的失败：限流、服务端错误、网络抖动、超时 */
function isRetryable(error: unknown): boolean {
  if (error instanceof OpenAI.APIError) {
    const status = error.status ?? 0
    return status === 429 || status === 0 || status >= 500
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/缺少 OPENAI_API_KEY|占位符|认证失败|无权限/.test(message)) return false
  return /timeout|timed out|ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|fetch failed|aborted|socket hang up/i.test(
    message,
  )
}

/** 轻量重试：2 次尝试，失败间隔 600ms */
async function withRetry<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (!isRetryable(error)) throw error
    await new Promise((resolve) => setTimeout(resolve, 600))
    return await run()
  }
}

let client: OpenAI | null = null

/** Key 是否还是 .env.example 里的占位符 */
export function keyLooksInvalid(key: string | undefined): boolean {
  if (!key) return true
  const trimmed = key.trim()
  if (trimmed.length < 20) return true
  return /^sk-x+$/i.test(trimmed) || /x{4,}/i.test(trimmed)
}

export function describeConfig(): { baseURL: string; model: string; hasKey: boolean; keyLooksInvalid: boolean } {
  const key = process.env.OPENAI_API_KEY
  return {
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    model: MODEL,
    hasKey: Boolean(key),
    keyLooksInvalid: keyLooksInvalid(key),
  }
}

/** 把 SDK / 网络异常翻译成可执行的提示 */
export function describeLlmError(error: unknown): string {
  if (error instanceof OpenAI.APIError) {
    const status = error.status
    const detail =
      (error as unknown as { error?: { message?: string } }).error?.message || error.message

    if (status === 401) return `认证失败（401）：API Key 无效。请检查 .env.local 的 OPENAI_API_KEY`
    if (status === 403) return `无权限（403）：该 Key 没有访问此模型的权限`
    if (status === 404)
      return `端点或模型不存在（404）：请核对 OPENAI_BASE_URL 与 MODEL_NAME 是否属于同一家服务商`
    if (status === 429) return `限流或额度不足（429）：${detail}`
    if (status && status >= 500) return `服务端错误（${status}）：${detail}`
    return `模型调用失败（${status ?? "未知"}）：${detail}`
  }

  const message = error instanceof Error ? error.message : String(error)
  if (/ENOTFOUND|getaddrinfo/i.test(message)) return `域名解析失败：OPENAI_BASE_URL 可能写错（${message}）`
  if (/ECONNREFUSED/i.test(message)) return `连接被拒绝：端点不可达（${message}）`
  if (/timeout|ETIMEDOUT|aborted/i.test(message)) return `请求超时：可调大 LLM_TIMEOUT_MS 或检查网络（${message}）`
  if (/fetch failed/i.test(message)) return `网络请求失败：检查网络或代理（${message}）`
  return message
}

export function llm(): OpenAI {
  if (client) return client

  const config = describeConfig()
  if (!config.hasKey) {
    throw new Error("缺少 OPENAI_API_KEY：请在 .env.local 中配置后重启 dev 服务")
  }
  if (config.keyLooksInvalid) {
    throw new Error(
      "OPENAI_API_KEY 仍是 .env.example 里的占位符（sk-xxx）：请替换为真实 Key 后重启 dev 服务",
    )
  }

  client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    timeout: TIMEOUT_MS,
    maxRetries: 1,
  })
  return client
}

/** 纯文本补全；失败时抛出带可执行提示的错误（不再静默降级） */
export async function chatText(
  system: string,
  user: string,
  options: { maxTokens?: number; temperature?: number; jsonObject?: boolean } = {},
): Promise<string> {
  try {
    const res = await withRetry(() =>
      llm().chat.completions.create(
        {
          model: MODEL,
          ...(options.jsonObject ? { response_format: { type: "json_object" as const } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: options.temperature ?? 0.8,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        },
        { timeout: REQUEST_TIMEOUT_MS },
      ),
    )
    const text = (res.choices[0]?.message?.content ?? "").trim()
    if (text.length > 0) return text

    // 空内容常见于 max_tokens 被推理/截断吃满：去掉上限重试一次
    if (options.maxTokens) {
      const retry = await llm().chat.completions.create(
        {
          model: MODEL,
          ...(options.jsonObject ? { response_format: { type: "json_object" as const } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: options.temperature ?? 0.8,
        },
        { timeout: REQUEST_TIMEOUT_MS },
      )
      const retryText = (retry.choices[0]?.message?.content ?? "").trim()
      if (retryText.length > 0) return retryText
    }

    throw new Error("模型返回了空内容")
  } catch (error) {
    throw new Error(describeLlmError(error))
  }
}

/** 流式文本补全：逐块产出增量，用于 NPC 回复边生成边显示 */
export async function* chatTextStream(
  system: string,
  user: string,
  options: { maxTokens?: number; temperature?: number } = {},
): AsyncGenerator<string> {
  let stream
  try {
    stream = await withRetry(() =>
      llm().chat.completions.create(
        {
          model: MODEL,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: options.temperature ?? 0.8,
          stream: true,
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        },
        { timeout: REQUEST_TIMEOUT_MS },
      ),
    )
  } catch (error) {
    throw new Error(describeLlmError(error))
  }

  for await (const chunk of stream) {
    const delta = chunk.choices?.[0]?.delta?.content
    if (delta && delta.length > 0) yield delta
  }
}

export interface JsonResult<T> {
  data: T | null
  error: string | null
}

/**
 * 结构化 JSON 补全：优先 response_format，失败降级为提示词约束 + 兜底解析。
 * 返回 error 让调用方决定如何呈现（不静默吞掉失败原因）。
 */
export async function chatJson<T>(
  system: string,
  user: string,
  options: { maxTokens?: number } = {},
): Promise<JsonResult<T>> {
  const messages = [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ]

  let lastError: string | null = null

  // 第一次：强制 JSON 模式
  try {
    const res = await withRetry(() =>
      llm().chat.completions.create(
        {
          model: MODEL,
          messages,
          temperature: 0,
          response_format: { type: "json_object" },
          ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        },
        { timeout: REQUEST_TIMEOUT_MS },
      ),
    )
    const parsed = extractJson(res.choices[0]?.message?.content ?? "")
    if (parsed) return { data: parsed as T, error: null }
    lastError = "模型未返回合法 JSON"
  } catch (error) {
    lastError = describeLlmError(error)
    // 配置类错误重试也没用，直接返回
    if (/认证失败|缺少 OPENAI_API_KEY|占位符|无权限/.test(lastError)) {
      return { data: null, error: lastError }
    }
  }

  // 第二次：纯提示词约束
  try {
    const res = await llm().chat.completions.create(
      {
        model: MODEL,
        messages,
        temperature: 0,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      },
      { timeout: REQUEST_TIMEOUT_MS },
    )
    const parsed = extractJson(res.choices[0]?.message?.content ?? "")
    if (parsed) return { data: parsed as T, error: null }
    return { data: null, error: lastError ?? "模型未返回合法 JSON" }
  } catch (error) {
    return { data: null, error: describeLlmError(error) }
  }
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
