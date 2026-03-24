import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Sidebar } from '@/components/sidebar'
import { getHotNotes } from './actions/notes'
import { bootstrap } from '@/lib/bootstrap'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LiteNote - 轻量级笔记系统',
  description: '一个专注于快速记录与知识关联的本地化笔记应用',
}

// 初始化应用（仅执行一次）
let bootstrapPromise: Promise<void> | null = null

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 启动时初始化应用
  if (!bootstrapPromise) {
    bootstrapPromise = bootstrap()
  }
  await bootstrapPromise

  // Get hot notes for sidebar
  const hotNotesResult = await getHotNotes()
  const hotNotes = hotNotesResult.success && hotNotesResult.data ? hotNotesResult.data : []

  return (
    <html lang="zh-CN">
      <body className={inter.className}>
        <div className="flex h-screen">
          <Sidebar hotNotes={hotNotes} />
          <main className="flex-1 overflow-y-auto bg-gray-50">
            {children}
          </main>
        </div>
      </body>
    </html>
  )
}
