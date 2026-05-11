import { Tray, Menu, nativeImage, app } from 'electron'
import zlib from 'zlib'
import { getMainWindow } from './window'

let tray: Tray | null = null

// ── Build a 32x32 RGBA PNG (cyan circle) entirely from Node.js builtins ──────
function crc32(buf: Buffer): number {
  let crc = 0xffffffff
  for (const byte of buf) {
    crc ^= byte
    for (let j = 0; j < 8; j++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  return (crc ^ 0xffffffff) | 0
}

function pngChunk(type: string, data: Buffer): Buffer {
  const tb  = Buffer.from(type, 'ascii')
  const len = Buffer.allocUnsafe(4)
  len.writeUInt32BE(data.length, 0)
  const crcBuf = Buffer.allocUnsafe(4)
  crcBuf.writeInt32BE(crc32(Buffer.concat([tb, data])), 0)
  return Buffer.concat([len, tb, data, crcBuf])
}

function makeIconPng(size = 32): Buffer {
  const cx = size / 2, cy = size / 2, r = size / 2 - 2
  const rows: Buffer[] = []

  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 4, 0)
    row[0] = 0  // PNG filter: None
    for (let x = 0; x < size; x++) {
      const dx = x - cx + 0.5, dy = y - cy + 0.5
      if (dx * dx + dy * dy <= r * r) {
        const i = 1 + x * 4
        row[i] = 0x06; row[i + 1] = 0xb6; row[i + 2] = 0xd4; row[i + 3] = 0xff
      }
    }
    rows.push(row)
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8; ihdr[9] = 6  // 8-bit RGBA

  const compressed = zlib.deflateSync(Buffer.concat(rows), { level: 9 })
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', compressed), pngChunk('IEND', Buffer.alloc(0))])
}

export function createTray(): Tray {
  const icon = nativeImage.createFromBuffer(makeIconPng(32))
  icon.setTemplateImage(false)

  tray = new Tray(icon)
  tray.setToolTip('J.A.R.V.I.S')

  function buildMenu() {
    return Menu.buildFromTemplate([
      {
        label: 'Open Jarvis',
        click: () => {
          const win = getMainWindow()
          if (win) { win.show(); win.focus() }
        }
      },
      {
        label: 'Hide',
        click: () => getMainWindow()?.hide()
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => { app.quit() }
      }
    ])
  }

  tray.setContextMenu(buildMenu())

  // left-click toggles the window
  tray.on('click', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isVisible()) {
      win.hide()
    } else {
      win.show()
      win.focus()
    }
  })

  return tray
}

export function getTray(): Tray | null {
  return tray
}
