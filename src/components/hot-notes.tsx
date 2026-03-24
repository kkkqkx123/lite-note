import Link from 'next/link'
import type { HotNote } from '@/lib/types/note'

interface HotNotesProps {
  notes: HotNote[]
}

export function HotNotes({ notes }: HotNotesProps) {
  if (notes.length === 0) {
    return (
      <div className="text-sm text-gray-500">
        暂无热门笔记
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-900 mb-3">热门笔记</h3>
      {notes.map((note, index) => (
        <Link
          key={note.id}
          href={`/note/${note.id}`}
          className="block p-2 rounded hover:bg-gray-100 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-400">
                {index + 1}
              </span>
              <span className="text-sm text-gray-700 line-clamp-1">
                {note.title}
              </span>
            </div>
            <span className="text-xs text-gray-500">
              {note.views} 次阅读
            </span>
          </div>
        </Link>
      ))}
    </div>
  )
}
