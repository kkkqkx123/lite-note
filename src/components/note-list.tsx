import { NoteCard } from './note-card'
import type { NoteMetadata } from '@/lib/types/note'

interface NoteListProps {
  notes: NoteMetadata[]
  onTagClick?: (tag: string) => void
}

export function NoteList({ notes, onTagClick }: NoteListProps) {
  if (notes.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">暂无笔记</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} />
      ))}
    </div>
  )
}
