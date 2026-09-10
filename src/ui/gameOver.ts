import { playerColorVar } from '../render'
import type { Player, PlayerId } from '../game/types'
import { el } from './dom'
import { playFireworks, playSadRain } from './effects'

export type GameOutcome = 'win' | 'lose'

export interface GameOverAction {
  label: string
  primary?: boolean
  onClick: () => void
}

function titleFor(players: Player[], winnerIds: PlayerId[], outcome: GameOutcome): string {
  const byId = new Map(players.map((p) => [p.id, p]))
  const emoji = outcome === 'win' ? '🎉 ' : '😢 '
  if (winnerIds.length === players.length) return `${emoji}It's a tie!`
  if (winnerIds.length > 1) {
    const names = winnerIds.map((id) => byId.get(id)?.name ?? 'Player')
    return `${emoji}${names.join(' & ')} tie!`
  }
  return `${emoji}${byId.get(winnerIds[0])?.name ?? 'A player'} wins!`
}

function seriesSummary(players: Player[], seriesWins: Map<PlayerId, number>): string | null {
  if ([...seriesWins.values()].every((wins) => wins === 0)) return null
  const ranked = [...players].sort((a, b) => (seriesWins.get(b.id) ?? 0) - (seriesWins.get(a.id) ?? 0))
  return `Series: ${ranked.map((p) => `${p.name} ${seriesWins.get(p.id) ?? 0}`).join(' · ')}`
}

export function renderGameOver(
  container: HTMLElement,
  players: Player[],
  winnerIds: PlayerId[],
  outcome: GameOutcome,
  actions: GameOverAction[],
  seriesWins?: Map<PlayerId, number>,
): void {
  const ranked = [...players].sort((a, b) => b.score - a.score)

  const scoreList = el(
    'div',
    { class: 'final-scores' },
    ranked.map((player) => {
      const swatch = el('span', { class: 'swatch' })
      swatch.style.backgroundColor = playerColorVar(player.id)
      const rowClass = `final-score-row${winnerIds.includes(player.id) ? ' winner' : ''}`
      return el('div', { class: rowClass }, [
        swatch,
        el('span', { class: 'name' }, [player.name]),
        el('span', { class: 'score' }, [String(player.score)]),
      ])
    }),
  )

  const summary = seriesWins && seriesSummary(players, seriesWins)

  const panel = el('div', { class: `game-over-panel ${outcome}` }, [
    el('h2', {}, [titleFor(players, winnerIds, outcome)]),
    ...(summary ? [el('p', { class: 'series-summary' }, [summary])] : []),
    scoreList,
    el(
      'div',
      { class: 'game-over-actions' },
      actions.map((action) =>
        el('button', { class: `btn ${action.primary ? 'primary' : 'secondary'}`, onClick: action.onClick }, [action.label]),
      ),
    ),
  ])

  container.replaceChildren(panel)
  container.classList.add('visible')

  if (outcome === 'win') playFireworks(container)
  else playSadRain(container)
}
