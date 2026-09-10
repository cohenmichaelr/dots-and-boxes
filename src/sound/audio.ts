export interface SoundEngine {
  resumeIfNeeded(): void
  playLineDrawn(): void
  playBoxCompleted(): void
  playGameWon(): void
  playGameLost(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
}

function playTone(
  ctx: AudioContext,
  destination: GainNode,
  frequency: number,
  startTime: number,
  durationSec: number,
  peakGain = 0.18,
  type: OscillatorType = 'sine',
): void {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, startTime)
  gain.gain.setValueAtTime(0, startTime)
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec)
  oscillator.connect(gain)
  gain.connect(destination)
  oscillator.start(startTime)
  oscillator.stop(startTime + durationSec + 0.02)
}

/** Web Audio synthesized sound effects, no external audio files. AudioContext is created lazily on first user gesture. */
export function createSoundEngine(): SoundEngine {
  let ctx: AudioContext | null = null
  let sfxGain: GainNode | null = null
  let sfxMuted = false

  function ensureContext(): { ctx: AudioContext; sfxGain: GainNode } {
    if (!ctx) {
      ctx = new AudioContext()
      sfxGain = ctx.createGain()
      sfxGain.gain.value = 0.8
      sfxGain.connect(ctx.destination)
    }
    return { ctx, sfxGain: sfxGain! }
  }

  return {
    resumeIfNeeded() {
      const { ctx } = ensureContext()
      if (ctx.state === 'suspended') void ctx.resume()
    },
    playLineDrawn() {
      if (sfxMuted) return
      const { ctx, sfxGain } = ensureContext()
      playTone(ctx, sfxGain, 620, ctx.currentTime, 0.06, 0.1)
    },
    playBoxCompleted() {
      if (sfxMuted) return
      const { ctx, sfxGain } = ensureContext()
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
      gain.connect(sfxGain)
      oscillator.start(now)
      oscillator.stop(now + 0.2)
    },
    playGameWon() {
      if (sfxMuted) return
      const { ctx, sfxGain } = ensureContext()
      const now = ctx.currentTime
      ;[523.25, 659.25, 783.99].forEach((freq, index) => {
        playTone(ctx, sfxGain, freq, now + index * 0.14, 0.35, 0.2)
      })
    },
    playGameLost() {
      if (sfxMuted) return
      const { ctx, sfxGain } = ensureContext()
      const now = ctx.currentTime
      ;[392.0, 349.23, 293.66, 261.63].forEach((freq, index) => {
        playTone(ctx, sfxGain, freq, now + index * 0.22, 0.4, 0.16, 'triangle')
      })
    },
    setMuted(value) {
      sfxMuted = value
    },
    isMuted() {
      return sfxMuted
    },
  }
}
