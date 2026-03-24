// Note metadata stored in SQLite
export interface NoteMetadata {
  id: string
  title: string
  tags: string // Comma-separated tags
  created_at: number // Unix timestamp
  updated_at: number // Unix timestamp
}

// Note document stored in LowDB
export interface NoteDocument {
  id: string
  content: string // Markdown content
  metadata: {
    word_count: number
    last_edited_by: string
    custom_fields?: Record<string, unknown>
  }
}

// Complete note with metadata and content
export interface Note extends NoteMetadata {
  content: string
  views?: number
}

// Tag information
export interface Tag {
  name: string
  count: number
}

// Hot note for sidebar
export interface HotNote {
  id: string
  title: string
  views: number
}
