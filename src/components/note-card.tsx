import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import type { NoteMetadata } from '@/lib/types/note'

interface NoteCardProps {
  note: NoteMetadata
}

export function NoteCard({ note }: NoteCardProps) {
  // Format date
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
  }

  // Parse tags
  const tags = note.tags
    .split(',')
    .map(t => t.trim())
    .filter(t => t.length > 0)

  return (
    <Link href={`/note/${note.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <CardTitle className="text-lg line-clamp-1">{note.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag, index) => (
              <Badge key={index} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>
          <p className="text-sm text-gray-500">
            更新于 {formatDate(note.updated_at)}
          </p>
        </CardContent>
      </Card>
    </Link>
  )
}
