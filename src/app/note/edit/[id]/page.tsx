import { notFound } from 'next/navigation'
import { NoteEditor } from '@/components/note-editor'
import { getNoteDetail } from '@/app/actions/notes'

interface EditNotePageProps {
  params: Promise<{
    id: string
  }>
}

export default async function EditNotePage({ params }: EditNotePageProps) {
  const { id } = await params
  const result = await getNoteDetail(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const note = result.data

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">编辑笔记</h1>
      <NoteEditor
        noteId={note.id}
        initialTitle={note.title}
        initialContent={note.content}
        initialTags={note.tags}
      />
    </div>
  )
}
