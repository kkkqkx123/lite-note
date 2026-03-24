import { NoteEditor } from '@/components/note-editor'

export default function NewNotePage() {
  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">新建笔记</h1>
      <NoteEditor />
    </div>
  )
}
