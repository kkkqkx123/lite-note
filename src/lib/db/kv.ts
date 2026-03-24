import Keyv from 'keyv'
import path from 'path'

// Cache file path
const CACHE_PATH = path.join(process.cwd(), 'data', 'cache.json')

// Create Keyv instance with file adapter
const cache = new Keyv({
  store: new Map(),
  namespace: 'litenote',
})

// Simple file-based cache implementation
class FileCache {
  private filePath: string
  private data: Map<string, unknown>

  constructor(filePath: string) {
    this.filePath = filePath
    this.data = new Map()
    this.load()
  }

  private load() {
    try {
      const fs = require('fs')
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8')
        const parsed = JSON.parse(content)
        this.data = new Map(Object.entries(parsed))
      }
    } catch (error) {
      console.error('Error loading cache:', error)
    }
  }

  private save() {
    try {
      const fs = require('fs')
      const obj = Object.fromEntries(this.data)
      fs.writeFileSync(this.filePath, JSON.stringify(obj, null, 2))
    } catch (error) {
      console.error('Error saving cache:', error)
    }
  }

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.data.get(key) as T | undefined
  }

  async set(key: string, value: unknown): Promise<boolean> {
    this.data.set(key, value)
    this.save()
    return true
  }

  async delete(key: string): Promise<boolean> {
    const result = this.data.delete(key)
    this.save()
    return result
  }

  async has(key: string): Promise<boolean> {
    return this.data.has(key)
  }

  async clear(): Promise<void> {
    this.data.clear()
    this.save()
  }

  // Get all keys matching a pattern
  async keys(pattern?: string): Promise<string[]> {
    const allKeys = Array.from(this.data.keys())
    if (!pattern) return allKeys
    
    // Simple pattern matching (supports * wildcard)
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
    return allKeys.filter(key => regex.test(key))
  }

  // Increment a counter
  async incr(key: string, by: number = 1): Promise<number> {
    const current = (this.data.get(key) as number) || 0
    const newValue = current + by
    this.data.set(key, newValue)
    this.save()
    return newValue
  }
}

// Create file cache instance
const fileCache = new FileCache(CACHE_PATH)

// Export cache methods
export const kv = {
  // Get value by key
  async get<T = unknown>(key: string): Promise<T | undefined> {
    return fileCache.get<T>(key)
  },

  // Set value
  async set(key: string, value: unknown): Promise<boolean> {
    return fileCache.set(key, value)
  },

  // Delete key
  async delete(key: string): Promise<boolean> {
    return fileCache.delete(key)
  },

  // Check if key exists
  async has(key: string): Promise<boolean> {
    return fileCache.has(key)
  },

  // Clear all keys
  async clear(): Promise<void> {
    return fileCache.clear()
  },

  // Get all keys matching pattern
  async keys(pattern?: string): Promise<string[]> {
    return fileCache.keys(pattern)
  },

  // Increment counter
  async incr(key: string, by: number = 1): Promise<number> {
    return fileCache.incr(key, by)
  },
}

export default kv
