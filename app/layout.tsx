import type { Metadata } from "next"
import Script from "next/script"
import "./globals.css"

export const metadata: Metadata = {
  title: "LanguageAgent · 会教你的世界",
  description: "与当地角色练习英语，收集知识档案，记录生活技能的成长。",
  other: { "page-type": "software", "site-kind": "software" },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html suppressHydrationWarning lang="zh-CN" data-type="software" data-radius="soft" data-motion="live">
      <head>
        <link rel="stylesheet" href="/assets/motion/motion.css" />
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('m-enter');setTimeout(()=>document.documentElement.classList.add('m-enter-done'),2000)" }} />
      </head>
      <body><a href="#main-content" className="skip-link">跳到主要内容</a>{children}<Script src="/assets/motion/motion.js" type="module" strategy="afterInteractive" /></body>
    </html>
  )
}
