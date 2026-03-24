import { randomUUID } from 'crypto'

// Generate UUID v4
export function generateUUID(): string {
  return randomUUID()
}
