import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { HotNotes } from './hot-notes'
import type { HotNote } from '@/lib/types/note'

interface SidebarProps {
  hotNotes: HotNote[]
}

export function Sidebar({ hotNotes }: SidebarProps) {
  return (
    <aside className="w-64 border-r border-gray-200 bg-white p-4 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="mb-6">
        <Link href="/" className="text-2xl font-bold text-gray-900">
          LiteNote
        </Link>
        <p className="text-sm text-gray-500 mt-1">轻量级笔记系统</p>
      </div>

      {/* New Note Button */}
      <Link href="/note/new" className="mb-6">
        <Button className="w-full">
          新建笔记
        </Button>
      </Link>

      {/* Hot Notes */}
      <div className="flex-1">
        <HotNotes notes={hotNotes} />
      </div>

      {/* Analytics Link */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <span>📊</span>
          <span>数据分析</span>
        </Link>
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-gray-200">
        <p className="text-xs text-gray-400">
          Powered by Next.js + SQLite + Cassandra
        </p>
      </div>
    </aside>
  )
}
