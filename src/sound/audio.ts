export interface SoundEngine {
  resumeIfNeeded(): void
  playLineDrawn(): void
  playBoxCompleted(): void
  playGameWon(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
}

function playTone(
  ctx: AudioContext,
  masterGain: GainNode,
  frequency: number,
  startTime: number,
  durationSec: number,
  peakGain = 0.18,
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec)
  oscillator.connect(gain)
  gain.connect(masterGain)
  oscillator.start(startTime)
  oscillator.stop(startTime + durationSec + 0.02)
}

/** Web Audio synthesized sound effects, no external audio files. AudioContext is created lazily on first user gesture. */
export function createSoundEngine(): SoundEngine {
  let ctx: AudioContext | null = null
  let masterGain: GainNode | null = null
  let muted = false

  function ensureContext(): { ctx: AudioContext; masterGain: GainNode } | null {
    if (muted) return null
    if (!ctx) {
      ctx = new AudioContext()
      masterGain = ctx.createGain()
      masterGain.gain.value = 0.8
      masterGain.connect(ctx.destination)
    }
    return { ctx, masterGain: masterGain! }
  }

  return {
    resumeIfNeeded() {
      const created = ensureContext()
      if (created && created.ctx.state === 'suspended') void created.ctx.resume()
    },
    playLineDrawn() {
      const created = ensureContext()
      if (!created) return
      const { ctx, masterGain } = created
      playTone(ctx, masterGain, 620, ctx.currentTime, 0.06, 0.1)
    },
    playBoxCompleted() {
      const created = ensureContext()
      if (!created) return
      const { ctx, masterGain } = created
      const oscillator = ctx.createOscillator()
      const gain = ctx.createGain()
      const now = ctx.currentTime
      oscillator.type = 'triangle'
      oscillator.frequency.setValueAtTime(440, now)
      oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.12)
      gain.gain.setValueAtTime(0, now)
      gain.gain.linearRampToValueAtTime(0.22, now + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.18)
      oscillator.connect(gain)
      gain.connect(masterGain)
      oscillator.start(now)
      oscillator.stop(now + 0.2)
    },
    playGameWon() {
      const created = ensureContext()
      if (!created) return
      const { ctx, masterGain } = created
      const now = ctx.currentTime
      ;[523.25, 659.25, 783.99].forEach((freq, index) => {
        playTone(ctx, masterGain, freq, now + index * 0.14, 0.35, 0.2)
      })
    },
    setMuted(value) {
      muted = value
    },
    isMuted() {
      return muted
    },
  }
}
