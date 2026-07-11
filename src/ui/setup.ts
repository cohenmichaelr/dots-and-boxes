import { BOARD_SIZES, DEFAULT_COLORS } from '../game'
import type { AiDifficulty, BoardSize, GameSetupConfig, PlayerSetupConfig, PlayerType } from '../game/types'
import { el } from './dom'

interface RowState {
  name: string
  type: PlayerType
  difficulty: AiDifficulty
  color: string
}

const DIFFICULTIES: AiDifficulty[] = ['easy', 'medium', 'hard']

function defaultRows(): RowState[] {
  return [
    { name: 'Player 1', type: 'human', difficulty: 'medium', color: DEFAULT_COLORS[0] },
    { name: 'Player 2', type: 'human', difficulty: 'medium', color: DEFAULT_COLORS[1] },
    { name: 'Computer 3', type: 'computer', difficulty: 'medium', color: DEFAULT_COLORS[2] },
    { name: 'Computer 4', type: 'computer', difficulty: 'medium', color: DEFAULT_COLORS[3] },
  ]
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function validateSetup(config: GameSetupConfig): string[] {
  const errors: string[] = []
  if (config.players.length < 2) errors.push('At least 2 players are required.')
  const colors = config.players.map((p) => p.color)
  if (new Set(colors).size !== colors.length) errors.push('Each player needs a distinct color.')
  return errors
}

export function renderSetupScreen(container: HTMLElement, onStart: (config: GameSetupConfig) => void): void {
  let playerCount = 2
  let boardSizeIndex = 1
  const rows = defaultRows()
  let errors: string[] = []

  function activeConfig(): GameSetupConfig {
    const players: PlayerSetupConfig[] = rows.slice(0, playerCount).map((row) => ({
      name: row.name.trim() || (row.type === 'human' ? 'Player' : 'Computer'),
      type: row.type,
      difficulty: row.type === 'computer' ? row.difficulty : undefined,
      color: row.color,
    }))
    return { players, boardSize: BOARD_SIZES[boardSizeIndex] }
  }

  function colorTakenElsewhere(rowIndex: number, color: string): boolean {
    return rows.slice(0, playerCount).some((row, index) => index !== rowIndex && row.color === color)
  }

  function render(): void {
    const countGroup = el('div', { class: 'segmented' })
    for (const count of [2, 3, 4]) {
      countGroup.append(
        el(
          'button',
          {
            class: `segmented-btn${count === playerCount ? ' active' : ''}`,
            onClick: () => {
              playerCount = count
              render()
            },
          },
          [String(count)],
        ),
      )
    }

    const rowsContainer = el('div', { class: 'player-rows' })
    for (let i = 0; i < playerCount; i++) {
      rowsContainer.append(renderPlayerRow(i))
    }

    const sizeGroup = el('div', { class: 'segmented' })
    BOARD_SIZES.forEach((size: BoardSize, index) => {
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

    const errorList =
      errors.length > 0
        ? el(
            'ul',
            { class: 'setup-errors' },
            errors.map((message) => el('li', {}, [message])),
          )
        : null

    const startButton = el(
      'button',
      {
        class: 'btn primary start-btn',
        onClick: () => {
          const config = activeConfig()
          errors = validateSetup(config)
          if (errors.length > 0) {
            render()
            return
          }
          onStart(config)
        },
      },
      ['Start Game'],
    )

    const panel = el('div', { class: 'setup-panel' }, [
      el('h1', {}, ['Dots and Boxes']),
      el('p', { class: 'setup-subtitle' }, ['Gather the family. Up to 4 players, human or computer.']),
      el('h2', {}, ['Players']),
      countGroup,
      rowsContainer,
      el('h2', {}, ['Board Size']),
      sizeGroup,
      ...(errorList ? [errorList] : []),
      startButton,
    ])

    container.replaceChildren(panel)
  }

  function renderPlayerRow(index: number): HTMLElement {
    const row = rows[index]

    const nameInput = el('input', {
      class: 'name-input',
      value: row.name,
      placeholder: row.type === 'human' ? `Player ${index + 1}` : `Computer ${index + 1}`,
      onInput: (event) => {
        row.name = (event.target as HTMLInputElement).value
      },
    })

    const typeToggle = el('div', { class: 'segmented small' }, [
      el(
        'button',
        {
          class: `segmented-btn${row.type === 'human' ? ' active' : ''}`,
          onClick: () => {
            row.type = 'human'
            render()
          },
        },
        ['Human'],
      ),
      el(
        'button',
        {
          class: `segmented-btn${row.type === 'computer' ? ' active' : ''}`,
          onClick: () => {
            row.type = 'computer'
            render()
          },
        },
        ['Computer'],
      ),
    ])

    const difficultySelect =
      row.type === 'computer'
        ? el(
            'select',
            {
              class: 'difficulty-select',
              value: row.difficulty,
              onChange: (event) => {
                row.difficulty = (event.target as HTMLSelectElement).value as AiDifficulty
              },
            },
            DIFFICULTIES.map((difficulty) => {
              const option = document.createElement('option')
              option.value = difficulty
              option.textContent = capitalize(difficulty)
              option.selected = difficulty === row.difficulty
              return option
            }),
          )
        : null

    const swatches = el(
      'div',
      { class: 'swatch-picker' },
      DEFAULT_COLORS.map((color) => {
        const taken = colorTakenElsewhere(index, color)
        const isSelected = row.color === color
        const btn = el('button', {
          class: `swatch-btn${isSelected ? ' selected' : ''}${taken ? ' taken' : ''}`,
          disabled: taken,
          ariaLabel: `Color ${color}`,
          onClick: () => {
            row.color = color
            render()
          },
        })
        btn.style.backgroundColor = color
        return btn
      }),
    )

    return el('div', { class: 'player-row' }, [
      nameInput,
      typeToggle,
      ...(difficultySelect ? [difficultySelect] : []),
      swatches,
    ])
  }

  render()
}
