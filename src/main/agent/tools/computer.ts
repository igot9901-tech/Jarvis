import { execSync, execFileSync } from 'child_process'
import { writeFileSync, readFileSync, unlinkSync, existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { screen } from 'electron'

export interface ImageResult {
  __type: 'image'
  base64: string
  mediaType: 'image/png'
  description: string
}

function tmp(name: string) {
  return join(tmpdir(), `jarvis_${name}_${Date.now()}`)
}

// Run a PowerShell script from a temp file (avoids all quoting nightmares)
function runPS(script: string, timeoutMs = 8000): string {
  const ps1 = tmp('cmd') + '.ps1'
  try {
    writeFileSync(ps1, script, 'utf8')
    return execFileSync('powershell.exe', [
      '-ExecutionPolicy', 'Bypass',
      '-NonInteractive',
      '-File', ps1
    ], { encoding: 'utf8', timeout: timeoutMs }).trim()
  } catch (err: any) {
    throw new Error(err.stdout?.trim() || err.message)
  } finally {
    try { unlinkSync(ps1) } catch {}
  }
}

// ── Screenshot ────────────────────────────────────────────────────────────────
export async function takeScreenshot(): Promise<ImageResult> {
  const outPath = tmp('screenshot') + '.png'
  const { width, height } = screen.getPrimaryDisplay().size

  const script = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap(${width}, ${height})
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen(0, 0, 0, 0, $bmp.Size)
$bmp.Save("${outPath.replace(/\\/g, '\\\\')}", [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "ok"
`
  runPS(script)

  if (!existsSync(outPath)) throw new Error('Screenshot file was not created')
  const buffer = readFileSync(outPath)
  try { unlinkSync(outPath) } catch {}

  return {
    __type: 'image',
    base64: buffer.toString('base64'),
    mediaType: 'image/png',
    description: `Screenshot captured (${width}×${height}). I can now see your screen.`
  }
}

// ── Mouse ─────────────────────────────────────────────────────────────────────
export function moveMouse(x: number, y: number): string {
  runPS(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point(${x}, ${y})
`)
  return `Mouse moved to (${x}, ${y})`
}

export function clickMouse(x: number, y: number, button: 'left' | 'right' | 'middle' = 'left'): string {
  const flags: Record<string, string> = {
    left:   '0x0002, 0, 0, 0, 0); [Win32.User32]::mouse_event(0x0004',
    right:  '0x0008, 0, 0, 0, 0); [Win32.User32]::mouse_event(0x0010',
    middle: '0x0020, 0, 0, 0, 0); [Win32.User32]::mouse_event(0x0040'
  }
  runPS(`
Add-Type -Namespace Win32 -Name User32 -MemberDefinition @'
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int c, int e);
'@
[Win32.User32]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 80
[Win32.User32]::mouse_event(${flags[button]}, 0, 0, 0)
`)
  return `${button} clicked at (${x}, ${y})`
}

export function doubleClick(x: number, y: number): string {
  runPS(`
Add-Type -Namespace Win32 -Name User32 -MemberDefinition @'
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int c, int e);
'@
[Win32.User32]::SetCursorPos(${x}, ${y})
Start-Sleep -Milliseconds 80
[Win32.User32]::mouse_event(0x0002, 0, 0, 0, 0); [Win32.User32]::mouse_event(0x0004, 0, 0, 0, 0)
Start-Sleep -Milliseconds 80
[Win32.User32]::mouse_event(0x0002, 0, 0, 0, 0); [Win32.User32]::mouse_event(0x0004, 0, 0, 0, 0)
`)
  return `Double-clicked at (${x}, ${y})`
}

export function scrollAt(x: number, y: number, direction: 'up' | 'down', clicks = 3): string {
  const delta = direction === 'up' ? 120 * clicks : -120 * clicks
  runPS(`
Add-Type -Namespace Win32 -Name User32 -MemberDefinition @'
  [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
  [DllImport("user32.dll")] public static extern void mouse_event(int f, int x, int y, int c, int e);
'@
[Win32.User32]::SetCursorPos(${x}, ${y})
[Win32.User32]::mouse_event(0x0800, 0, 0, ${delta}, 0)
`)
  return `Scrolled ${direction} at (${x}, ${y})`
}

// ── Keyboard ──────────────────────────────────────────────────────────────────
// SendKeys special chars: % = Alt, ^ = Ctrl, + = Shift, # = Win
// Wrap special keys in braces: {ENTER} {TAB} {ESC} {F5} {UP} {DOWN} {LEFT} {RIGHT} etc.
export function typeText(text: string): string {
  // Escape SendKeys special chars in literal text
  const escaped = text
    .replace(/\{/g, '{{}').replace(/\}/g, '{}}')
    .replace(/%/g, '{%}').replace(/\^/g, '{^}')
    .replace(/\+/g, '{+}').replace(/~/g, '{~}')
    .replace(/\(/g, '{(}').replace(/\)/g, '{)}')

  runPS(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${escaped.replace(/"/g, '`"')}")
`)
  return `Typed: "${text}"`
}

export function pressKey(combo: string): string {
  // combo examples: "^c" (Ctrl+C), "%{F4}" (Alt+F4), "{WIN}" (Win key),
  //                 "^+{ESC}" (Ctrl+Shift+Esc), "{F5}", "^a", "^v"
  runPS(`
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait("${combo.replace(/"/g, '`"')}")
`)
  return `Pressed: ${combo}`
}

// ── Apps & system ─────────────────────────────────────────────────────────────
export function openApp(nameOrPath: string): string {
  runPS(`Start-Process "${nameOrPath.replace(/"/g, '`"')}"`)
  return `Opened: ${nameOrPath}`
}

export function getScreenSize(): string {
  const { width, height } = screen.getPrimaryDisplay().size
  const scaleFactor = screen.getPrimaryDisplay().scaleFactor
  return `Screen: ${width}×${height} (scale ${scaleFactor}x). Use these coordinates for mouse actions.`
}

export function runShellCommand(command: string): string {
  try {
    const out = execSync(command, { encoding: 'utf8', timeout: 15000, shell: 'powershell.exe' })
    return out.trim() || '(no output)'
  } catch (err: any) {
    return `Error: ${err.message}`
  }
}
