import {
  saveMemory,
  searchMemory,
  listMemories,
  deleteMemory,
  exportMemoryToFile
} from '../memory'

export function toolSaveMemory(
  key: string,
  value: string,
  type: 'fact' | 'preference' | 'client' | 'project' | 'note' = 'fact',
  tags: string[] = []
): string {
  const entry = saveMemory(key, value, type, tags)
  return `Remembered: "${key}" = "${value}" (type: ${type}, id: ${entry.id})`
}

export function toolSearchMemory(query: string): string {
  const results = searchMemory(query)
  if (results.length === 0) return `No memories found matching "${query}".`
  return results
    .map((m) => `[${m.type}] ${m.key}: ${m.value}${m.tags.length ? ` (tags: ${m.tags.join(', ')})` : ''}`)
    .join('\n')
}

export function toolListMemories(type?: string): string {
  const validType = type as 'fact' | 'preference' | 'client' | 'project' | 'note' | undefined
  const results = listMemories(validType)
  if (results.length === 0) return type ? `No memories of type "${type}".` : 'Memory is empty.'
  return results
    .map((m) => `[${m.type}] ${m.key}: ${m.value}`)
    .join('\n')
}

export function toolDeleteMemory(key: string): string {
  const deleted = deleteMemory(key)
  return deleted ? `Deleted memory: "${key}"` : `No memory found with key "${key}".`
}

export function toolExportMemory(): string {
  const path = exportMemoryToFile()
  return `Memory exported to: ${path}`
}
