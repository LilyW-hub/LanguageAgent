/** 世界城市节点（地图上的可探索目的地） */

export interface CityNode {
  id: string
  name: string
  local: string
  country: string
  language: string
  /** 地图百分比位置（对应 world.svg 的 1000×560 画布） */
  x: number
  y: number
  /** 是否可进入 */
  unlocked: boolean
  /** 解锁条件说明 */
  requirement: string
  npcs: string[]
}

/** 演示版本只开放伦敦，其余为「即将开放」——不假装有内容 */
export const CITIES: CityNode[] = [
  {
    id: "london",
    name: "伦敦",
    local: "London",
    country: "英国",
    language: "英语",
    x: 50,
    y: (114 / 560) * 100,
    unlocked: true,
    requirement: "起点",
    npcs: ["Maya", "Leo"],
  },
  {
    id: "newyork",
    name: "纽约",
    local: "New York",
    country: "美国",
    language: "英语",
    x: 29.4,
    y: (157 / 560) * 100,
    unlocked: false,
    requirement: "需在伦敦收集 3 张档案",
    npcs: [],
  },
  {
    id: "paris",
    name: "巴黎",
    local: "Paris",
    country: "法国",
    language: "法语",
    x: 50.7,
    y: (125 / 560) * 100,
    unlocked: false,
    requirement: "需完成伦敦主线",
    npcs: [],
  },
  {
    id: "cairo",
    name: "开罗",
    local: "Cairo",
    country: "埃及",
    language: "阿拉伯语",
    x: 58.7,
    y: (200 / 560) * 100,
    unlocked: false,
    requirement: "即将开放",
    npcs: [],
  },
  {
    id: "tokyo",
    name: "东京",
    local: "Tokyo",
    country: "日本",
    language: "日语",
    x: 88.8,
    y: (177 / 560) * 100,
    unlocked: false,
    requirement: "日语内容包 · 二期",
    npcs: [],
  },
]

export const START_CITY_ID = "london"

export function getCity(id: string): CityNode {
  return CITIES.find((city) => city.id === id) ?? CITIES[0]!
}
