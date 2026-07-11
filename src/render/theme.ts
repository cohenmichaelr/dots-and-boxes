import type { Player } from '../game/types'

export const BOARD_COLORS = {
  background: '#fbf9f5',
  dot: '#2b2b33',
  lineGuide: 'rgba(43, 43, 51, 0.16)',
  selected: '#c9a227',
  highlight: 'rgba(201, 162, 39, 0.35)',
}

/** Sets the 4 player colors as CSS custom properties so SVG presentation and DOM scoreboard swatches share one source of truth. */
export function applyPlayerColorVars(root: HTMLElement, players: Player[]): void {
  players.forEach((player, index) => root.style.setProperty(`--player-${index}-color`, player.color))
}

export function applyBoardColorVars(root: HTMLElement): void {
  root.style.setProperty('--board-bg', BOARD_COLORS.background)
  root.style.setProperty('--dot-color', BOARD_COLORS.dot)
  root.style.setProperty('--line-guide-color', BOARD_COLORS.lineGuide)
  root.style.setProperty('--selected-color', BOARD_COLORS.selected)
  root.style.setProperty('--highlight-color', BOARD_COLORS.highlight)
}

/** CSS var reference for a given player's color, so board/scoreboard rendering stays in sync with `applyPlayerColorVars`. */
export function playerColorVar(playerIndex: number): string {
  return `var(--player-${playerIndex}-color)`
}
