import { writeFile, mkdir } from 'node:fs/promises'
import { deflateSync } from 'node:zlib'

const directory = new URL('../public/', import.meta.url)
await mkdir(directory, { recursive: true })

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1))
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const name = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])))
  return Buffer.concat([length, name, data, crc])
}

function png(size) {
  const inset = Math.round(size * 0.18)
  const edge = size - inset
  const pixels = Buffer.alloc(size * (1 + size * 3))
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const inside = x >= inset && x < edge && y >= inset && y < edge
      const frame = inside && (x < inset + 2 || x >= edge - 2 || y < inset + 2 || y >= edge - 2)
      const bar = x >= inset && x < edge && y >= size / 2 - 1 && y < size / 2 + 1
      const color = frame || bar ? [196, 165, 116] : [18, 20, 24]
      const offset = y * (1 + size * 3) + 1 + x * 3
      pixels.set(color, offset)
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header), chunk('IDAT', deflateSync(pixels)), chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) await writeFile(new URL(`icon-${size}.png`, directory), png(size))
await writeFile(new URL('favicon.svg', directory), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path fill="#121418" d="M0 0h100v100H0z"/><g fill="none" stroke="#c4a574" stroke-width="2"><path d="M18 18h64v64H18zM18 50h64"/></g></svg>\n')
