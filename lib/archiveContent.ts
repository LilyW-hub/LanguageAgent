import type { ArchiveCard } from "./types"

/** 旧版本把任务推进当作档案保存；这类内容应只显示在成长清单。 */
export function isTaskCompletionArchive(card: Pick<ArchiveCard, "summary">): boolean {
  return /^(?:已)?完成[「“"『].+?[」”"』]这一步的交流[。！!]?$/u.test(card.summary.trim())
}
