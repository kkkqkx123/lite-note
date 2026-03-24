'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createNote, updateNote } from '@/app/actions/notes'

interface NoteEditorProps {
  noteId?: string
  initialTitle?: string
  initialContent?: string
  initialTags?: string
}

export function NoteEditor({
  noteId,
  initialTitle = '',
  initialContent = '',
  initialTags = '',
}: NoteEditorProps) {
  const router = useRouter()
  const [title, setTitle] = useState(initialTitle)
  const [content, setContent] = useState(initialContent)
  const [tags, setTags] = useState(initialTags)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(initialContent)

  // Update preview with debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setPreview(content)
    }, 300)
    return () => clearTimeout(timer)
  }, [content])

  const handleSave = useCallback(async () => {
    if (!title.trim()) {
      alert('请输入标题')
      return
    }

    setSaving(true)
    try {
      if (noteId) {
        // Update existing note
        const result = await updateNote({
          id: noteId,
          title,
          content,
          tags,
        })
        if (result.success) {
          router.push(`/note/${noteId}`)
        } else {
          alert(result.error || '保存失败')
        }
      } else {
        // Create new note
        const result = await createNote({ title, content, tags })
        if (result.success && result.data) {
          router.push(`/note/${result.data.id}`)
        } else {
          alert(result.error || '创建失败')
        }
      }
    } catch (error) {
      console.error('Save error:', error)
      alert('保存失败')
    } finally {
      setSaving(false)
    }
  }, [noteId, title, content, tags, router])

  return (
    <div className="space-y-4">
      {/* Title Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          标题
        </label>
        <Input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="输入笔记标题"
          maxLength={200}
        />
      </div>

      {/* Tags Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          标签（用逗号分隔）
        </label>
        <Input
          type="text"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="例如：技术, React, 教程"
        />
      </div>

      {/* Editor and Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            内容（Markdown）
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="使用 Markdown 格式编写..."
            className="w-full h-96 p-3 border border-gray-300 rounded-md font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
          />
        </div>

        {/* Preview */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            预览
          </label>
          <div className="w-full h-96 p-3 border border-gray-300 rounded-md overflow-y-auto bg-gray-50">
            <div className="markdown-body">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {preview || '*预览区域*'}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? '保存中...' : '保存'}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>
          取消
        </Button>
      </div>
    </div>
  )
}
