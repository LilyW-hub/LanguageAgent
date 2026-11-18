import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"

const directory = join(process.cwd(), ".data")
export function readData<T>(name: string, fallback: T): T {
  try { return JSON.parse(readFileSync(join(directory, name + ".json"), "utf8")) as T }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") console.error("读取本地记录失败", name, error)
    return fallback
  }
}
export function writeData(name: string, value: unknown) {
  mkdirSync(directory, { recursive: true })
  const file = join(directory, name + ".json")
  writeFileSync(file + ".tmp", JSON.stringify(value), { mode: 0o600 })
  renameSync(file + ".tmp", file)
}
