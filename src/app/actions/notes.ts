'use server'

import { sqlite } from '@/lib/db/sqlite'
import { readDocument, writeDocument, deleteDocument } from '@/lib/db/lowdb'
import { kv } from '@/lib/db/kv'
import { generateUUID } from '@/lib/utils/uuid'
import { validateTitle, validateTags, validateNoteId, validateContent } from '@/lib/utils/validation'
import { logBehavior } from './analytics'
import type {
  CreateNoteInput,
  CreateNoteOutput,
  UpdateNoteInput,
  UpdateNoteOutput,
  DeleteNoteOutput,
  GetNoteListInput,
  GetNoteListOutput,
  GetNoteDetailOutput,
  GetHotNotesOutput
} from '@/lib/types/api'
import type { NoteMetadata, NoteDocument } from '@/lib/types/note'

// Create a new note
export async function createNote(input: CreateNoteInput): Promise<CreateNoteOutput> {
  try {
    // Validate input
    const titleValidation = validateTitle(input.title)
    if (!titleValidation.valid) {
      return { success: false, error: titleValidation.error }
    }

    const tagsValidation = validateTags(input.tags || '')
    if (!tagsValidation.valid) {
      return { success: false, error: tagsValidation.error }
    }

    const contentValidation = validateContent(input.content || '')
    if (!contentValidation.valid) {
      return { success: false, error: contentValidation.error }
    }

    // Generate ID and timestamps
    const id = generateUUID()
    const now = Math.floor(Date.now() / 1000)

    // Insert into SQLite
    sqlite.run(
      'INSERT INTO notes (id, title, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, input.title.trim(), input.tags?.trim() || '', now, now]
    )

    // Write document to LowDB
    const document: NoteDocument = {
      id,
      content: input.content || '',
      metadata: {
        word_count: input.content?.length || 0,
        last_edited_by: 'system',
        custom_fields: {}
      }
    }
    await writeDocument(document)

    // Initialize view count in KV
    await kv.set(`note:${id}:views`, 0)

    return { success: true, data: { id } }
  } catch (error) {
    console.error('Error creating note:', error)
    return { success: false, error: '创建笔记失败' }
  }
}

// Update an existing note
export async function updateNote(input: UpdateNoteInput): Promise<UpdateNoteOutput> {
  try {
    // Validate note ID
    const idValidation = validateNoteId(input.id)
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error }
    }

    // Check if note exists
    const existing = sqlite.get<NoteMetadata>(
      'SELECT * FROM notes WHERE id = ?',
      [input.id]
    )

    if (!existing) {
      return { success: false, error: '笔记不存在' }
    }

    // Validate inputs if provided
    if (input.title !== undefined) {
      const titleValidation = validateTitle(input.title)
      if (!titleValidation.valid) {
        return { success: false, error: titleValidation.error }
      }
    }

    if (input.tags !== undefined) {
      const tagsValidation = validateTags(input.tags)
      if (!tagsValidation.valid) {
        return { success: false, error: tagsValidation.error }
      }
    }

    if (input.content !== undefined) {
      const contentValidation = validateContent(input.content)
      if (!contentValidation.valid) {
        return { success: false, error: contentValidation.error }
      }
    }

    // Update timestamp
    const now = Math.floor(Date.now() / 1000)

    // Update SQLite
    const updates: string[] = []
    const values: unknown[] = []

    if (input.title !== undefined) {
      updates.push('title = ?')
      values.push(input.title.trim())
    }

    if (input.tags !== undefined) {
      updates.push('tags = ?')
      values.push(input.tags.trim())
    }

    updates.push('updated_at = ?')
    values.push(now)
    values.push(input.id)

    sqlite.run(
      `UPDATE notes SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    // Update document if content provided
    if (input.content !== undefined) {
      const document: NoteDocument = {
        id: input.id,
        content: input.content,
        metadata: {
          word_count: input.content.length,
          last_edited_by: 'system',
          custom_fields: {}
        }
      }
      await writeDocument(document)
    }

    return { success: true }
  } catch (error) {
    console.error('Error updating note:', error)
    return { success: false, error: '更新笔记失败' }
  }
}

// Delete a note
export async function deleteNote(id: string): Promise<DeleteNoteOutput> {
  try {
    // Validate note ID
    const idValidation = validateNoteId(id)
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error }
    }

    // Check if note exists
    const existing = sqlite.get<NoteMetadata>(
      'SELECT * FROM notes WHERE id = ?',
      [id]
    )

    if (!existing) {
      return { success: false, error: '笔记不存在' }
    }

    // Delete from SQLite
    sqlite.run('DELETE FROM notes WHERE id = ?', [id])

    // Delete document
    await deleteDocument(id)

    // Delete view count from KV
    await kv.delete(`note:${id}:views`)

    return { success: true }
  } catch (error) {
    console.error('Error deleting note:', error)
    return { success: false, error: '删除笔记失败' }
  }
}

// Get note list
export async function getNoteList(input: GetNoteListInput = {}): Promise<GetNoteListOutput> {
  try {
    const { search, tag, limit = 20, offset = 0 } = input

    // Build query
    let whereClause = '1=1'
    const params: unknown[] = []

    if (search) {
      whereClause += ' AND title LIKE ?'
      params.push(`%${search}%`)
    }

    if (tag) {
      whereClause += ' AND tags LIKE ?'
      params.push(`%${tag}%`)
    }

    // Get total count
    const countResult = sqlite.get<{ count: number }>(
      `SELECT COUNT(*) as count FROM notes WHERE ${whereClause}`,
      params
    )
    const total = countResult?.count || 0

    // Get notes
    const notes = sqlite.all<NoteMetadata>(
      `SELECT * FROM notes WHERE ${whereClause} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    return {
      success: true,
      data: {
        notes,
        total
      }
    }
  } catch (error) {
    console.error('Error getting note list:', error)
    return { success: false, error: '获取笔记列表失败' }
  }
}

// Get note detail
export async function getNoteDetail(id: string): Promise<GetNoteDetailOutput> {
  try {
    // Validate note ID
    const idValidation = validateNoteId(id)
    if (!idValidation.valid) {
      return { success: false, error: idValidation.error }
    }

    // Get metadata from SQLite
    const metadata = sqlite.get<NoteMetadata>(
      'SELECT * FROM notes WHERE id = ?',
      [id]
    )

    if (!metadata) {
      return { success: false, error: '笔记不存在' }
    }

    // Get content from LowDB
    const document = await readDocument(id)
    const content = document?.content || ''

    // Increment view count in KV
    const views = await kv.incr(`note:${id}:views`)

    // 异步记录用户行为日志（不阻塞主流程）
    logBehavior({
      userId: 'anonymous', // 实际应用中应从session获取
      noteId: id,
      actionType: 'view',
      deviceType: 'desktop', // 实际应用中应从UA判断
    }).catch((error) => {
      console.error('[Analytics] Failed to log behavior:', error)
    })

    return {
      success: true,
      data: {
        id: metadata.id,
        title: metadata.title,
        content,
        tags: metadata.tags,
        created_at: metadata.created_at,
        updated_at: metadata.updated_at,
        views
      }
    }
  } catch (error) {
    console.error('Error getting note detail:', error)
    return { success: false, error: '获取笔记详情失败' }
  }
}

// Get hot notes (top 5 by views)
export async function getHotNotes(): Promise<GetHotNotesOutput> {
  try {
    // Get all view count keys
    const keys = await kv.keys('note:*:views')

    // Get view counts
    const viewCounts: Array<{ id: string; views: number }> = []

    for (const key of keys) {
      const views = await kv.get<number>(key)
      if (views !== undefined) {
        // Extract ID from key: note:{id}:views
        const id = key.split(':')[1]
        viewCounts.push({ id, views })
      }
    }

    // Sort by views descending and take top 5
    const top5 = viewCounts
      .sort((a, b) => b.views - a.views)
      .slice(0, 5)

    // Get titles from SQLite
    const hotNotes = []
    for (const item of top5) {
      const metadata = sqlite.get<NoteMetadata>(
        'SELECT title FROM notes WHERE id = ?',
        [item.id]
      )
      if (metadata) {
        hotNotes.push({
          id: item.id,
          title: metadata.title,
          views: item.views
        })
      }
    }

    return { success: true, data: hotNotes }
  } catch (error) {
    console.error('Error getting hot notes:', error)
    return { success: false, error: '获取热榜失败' }
  }
}
