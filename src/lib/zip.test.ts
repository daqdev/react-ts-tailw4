import { describe, expect, it } from 'vitest'
import { createZip } from './zip'

async function bytesOf(blob: Blob): Promise<Uint8Array> {
  return new Uint8Array(await blob.arrayBuffer())
}

function readU32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

function readU16(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(offset, true)
}

const ENTRIES = [
  { name: 'README.md', content: '# Hello\n' },
  { name: 'Ops/Rotate keys.md', content: 'body\n' },
]

describe('createZip', () => {
  it('starts with a local file header signature', async () => {
    const bytes = await bytesOf(createZip(ENTRIES))
    expect(readU32(bytes, 0)).toBe(0x04034b50)
  })

  it('ends with a central directory record naming every entry', async () => {
    const bytes = await bytesOf(createZip(ENTRIES))
    const end = bytes.length - 22

    expect(readU32(bytes, end)).toBe(0x06054b50)
    expect(readU16(bytes, end + 8)).toBe(ENTRIES.length)
    expect(readU16(bytes, end + 10)).toBe(ENTRIES.length)
  })

  it('stores the file names and contents verbatim', async () => {
    const text = new TextDecoder().decode(await bytesOf(createZip(ENTRIES)))
    expect(text).toContain('README.md')
    expect(text).toContain('Ops/Rotate keys.md')
    expect(text).toContain('# Hello')
    expect(text).toContain('body')
  })

  it('marks names as UTF-8 so accents survive', async () => {
    const bytes = await bytesOf(createZip([{ name: 'Diseño.md', content: 'x' }]))
    // General purpose bit 11 (0x0800) is the UTF-8 filename flag.
    expect(readU16(bytes, 6) & 0x0800).toBe(0x0800)
  })

  it('records the uncompressed size for each entry', async () => {
    const content = 'abcdef'
    const bytes = await bytesOf(createZip([{ name: 'a.md', content }]))
    expect(readU32(bytes, 18)).toBe(content.length)
    expect(readU32(bytes, 22)).toBe(content.length)
  })

  it('produces a valid empty archive', async () => {
    const bytes = await bytesOf(createZip([]))
    expect(bytes.length).toBe(22)
    expect(readU32(bytes, 0)).toBe(0x06054b50)
  })
})
