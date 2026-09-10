import type { HighScoreEntry } from '../highScores'
import { el } from './dom'

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export function renderHighScoresScreen(container: HTMLElement, entries: HighScoreEntry[], onBack: () => void): void {
  const list =
    entries.length > 0
      ? el(
          'div',
          { class: 'high-score-rows' },
          entries.map((entry, index) =>
            el('div', { class: 'high-score-row' }, [
              el('span', { class: 'high-score-rank' }, [`${index + 1}`]),
              el('span', { class: 'high-score-name' }, [entry.name]),
              el('span', { class: 'high-score-board' }, [entry.boardLabel]),
              el('span', { class: 'high-score-date' }, [formatDate(entry.achievedAt)]),
              el('span', { class: 'high-score-value' }, [`${entry.score} boxes`]),
            ]),
          ),
        )
      : el('p', { class: 'setup-subtitle' }, ['No games finished yet — play a round on this device to set the first high score!'])

  container.replaceChildren(
    el('div', { class: 'setup-panel' }, [
      el('h1', {}, ['🏆 High Scores']),
      el('p', { class: 'setup-subtitle' }, ['Most boxes won in a single game, on this device.']),
      list,
      el('button', { class: 'btn secondary', onClick: onBack }, ['Back']),
    ]),
  )
}
