// Validation result
interface ValidationResult {
  valid: boolean
  error?: string
}

// Validate note title
export function validateTitle(title: string): ValidationResult {
  if (!title || title.trim().length === 0) {
    return { valid: false, error: '标题不能为空' }
  }

  if (title.length > 200) {
    return { valid: false, error: '标题长度不能超过200个字符' }
  }

  return { valid: true }
}

// Validate tags
export function validateTags(tags: string): ValidationResult {
  if (!tags || tags.trim().length === 0) {
    return { valid: true } // Tags are optional
  }

  const tagList = tags.split(',').map(t => t.trim()).filter(t => t.length > 0)

  if (tagList.length > 10) {
    return { valid: false, error: '最多只能添加10个标签' }
  }

  for (const tag of tagList) {
    if (tag.length > 50) {
      return { valid: false, error: '单个标签长度不能超过50个字符' }
    }
  }

  return { valid: true }
}

// Validate note ID (UUID format)
export function validateNoteId(id: string): ValidationResult {
  if (!id || id.trim().length === 0) {
    return { valid: false, error: '笔记ID不能为空' }
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  
  if (!uuidRegex.test(id)) {
    return { valid: false, error: '笔记ID格式无效' }
  }

  return { valid: true }
}

// Validate content
export function validateContent(content: string): ValidationResult {
  if (!content) {
    return { valid: true } // Content can be empty
  }

  if (content.length > 100000) {
    return { valid: false, error: '内容长度不能超过100000个字符' }
  }

  return { valid: true }
}
