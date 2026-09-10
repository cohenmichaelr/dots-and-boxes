export interface SoundEngine {
  resumeIfNeeded(): void
  playLineDrawn(): void
  playBoxCompleted(): void
  playGameWon(): void
  playGameLost(): void
  setMuted(muted: boolean): void
  isMuted(): boolean
  setMusicEnabled(enabled: boolean): void
  isMusicEnabled(): boolean
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

// A classical-flavored loop built on Pachelbel's Canon chord progression (I-V-vi-iii-IV-I-IV-V,
// public-domain harmony), with a sustained bass note under a rippling, harpsichord-like arpeggio
// for each chord. The whole pattern is scheduled ahead of time and re-scheduled just before it loops.
const CANON_CHORDS: Array<{ bass: number; arpeggio: number[] }> = [
  { bass: 146.83, arpeggio: [293.66, 369.99, 440.0, 369.99] }, // D
  { bass: 110.0, arpeggio: [220.0, 277.18, 329.63, 277.18] }, // A
  { bass: 123.47, arpeggio: [246.94, 293.66, 369.99, 293.66] }, // Bm
  { bass: 92.5, arpeggio: [185.0, 220.0, 277.18, 220.0] }, // F#m
  { bass: 98.0, arpeggio: [196.0, 246.94, 293.66, 246.94] }, // G
  { bass: 146.83, arpeggio: [293.66, 369.99, 440.0, 369.99] }, // D
  { bass: 98.0, arpeggio: [196.0, 246.94, 293.66, 246.94] }, // G
  { bass: 110.0, arpeggio: [220.0, 277.18, 329.63, 277.18] }, // A
]
const CHORD_DURATION_SEC = 1.8
const ARPEGGIO_NOTE_SEC = CHORD_DURATION_SEC / 4

function scheduleMusicLoop(ctx: AudioContext, destination: GainNode, startTime: number): number {
  CANON_CHORDS.forEach((chord, chordIndex) => {
    const chordStart = startTime + chordIndex * CHORD_DURATION_SEC
    playTone(ctx, destination, chord.bass, chordStart, CHORD_DURATION_SEC * 0.95, 0.05, 'sine')
    chord.arpeggio.forEach((freq, noteIndex) => {
      playTone(ctx, destination, freq, chordStart + noteIndex * ARPEGGIO_NOTE_SEC, ARPEGGIO_NOTE_SEC * 0.9, 0.045, 'triangle')
    })
  })
  return CANON_CHORDS.length * CHORD_DURATION_SEC
}

/** Web Audio synthesized sound effects and background music, no external audio files. AudioContext is created lazily on first user gesture. */
export function createSoundEngine(): SoundEngine {
  let ctx: AudioContext | null = null
  let sfxGain: GainNode | null = null
  let musicGain: GainNode | null = null
  let sfxMuted = false
  let musicEnabled = true
  let musicTimeoutId: number | null = null

  function ensureContext(): { ctx: AudioContext; sfxGain: GainNode; musicGain: GainNode } {
    if (!ctx) {
      ctx = new AudioContext()
      sfxGain = ctx.createGain()
      sfxGain.gain.value = 0.8
      sfxGain.connect(ctx.destination)
      musicGain = ctx.createGain()
      musicGain.gain.value = 0.3
      musicGain.connect(ctx.destination)
    }
    return { ctx, sfxGain: sfxGain!, musicGain: musicGain! }
  }

  function stopMusicLoop(): void {
    if (musicTimeoutId !== null) {
      window.clearTimeout(musicTimeoutId)
      musicTimeoutId = null
    }
  }

  function runMusicLoop(): void {
    if (!musicEnabled) return
    const { ctx, musicGain } = ensureContext()
    if (ctx.state === 'suspended') void ctx.resume()
    const startTime = ctx.currentTime + 0.05
    const loopDurationSec = scheduleMusicLoop(ctx, musicGain, startTime)
    musicTimeoutId = window.setTimeout(runMusicLoop, Math.max(0, loopDurationSec - 0.5) * 1000)
  }

  return {
    resumeIfNeeded() {
      const { ctx } = ensureContext()
      if (ctx.state === 'suspended') void ctx.resume()
      if (musicEnabled && musicTimeoutId === null) runMusicLoop()
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
    setMusicEnabled(enabled) {
      musicEnabled = enabled
      if (enabled) {
        runMusicLoop()
      } else {
        stopMusicLoop()
      }
    },
    isMusicEnabled() {
      return musicEnabled
    },
  }
}
