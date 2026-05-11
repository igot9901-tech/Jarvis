import fs from 'fs'
import path from 'path'
import os from 'os'
import { store } from '../../settings'

function getScopePaths(): string[] {
  const stored = store.get('fileScopePaths') as string[] | undefined
  if (stored && stored.length > 0) return stored
  return [
    path.join(os.homedir(), 'Documents'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Downloads')
  ]
}

function assertInScope(targetPath: string): void {
  const resolved = path.resolve(targetPath)
  const scopes = getScopePaths().map((p) => path.resolve(p))
  const inScope = scopes.some((scope) => resolved.startsWith(scope))
  if (!inScope) {
    throw new Error(
      `Path "${resolved}" is outside your configured file scope. ` +
        `Allowed roots: ${scopes.join(', ')}`
    )
  }
}

export function listDirectory(dirPath: string): string {
  assertInScope(dirPath)
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })
  const lines = entries.map((e) => {
    const icon = e.isDirectory() ? '📁' : '📄'
    const size = e.isFile()
      ? ` (${(fs.statSync(path.join(dirPath, e.name)).size / 1024).toFixed(1)} KB)`
      : ''
    return `${icon} ${e.name}${size}`
  })
  return `Contents of ${dirPath}:\n${lines.join('\n')}`
}

export function readFile(filePath: string): string {
  assertInScope(filePath)
  const stat = fs.statSync(filePath)
  if (stat.size > 5 * 1024 * 1024) {
    throw new Error(`File is too large (${(stat.size / 1024 / 1024).toFixed(1)} MB). Max 5 MB.`)
  }
  const ext = path.extname(filePath).toLowerCase()
  const textExtensions = [
    '.txt', '.md', '.json', '.js', '.ts', '.tsx', '.jsx', '.py', '.rb',
    '.go', '.rs', '.css', '.html', '.xml', '.yaml', '.yml', '.toml',
    '.csv', '.log', '.sh', '.bat', '.ps1', '.env', '.gitignore'
  ]
  if (!textExtensions.includes(ext)) {
    throw new Error(
      `Cannot read binary file "${path.basename(filePath)}". ` +
        `Supported types: ${textExtensions.join(', ')}`
    )
  }
  return fs.readFileSync(filePath, 'utf-8')
}

export function writeFile(filePath: string, content: string): string {
  assertInScope(filePath)
  // backup existing file
  if (fs.existsSync(filePath)) {
    const backupDir = path.join(os.homedir(), '.jarvis', 'backups')
    fs.mkdirSync(backupDir, { recursive: true })
    const backupName = `${path.basename(filePath)}.${Date.now()}.bak`
    fs.copyFileSync(filePath, path.join(backupDir, backupName))
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
  return `Written ${content.length} characters to ${filePath}`
}

export function appendToFile(filePath: string, content: string): string {
  assertInScope(filePath)
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  const separator = fs.existsSync(filePath) ? '\n' : ''
  fs.appendFileSync(filePath, separator + content, 'utf-8')
  return `Appended to ${filePath}`
}

export function createDirectory(dirPath: string): string {
  assertInScope(dirPath)
  fs.mkdirSync(dirPath, { recursive: true })
  return `Created directory: ${dirPath}`
}

export function moveFile(fromPath: string, toPath: string): string {
  assertInScope(fromPath)
  assertInScope(toPath)
  fs.mkdirSync(path.dirname(toPath), { recursive: true })
  fs.renameSync(fromPath, toPath)
  return `Moved ${fromPath} → ${toPath}`
}

export function deleteFile(filePath: string): string {
  assertInScope(filePath)
  const trashDir = path.join(os.homedir(), '.jarvis', 'trash')
  fs.mkdirSync(trashDir, { recursive: true })
  const trashName = `${path.basename(filePath)}.${Date.now()}`
  fs.renameSync(filePath, path.join(trashDir, trashName))
  return `Moved "${path.basename(filePath)}" to Trillion trash (~/.jarvis/trash). Permanently deleted after 30 days.`
}

export function searchFiles(directory: string, query: string): string {
  assertInScope(directory)
  const results: string[] = []
  const q = query.toLowerCase()

  function walk(dir: string, depth = 0): void {
    if (depth > 5) return
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          walk(fullPath, depth + 1)
        } else {
          // match by filename
          if (entry.name.toLowerCase().includes(q)) {
            results.push(fullPath)
            continue
          }
          // match by content for text files
          const ext = path.extname(entry.name).toLowerCase()
          const textExts = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.csv', '.yaml']
          if (textExts.includes(ext)) {
            try {
              const stat = fs.statSync(fullPath)
              if (stat.size < 500 * 1024) {
                const content = fs.readFileSync(fullPath, 'utf-8')
                if (content.toLowerCase().includes(q)) results.push(fullPath)
              }
            } catch {
              // skip unreadable files
            }
          }
        }
        if (results.length >= 20) return
      }
    } catch {
      // skip permission errors
    }
  }

  walk(directory)
  if (results.length === 0) return `No files found matching "${query}" in ${directory}`
  return `Found ${results.length} file(s) matching "${query}":\n${results.join('\n')}`
}
