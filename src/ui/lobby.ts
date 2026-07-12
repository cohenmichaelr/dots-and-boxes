import { roomLink } from '../net'
import type { LobbyInfo } from '../net'
import { el } from './dom'

export interface LobbyScreenHandle {
  update(lobby: LobbyInfo): void
  showError(message: string): void
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function swatch(color: string): HTMLElement {
  const span = document.createElement('span')
  span.className = 'swatch'
  span.style.backgroundColor = color
  return span
}

export function renderLobbyScreen(
  container: HTMLElement,
  code: string,
  isHost: boolean,
  onStart: () => void,
  onLeave: () => void,
): LobbyScreenHandle {
  let latestLobby: LobbyInfo | null = null
  let errorMessage: string | null = null

  function render(): void {
    if (!latestLobby) return
    const lobby = latestLobby
    const totalPlayers = lobby.participants.length + lobby.aiPlayers.length

    const rows = el(
      'div',
      { class: 'scoreboard-rows' },
      [
        ...lobby.participants.map((p) =>
          el('div', { class: 'score-row' }, [swatch(p.color), el('span', { class: 'name' }, [p.name + (p.isHost ? ' (Host)' : '')])]),
        ),
        ...lobby.aiPlayers.map((a, i) =>
          el('div', { class: 'score-row' }, [
            swatch(a.color),
            el('span', { class: 'name' }, [`Computer ${i + 1}`, el('span', { class: 'badge' }, [capitalize(a.difficulty)])]),
          ]),
        ),
      ],
    )

    const link = roomLink(code)
    const linkRow = isHost
      ? el('div', { class: 'room-link-row' }, [
          el('code', { class: 'room-link-text' }, [link]),
          el(
            'button',
            {
              class: 'btn secondary',
              onClick: (event) => {
                navigator.clipboard.writeText(link)
                const button = event.currentTarget as HTMLButtonElement
                button.textContent = 'Copied!'
                setTimeout(() => {
                  button.textContent = 'Copy Link'
                }, 1500)
              },
            },
            ['Copy Link'],
          ),
        ])
      : null

    const errorEl = errorMessage
      ? el('ul', { class: 'setup-errors' }, [el('li', {}, [errorMessage])])
      : null

    const startButton = isHost
      ? el('button', { class: 'btn primary start-btn', disabled: totalPlayers < 2, onClick: onStart }, ['Start Game'])
      : null
    const waitingText = !isHost ? el('p', { class: 'setup-subtitle' }, ['Waiting for the host to start the game...']) : null

    const leaveButton = el('button', { class: 'btn secondary', onClick: onLeave }, [isHost ? 'Cancel' : 'Leave'])

    const children: HTMLElement[] = [el('h1', {}, ['Game Lobby'])]
    if (linkRow) children.push(linkRow)
    children.push(el('h2', {}, ['Players']), rows)
    if (errorEl) children.push(errorEl)
    if (startButton) children.push(startButton)
    if (waitingText) children.push(waitingText)
    children.push(leaveButton)

    container.replaceChildren(el('div', { class: 'setup-panel' }, children))
  }

  return {
    update(lobby) {
      latestLobby = lobby
      errorMessage = null
      render()
    },
    showError(message) {
      errorMessage = message
      render()
    },
  }
}
