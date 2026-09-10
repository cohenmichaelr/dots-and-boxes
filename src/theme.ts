const STORAGE_KEY = 'dots-and-boxes-theme'
const THEME_CHANGE_EVENT = 'dots-and-boxes-themechange'

export type ThemePreference = 'light' | 'dark'

const BOARD_COLORS_LIGHT = {
  dot: '#2b2b33',
  lineGuide: 'rgba(43, 43, 51, 0.16)',
  selected: '#c9a227',
  highlight: 'rgba(201, 162, 39, 0.35)',
}

const BOARD_COLORS_DARK = {
  dot: '#e8e6f0',
  lineGuide: 'rgba(232, 230, 240, 0.2)',
  selected: '#e0b84a',
  highlight: 'rgba(224, 184, 74, 0.4)',
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function getStoredTheme(): ThemePreference | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

/** The theme actually in effect: the user's explicit choice if they made one, otherwise the OS setting. */
export function resolveTheme(): ThemePreference {
  return getStoredTheme() ?? (systemPrefersDark() ? 'dark' : 'light')
}

export function toggleTheme(): ThemePreference {
  const next: ThemePreference = resolveTheme() === 'dark' ? 'light' : 'dark'
  localStorage.setItem(STORAGE_KEY, next)
  document.documentElement.dataset.theme = next
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT))
  return next
}

/** Re-invokes `callback` whenever the effective theme changes: an explicit toggle, or (absent one) the OS setting. */
function onThemeChange(callback: () => void): void {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', callback)
  window.addEventListener(THEME_CHANGE_EVENT, callback)
}

/** Applies board SVG colors for the current theme, and keeps them in sync as it changes while the app is open. */
export function applyBoardColorVars(root: HTMLElement): void {
  function apply(): void {
    const colors = resolveTheme() === 'dark' ? BOARD_COLORS_DARK : BOARD_COLORS_LIGHT
    root.style.setProperty('--dot-color', colors.dot)
    root.style.setProperty('--line-guide-color', colors.lineGuide)
    root.style.setProperty('--selected-color', colors.selected)
    root.style.setProperty('--highlight-color', colors.highlight)
  }

  apply()
  onThemeChange(apply)
}
