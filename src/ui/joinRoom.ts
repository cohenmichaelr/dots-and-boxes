import { DEFAULT_COLORS } from '../game'
import { el } from './dom'

export interface JoinFormResult {
  name: string
  color: string
}

export interface JoinScreenHandle {
  showError(message: string): void
  setBusy(busy: boolean): void
}

export function renderJoinScreen(
  container: HTMLElement,
  code: string,
  onJoin: (result: JoinFormResult) => void,
  onCancel: () => void,
): JoinScreenHandle {
  let name = ''
  let color = DEFAULT_COLORS[0]
  let errorMessage: string | null = null
  let busy = false

  function render(): void {
    const nameInput = el('input', {
      class: 'name-input',
      value: name,
      placeholder: 'Your name',
      onInput: (event) => {
        name = (event.target as HTMLInputElement).value
      },
    })

    const swatches = el(
      'div',
      { class: 'swatch-picker' },
      DEFAULT_COLORS.map((c) => {
        const btn = el('button', {
          class: `swatch-btn${color === c ? ' selected' : ''}`,
          ariaLabel: `Color ${c}`,
          onClick: () => {
            color = c
            render()
          },
        })
        btn.style.backgroundColor = c
        return btn
      }),
    )

    const errorEl = errorMessage ? el('ul', { class: 'setup-errors' }, [el('li', {}, [errorMessage])]) : null

    const joinButton = el(
      'button',
      {
        class: 'btn primary',
        disabled: busy,
        onClick: () => onJoin({ name: name.trim() || 'Player', color }),
      },
      [busy ? 'Joining...' : 'Join Game'],
    )
    const cancelButton = el('button', { class: 'btn secondary', onClick: onCancel }, ['Cancel'])

    const children: HTMLElement[] = [
      el('h1', {}, ['Join Game']),
      el('p', { class: 'setup-subtitle' }, [`Joining room ${code}`]),
      el('div', { class: 'player-row' }, [nameInput, swatches]),
    ]
    if (errorEl) children.push(errorEl)
    children.push(el('div', { class: 'game-over-actions' }, [cancelButton, joinButton]))

    container.replaceChildren(el('div', { class: 'setup-panel' }, children))
  }

  render()

  return {
    showError(message) {
      errorMessage = message
      busy = false
      render()
    },
    setBusy(value) {
      busy = value
      errorMessage = null
      render()
    },
  }
}
