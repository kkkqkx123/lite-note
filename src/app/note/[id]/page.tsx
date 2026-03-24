import { notFound } from 'next/navigation'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getNoteDetail, deleteNote } from '@/app/actions/notes'

interface NoteDetailPageProps {
  params: {
    id: string
  }
}

export default async function NoteDetailPage({ params }: NoteDetailPageProps) {
  const result = await getNoteDetail(params.id)

  if (!result.success || !result.data) {
    notFound()
  }

  const note = result.data

  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // Parse tags
  const tags = note.tags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{note.title}</h1>
        
        <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
          <span>创建于 {formatDate(note.created_at)}</span>
          <span>更新于 {formatDate(note.updated_at)}</span>
          <span>{note.views} 次阅读</span>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-4">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <Link href={`/note/edit/${note.id}`}>
            <Button>编辑</Button>
          </Link>
          <form action={async () => {
            'use server'
            await deleteNote(note.id)
          }}>
            <Button type="submit" variant="destructive">
              删除
            </Button>
          </form>
        </div>
      </div>

      {/* Content */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="markdown-body">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {note.content || '*暂无内容*'}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  )
}
