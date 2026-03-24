import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import path from 'path'
import fs from 'fs'
import type { NoteDocument } from '@/lib/types/note'

// Documents directory path
const DOCS_DIR = path.join(process.cwd(), 'data', 'docs')

// Ensure docs directory exists
if (!fs.existsSync(DOCS_DIR)) {
  fs.mkdirSync(DOCS_DIR, { recursive: true })
}

// Read document from file
export async function readDocument(id: string): Promise<NoteDocument | null> {
  try {
    const filePath = path.join(DOCS_DIR, `${id}.json`)
    
    if (!fs.existsSync(filePath)) {
      return null
    }

    const adapter = new JSONFile<NoteDocument>(filePath)
    const db = new Low<NoteDocument>(adapter, {} as NoteDocument)
    await db.read()
    
    return db.data
  } catch (error) {
    console.error(`Error reading document ${id}:`, error)
    return null
  }
}

// Write document to file
export async function writeDocument(document: NoteDocument): Promise<boolean> {
  try {
    const filePath = path.join(DOCS_DIR, `${document.id}.json`)
    const adapter = new JSONFile<NoteDocument>(filePath)
    const db = new Low<NoteDocument>(adapter, document)
    await db.write()
    
    return true
  } catch (error) {
    console.error(`Error writing document ${document.id}:`, error)
    return false
  }
}

// Delete document file
export async function deleteDocument(id: string): Promise<boolean> {
  try {
    const filePath = path.join(DOCS_DIR, `${id}.json`)
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }
    
    return true
  } catch (error) {
    console.error(`Error deleting document ${id}:`, error)
    return false
  }
}

// Check if document exists
export function documentExists(id: string): boolean {
  const filePath = path.join(DOCS_DIR, `${id}.json`)
  return fs.existsSync(filePath)
}
