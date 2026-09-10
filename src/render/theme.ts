import type { Player } from '../game/types'

/** Sets the 4 player colors as CSS custom properties so SVG presentation and DOM scoreboard swatches share one source of truth. */
export function applyPlayerColorVars(root: HTMLElement, players: Player[]): void {
  players.forEach((player, index) => root.style.setProperty(`--player-${index}-color`, player.color))
}

/** CSS var reference for a given player's color, so board/scoreboard rendering stays in sync with `applyPlayerColorVars`. */
export function playerColorVar(playerIndex: number): string {
  return `var(--player-${playerIndex}-color)`
}
