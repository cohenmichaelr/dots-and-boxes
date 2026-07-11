import { playerColorVar } from '../render'
import type { Player, PlayerId } from '../game/types'
import { el } from './dom'

export interface ScoreboardHandle {
  updateScores(players: Player[]): void
  setActivePlayer(playerId: PlayerId): void
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function renderScoreboard(container: HTMLElement, players: Player[]): ScoreboardHandle {
  const playersById = new Map<PlayerId, Player>(players.map((p) => [p.id, p]))
  const rowEls = new Map<PlayerId, { row: HTMLElement; scoreEl: HTMLElement }>()

  const banner = el('div', { class: 'turn-banner' })
  const rows = el('div', { class: 'scoreboard-rows' })

  for (const player of players) {
    const swatch = el('span', { class: 'swatch' })
    swatch.style.backgroundColor = playerColorVar(player.id)

    const scoreEl = el('span', { class: 'score' }, [String(player.score)])

    const nameParts: Array<Node | string> = [player.name]
    if (player.type === 'computer') {
      nameParts.push(el('span', { class: 'badge' }, [`Computer · ${capitalize(player.difficulty ?? 'medium')}`]))
    }

    const row = el('div', { class: 'score-row' }, [swatch, el('span', { class: 'name' }, nameParts), scoreEl])
    rows.append(row)
    rowEls.set(player.id, { row, scoreEl })
  }

  container.replaceChildren(banner, rows)

  return {
    updateScores(updated) {
      for (const player of updated) {
        playersById.set(player.id, player)
        const entry = rowEls.get(player.id)
        if (!entry) continue
        entry.scoreEl.textContent = String(player.score)
        entry.scoreEl.classList.remove('pop')
        requestAnimationFrame(() => entry.scoreEl.classList.add('pop'))
      }
    },
    setActivePlayer(playerId) {
      for (const [id, { row }] of rowEls) row.classList.toggle('active', id === playerId)
      const active = playersById.get(playerId)
      if (!active) return
      banner.textContent =
        active.type === 'computer' ? `${active.name} is thinking...` : `${active.name}'s turn`
    },
  }
}
