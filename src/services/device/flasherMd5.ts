/**
 * Minimal, dependency-free MD5 for ESP32 flash images.
 *
 * esptool-js asks the caller to supply `calculateMD5Hash`; the algorithm is
 * reimplemented here (public-domain reference maths) so the bundle stays free
 * of extra packages. Output is the lowercase hex digest as esptool expects.
 */

const S = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
]

const K = new Uint32Array(64)
for (let i = 0; i < 64; i++) {
  K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 2 ** 32) >>> 0
}

function rotl(x: number, c: number): number {
  return ((x << c) | (x >>> (32 - c))) >>> 0
}

export function md5Hash(data: Uint8Array): string {
  const originalLength = data.length
  // Padding: 0x80, zeros, 8-byte little-endian bit length.
  const paddedLength = (((originalLength + 8) >>> 6) + 1) << 6
  const padded = new Uint8Array(paddedLength)
  padded.set(data)
  padded[originalLength] = 0x80
  const bitLength = originalLength * 8
  for (let i = 0; i < 8; i++) {
    padded[paddedLength - 8 + i] = Math.floor(bitLength / 2 ** (i * 8)) & 0xff
  }

  let a0 = 0x67452301
  let b0 = 0xefcdab89
  let c0 = 0x98badcfe
  let d0 = 0x10325476

  const view = new DataView(padded.buffer)
  for (let chunkStart = 0; chunkStart < paddedLength; chunkStart += 64) {
    const M = new Uint32Array(16)
    for (let i = 0; i < 16; i++) {
      M[i] = view.getUint32(chunkStart + i * 4, true)
    }

    let A = a0
    let B = b0
    let C = c0
    let D = d0

    for (let i = 0; i < 64; i++) {
      let F: number
      let g: number
      if (i < 16) {
        F = (B & C) | (~B & D)
        g = i
      } else if (i < 32) {
        F = (D & B) | (~D & C)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        F = B ^ C ^ D
        g = (3 * i + 5) % 16
      } else {
        F = C ^ (B | ~D)
        g = (7 * i) % 16
      }
      F = (F + A + K[i] + M[g]) >>> 0
      A = D
      D = C
      C = B
      B = (B + rotl(F, S[i])) >>> 0
    }

    a0 = (a0 + A) >>> 0
    b0 = (b0 + B) >>> 0
    c0 = (c0 + C) >>> 0
    d0 = (d0 + D) >>> 0
  }

  const digest = new Uint8Array(16)
  const dv = new DataView(digest.buffer)
  dv.setUint32(0, a0, true)
  dv.setUint32(4, b0, true)
  dv.setUint32(8, c0, true)
  dv.setUint32(12, d0, true)
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
}
