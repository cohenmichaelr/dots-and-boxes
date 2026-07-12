import { BOARD_SIZES, DEFAULT_COLORS } from '../game'
import type { AiDifficulty, BoardSize } from '../game/types'
import type { WireAiSlot } from '../net'
import { el } from './dom'

export interface OnlineSetupConfig {
  boardSize: BoardSize
  hostName: string
  hostColor: string
  aiSlots: WireAiSlot[]
}

const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard']

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function renderOnlineSetupScreen(
  container: HTMLElement,
  onCreate: (config: OnlineSetupConfig) => void,
  onBack: () => void,
): void {
  let hostName = ''
  let hostColor = DEFAULT_COLORS[0]
  let boardSizeIndex = 1
  const aiSlots: WireAiSlot[] = []

  function takenColors(excludeAiIndex?: number): Set<string> {
    return new Set([hostColor, ...aiSlots.filter((_, i) => i !== excludeAiIndex).map((a) => a.color)])
  }

  function firstFreeColor(excludeAiIndex?: number): string {
    const taken = takenColors(excludeAiIndex)
    return DEFAULT_COLORS.find((c) => !taken.has(c)) ?? DEFAULT_COLORS[0]
  }

  function render(): void {
    const nameInput = el('input', {
      class: 'name-input',
      value: hostName,
      placeholder: 'Your name',
      onInput: (event) => {
        hostName = (event.target as HTMLInputElement).value
      },
    })

    const hostSwatches = el(
      'div',
      { class: 'swatch-picker' },
      DEFAULT_COLORS.map((color) => {
        const taken = aiSlots.some((a) => a.color === color)
        const btn = el('button', {
          class: `swatch-btn${hostColor === color ? ' selected' : ''}${taken ? ' taken' : ''}`,
          disabled: taken,
          ariaLabel: `Color ${color}`,
          onClick: () => {
            hostColor = color
            render()
          },
        })
        btn.style.backgroundColor = color
        return btn
      }),
    )

    const hostRow = el('div', { class: 'player-row' }, [nameInput, hostSwatches])

    const aiRows = aiSlots.map((slot, index) => {
      const difficultySelect = el(
        'select',
        {
          class: 'difficulty-select',
          value: slot.difficulty,
          onChange: (event) => {
            slot.difficulty = (event.target as HTMLSelectElement).value as AiDifficulty
          },
        },
        DIFFICULTIES.map((difficulty) => {
          const option = document.createElement('option')
          option.value = difficulty
          option.textContent = capitalize(difficulty)
          option.selected = difficulty === slot.difficulty
          return option
        }),
      )

      const swatches = el(
        'div',
        { class: 'swatch-picker' },
        DEFAULT_COLORS.map((color) => {
          const taken = takenColors(index).has(color) && slot.color !== color
          const btn = el('button', {
            class: `swatch-btn${slot.color === color ? ' selected' : ''}${taken ? ' taken' : ''}`,
            disabled: taken,
            ariaLabel: `Color ${color}`,
            onClick: () => {
              slot.color = color
              render()
            },
          })
          btn.style.backgroundColor = color
          return btn
        }),
      )

      const removeButton = el(
        'button',
        {
          class: 'btn secondary',
          onClick: () => {
            aiSlots.splice(index, 1)
            render()
          },
        },
        ['Remove'],
      )

      return el('div', { class: 'player-row' }, [
        el('span', { class: 'name' }, [`Computer ${index + 1}`]),
        difficultySelect,
        swatches,
        removeButton,
      ])
    })

    const addAiButton = el(
      'button',
      {
        class: 'btn secondary',
        disabled: aiSlots.length + 1 >= 4,
        onClick: () => {
          aiSlots.push({ difficulty: 'medium', color: firstFreeColor() })
          render()
        },
      },
      ['+ Add Computer Player'],
    )

    const sizeGroup = el('div', { class: 'segmented' })
    BOARD_SIZES.forEach((size, index) => {
      sizeGroup.append(
        el(
          'button',
          {
            class: `segmented-btn${index === boardSizeIndex ? ' active' : ''}`,
            onClick: () => {
              boardSizeIndex = index
              render()
            },
          },
          [size.label],
        ),
      )
    })

    const backButton = el('button', { class: 'btn secondary', onClick: onBack }, ['Back'])
    const createButton = el(
      'button',
      {
        class: 'btn primary',
        onClick: () => {
          onCreate({
            boardSize: BOARD_SIZES[boardSizeIndex],
            hostName: hostName.trim() || 'Player 1',
            hostColor,
            aiSlots,
          })
        },
      },
      ['Create Game'],
    )

    const panel = el('div', { class: 'setup-panel' }, [
      el('h1', {}, ['Play Online']),
      el('p', { class: 'setup-subtitle' }, [
        "You'll get a link to send to another player. This works best while your device stays on and connected — the match ends if the host's tab closes.",
      ]),
      el('h2', {}, ['You']),
      hostRow,
      el('h2', {}, ['Computer Players']),
      ...aiRows,
      addAiButton,
      el('h2', {}, ['Board Size']),
      sizeGroup,
      el('div', { class: 'game-over-actions' }, [backButton, createButton]),
    ])

    container.replaceChildren(panel)
  }

  render()
}
