import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "LanguageAgent · 会教你的世界",
  description: "游戏化 AI 语言学习 Agent · 黑客松 Demo",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
