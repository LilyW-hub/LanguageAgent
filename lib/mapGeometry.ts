/** 与 world.svg 的 viewBox 共用尺寸；cover 后底图和标记都使用同一画布。 */
export const WORLD_MAP_WIDTH = 1000
export const WORLD_MAP_HEIGHT = 560

export function coverMapSize(width: number, height: number) {
  const scale = Math.max(width / WORLD_MAP_WIDTH, height / WORLD_MAP_HEIGHT)
  return { width: WORLD_MAP_WIDTH * scale, height: WORLD_MAP_HEIGHT * scale }
}
