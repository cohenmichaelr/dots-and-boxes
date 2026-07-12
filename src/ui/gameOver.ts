import { playerColorVar } from '../render'
import type { Player, PlayerId } from '../game/types'
import { el } from './dom'

export interface GameOverAction {
  label: string
  primary?: boolean
  onClick: () => void
}

function titleFor(players: Player[], winnerIds: PlayerId[]): string {
  const byId = new Map(players.map((p) => [p.id, p]))
  if (winnerIds.length === players.length) return "It's a tie!"
  if (winnerIds.length > 1) {
    const names = winnerIds.map((id) => byId.get(id)?.name ?? 'Player')
    return `${names.join(' & ')} tie!`
  }
  return `${byId.get(winnerIds[0])?.name ?? 'A player'} wins!`
}

export function renderGameOver(
  container: HTMLElement,
  players: Player[],
  winnerIds: PlayerId[],
  actions: GameOverAction[],
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

  const panel = el('div', { class: 'game-over-panel' }, [
    el('h2', {}, [titleFor(players, winnerIds)]),
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
}
