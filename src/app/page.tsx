'use client'

import { useState, useEffect } from 'react'
import { NoteList } from '@/components/note-list'
import { SearchBar } from '@/components/search-bar'
import { getNoteList } from './actions/notes'
import type { NoteMetadata } from '@/lib/types/note'

export default function Home() {
  const [notes, setNotes] = useState<NoteMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async (searchQuery?: string) => {
    setLoading(true)
    try {
      const result = await getNoteList({ search: searchQuery })
      if (result.success && result.data) {
        setNotes(result.data.notes)
      }
    } catch (error) {
      console.error('Error loading notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (query: string) => {
    setSearch(query)
    loadNotes(query)
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">我的笔记</h1>
        <SearchBar onSearch={handleSearch} />
      </div>

      {loading ? (
        <div className="text-center py-12">
          <p className="text-gray-500">加载中...</p>
        </div>
      ) : (
        <NoteList notes={notes} />
      )}
    </div>
  )
}
