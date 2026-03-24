// API input types
export interface CreateNoteInput {
  title: string
  content: string
  tags?: string
}

export interface UpdateNoteInput {
  id: string
  title?: string
  content?: string
  tags?: string
}

export interface GetNoteListInput {
  search?: string
  tag?: string
  limit?: number
  offset?: number
}

// API output types
export interface CreateNoteOutput {
  success: boolean
  data?: {
    id: string
  }
  error?: string
}

export interface UpdateNoteOutput {
  success: boolean
  error?: string
}

export interface DeleteNoteOutput {
  success: boolean
  error?: string
}

export interface GetNoteListOutput {
  success: boolean
  data?: {
    notes: Array<{
      id: string
      title: string
      tags: string
      created_at: number
      updated_at: number
    }>
    total: number
  }
  error?: string
}

export interface GetNoteDetailOutput {
  success: boolean
  data?: {
    id: string
    title: string
    content: string
    tags: string
    created_at: number
    updated_at: number
    views: number
  }
  error?: string
}

export interface GetHotNotesOutput {
  success: boolean
  data?: Array<{
    id: string
    title: string
    views: number
  }>
  error?: string
}

// Error codes
export enum ErrorCode {
  INVALID_INPUT = 'INVALID_INPUT',
  NOT_FOUND = 'NOT_FOUND',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

// Application error
export interface AppError {
  code: ErrorCode
  message: string
  details?: unknown
}
