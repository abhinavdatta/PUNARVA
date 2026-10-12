import { md5Hash } from '../src/services/device/flasherMd5'
import { createHash } from 'node:crypto'

function reference(bytes: Uint8Array): string {
  return createHash('md5').update(bytes).digest('hex')
}

let fails = 0
function check(len: number) {
  const data = new Uint8Array(len)
  for (let i = 0; i < len; i++) data[i] = (i * 37 + len) & 0xff
  const a = md5Hash(data)
  const b = reference(data)
  if (a !== b) {
    fails++
    console.log(`FAIL len=${len}: got ${a} want ${b}`)
  } else {
    console.log(`ok len=${len}`)
  }
}

check(0)
check(1)
check(55)
check(56)
check(57)
check(63)
check(64)
check(65)
check(1000)
check(0x1000)

// Known vector
const abc = md5Hash(new TextEncoder().encode('abc'))
if (abc !== '900150983cd24fb0d6963f7d28e17f72') {
  fails++
  console.log(`FAIL known vector: got ${abc}`)
} else {
  console.log('ok known vector abc')
}

process.exit(fails > 0 ? 1 : 0)
