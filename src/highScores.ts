const STORAGE_KEY = 'dots-and-boxes-high-scores'
const MAX_ENTRIES = 10

export interface HighScoreEntry {
  name: string
  score: number
  boardLabel: string
  achievedAt: number
}

/** The best individual box count from a single local game, persisted across browser sessions. */
export function loadHighScores(): HighScoreEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as HighScoreEntry[]) : []
  } catch {
    return []
  }
}

export function recordHighScores(entries: HighScoreEntry[]): HighScoreEntry[] {
  const merged = [...loadHighScores(), ...entries].sort((a, b) => b.score - a.score).slice(0, MAX_ENTRIES)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    // Storage may be unavailable (private browsing, quota) — high scores just won't persist.
  }
  return merged
}
