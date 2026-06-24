/**
 * Synthesizes the rest-timer "done" chime as a small 16-bit PCM WAV.
 * Two ascending sine tones with soft attack/decay so it reads as a pleasant
 * cue rather than a harsh beep. Run with: node scripts/generate-rest-chime.js
 */
const fs = require('fs')
const path = require('path')

const SAMPLE_RATE = 44100
const tones = [
  { freq: 880, start: 0.0, dur: 0.22 }, // A5
  { freq: 1318.51, start: 0.16, dur: 0.34 }, // E6
]
const totalDur = 0.56
const totalSamples = Math.floor(SAMPLE_RATE * totalDur)
const samples = new Float32Array(totalSamples)

for (const { freq, start, dur } of tones) {
  const startSample = Math.floor(start * SAMPLE_RATE)
  const toneSamples = Math.floor(dur * SAMPLE_RATE)
  for (let i = 0; i < toneSamples; i++) {
    const idx = startSample + i
    if (idx >= totalSamples) break
    const t = i / SAMPLE_RATE
    // Quick attack, exponential decay envelope.
    const attack = Math.min(1, t / 0.008)
    const decay = Math.exp(-3.2 * (t / dur))
    const env = attack * decay
    samples[idx] += Math.sin(2 * Math.PI * freq * t) * env * 0.5
  }
}

// Clamp and convert to 16-bit PCM.
const pcm = Buffer.alloc(totalSamples * 2)
for (let i = 0; i < totalSamples; i++) {
  const clamped = Math.max(-1, Math.min(1, samples[i]))
  pcm.writeInt16LE(Math.round(clamped * 32767), i * 2)
}

const byteRate = SAMPLE_RATE * 2
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + pcm.length, 4)
header.write('WAVE', 8)
header.write('fmt ', 12)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20) // PCM
header.writeUInt16LE(1, 22) // mono
header.writeUInt32LE(SAMPLE_RATE, 24)
header.writeUInt32LE(byteRate, 28)
header.writeUInt16LE(2, 32) // block align
header.writeUInt16LE(16, 34) // bits per sample
header.write('data', 36)
header.writeUInt32LE(pcm.length, 40)

const out = Buffer.concat([header, pcm])
const dir = path.join(__dirname, '..', 'assets', 'sounds')
fs.mkdirSync(dir, { recursive: true })
const file = path.join(dir, 'rest-done.wav')
fs.writeFileSync(file, out)
console.log(`Wrote ${file} (${out.length} bytes)`)
