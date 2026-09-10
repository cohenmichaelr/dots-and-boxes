import { DEFAULT_COLORS } from '../game'

const FIREWORK_BURSTS = [
  { delayMs: 0, xPercent: 30, yPercent: 35 },
  { delayMs: 280, xPercent: 68, yPercent: 45 },
  { delayMs: 520, xPercent: 50, yPercent: 25 },
]
const PARTICLES_PER_BURST = 14
const PARTICLE_DURATION_MS = 900
const EFFECT_CLEANUP_MS = FIREWORK_BURSTS[FIREWORK_BURSTS.length - 1].delayMs + PARTICLE_DURATION_MS + 200

/** Confetti-style particle bursts for a win, built from the game's own player colors. */
export function playFireworks(container: HTMLElement): void {
  const layer = document.createElement('div')
  layer.className = 'effect-layer'

  for (const burst of FIREWORK_BURSTS) {
    for (let i = 0; i < PARTICLES_PER_BURST; i++) {
      const angle = (i / PARTICLES_PER_BURST) * Math.PI * 2 + Math.random() * 0.4
      const distance = 60 + Math.random() * 90
      const particle = document.createElement('span')
      particle.className = 'firework-particle'
      particle.style.left = `${burst.xPercent}%`
      particle.style.top = `${burst.yPercent}%`
      particle.style.setProperty('--dx', `${Math.cos(angle) * distance}px`)
      particle.style.setProperty('--dy', `${Math.sin(angle) * distance}px`)
      particle.style.animationDelay = `${burst.delayMs}ms`
      particle.style.background = DEFAULT_COLORS[i % DEFAULT_COLORS.length]
      layer.append(particle)
    }
  }

  container.prepend(layer)
  setTimeout(() => layer.remove(), EFFECT_CLEANUP_MS)
}

const RAINDROP_COUNT = 16
const RAIN_DURATION_MS = 2200

/** A gentle rain-shower overlay for a loss. */
export function playSadRain(container: HTMLElement): void {
  const layer = document.createElement('div')
  layer.className = 'effect-layer'

  for (let i = 0; i < RAINDROP_COUNT; i++) {
    const drop = document.createElement('span')
    drop.className = 'raindrop'
    drop.style.left = `${Math.random() * 100}%`
    drop.style.animationDelay = `${Math.random() * 1.2}s`
    drop.style.animationDuration = `${0.9 + Math.random() * 0.6}s`
    layer.append(drop)
  }

  container.prepend(layer)
  setTimeout(() => layer.remove(), RAIN_DURATION_MS)
}
