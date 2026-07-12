import { chooseMove } from '../ai'
import { createGameState, createPlayers, playTurn } from '../game'
import type { EdgeId, GameSetupConfig, GameState, Player } from '../game/types'
import { BOX_FILL_DELAY_MS, CHAIN_STAGGER_MS, applyBoardColorVars, applyPlayerColorVars, createSvgBoard, playerColorVar, scheduleBoxFills } from '../render'
import type { SvgBoardHandle } from '../render'
import { createSoundEngine } from '../sound'
import { el } from './dom'
import { renderGameOver } from './gameOver'
import { renderScoreboard } from './scoreboard'
import type { ScoreboardHandle } from './scoreboard'
import { renderSetupScreen } from './setup'

const AI_MOVE_DELAY_MS = 550
const GAME_OVER_REVEAL_BUFFER_MS = 250

export function mountApp(root: HTMLElement): void {
  applyBoardColorVars(document.documentElement)
  const sound = createSoundEngine()

  const muteButton = el(
    'button',
    {
      class: 'mute-toggle',
      title: 'Mute sound',
      ariaLabel: 'Mute sound',
      onClick: () => {
        const nowMuted = !sound.isMuted()
        sound.setMuted(nowMuted)
        muteButton.textContent = nowMuted ? '🔇' : '🔊'
      },
    },
    ['🔊'],
  )

  const header = el('header', { class: 'app-header' }, [el('h1', {}, ['Dots and Boxes']), muteButton])
  const screen = el('div', { class: 'screen' })
  const shell = el('div', { class: 'app-shell' }, [header, screen])
  root.replaceChildren(shell)

  function showSetup(): void {
    screen.replaceChildren()
    renderSetupScreen(screen, (config) => {
      sound.resumeIfNeeded()
      startGame(config)
    })
  }

  function startGame(config: GameSetupConfig): void {
    const players = createPlayers(config.players)
    applyPlayerColorVars(document.documentElement, players)
    let state: GameState = createGameState(config.boardSize, players)

    let active = true

    screen.replaceChildren()
    const quitButton = el('button', { class: 'btn secondary quit-btn', onClick: handleQuitClick }, ['Quit Game'])
    const gameToolbar = el('div', { class: 'game-toolbar' }, [quitButton])
    const scoreboardContainer = el('div', { class: 'scoreboard-container' })
    const boardWrapper = el('div', { class: 'board-wrapper' })
    const overlay = el('div', { class: 'game-over-overlay' })
    screen.append(el('div', { class: 'game-screen' }, [gameToolbar, scoreboardContainer, boardWrapper, overlay]))

    const scoreboard: ScoreboardHandle = renderScoreboard(scoreboardContainer, players)
    const board: SvgBoardHandle = createSvgBoard(boardWrapper, state.board)

    function currentPlayer(): Player {
      return state.players[state.currentPlayerIndex]
    }

    function handleQuitClick(): void {
      overlay.replaceChildren(
        el('div', { class: 'game-over-panel' }, [
          el('h2', {}, ['Quit this game?']),
          el('p', { class: 'setup-subtitle' }, ['Current progress will be lost.']),
          el('div', { class: 'game-over-actions' }, [
            el('button', { class: 'btn primary', onClick: handleNewSetup }, ['Quit']),
            el(
              'button',
              {
                class: 'btn secondary',
                onClick: () => {
                  overlay.classList.remove('visible')
                  overlay.replaceChildren()
                },
              },
              ['Cancel'],
            ),
          ]),
        ]),
      )
      overlay.classList.add('visible')
    }

    function applyEdge(edgeId: EdgeId): void {
      if (!active) return
      const mover = currentPlayer()
      const { state: nextState, completedBoxIds } = playTurn(state, edgeId)
      state = nextState

      board.markEdgeDrawn(edgeId, playerColorVar(mover.id))
      sound.playLineDrawn()

      if (completedBoxIds.length > 0) {
        scheduleBoxFills(completedBoxIds, (boxId, index) => {
          board.markBoxOwned(boxId, playerColorVar(mover.id))
          sound.playBoxCompleted()
          if (index === completedBoxIds.length - 1) scoreboard.updateScores(state.players)
        })
      } else {
        scoreboard.updateScores(state.players)
      }

      if (state.status === 'game_over') {
        board.setInputEnabled(false)
        const revealDelay = BOX_FILL_DELAY_MS + completedBoxIds.length * CHAIN_STAGGER_MS + GAME_OVER_REVEAL_BUFFER_MS
        setTimeout(() => {
          sound.playGameWon()
          renderGameOver(overlay, state.players, state.winnerIds, handleRematch, handleNewSetup)
        }, revealDelay)
        return
      }

      scoreboard.setActivePlayer(currentPlayer().id)
      if (currentPlayer().type === 'computer') {
        board.setInputEnabled(false)
        setTimeout(runComputerTurn, AI_MOVE_DELAY_MS)
      } else {
        board.setInputEnabled(true)
      }
    }

    function handleEdgeSelected(edgeId: EdgeId): void {
      if (currentPlayer().type === 'computer') return
      applyEdge(edgeId)
    }

    function runComputerTurn(): void {
      if (!active) return
      const mover = currentPlayer()
      if (mover.type !== 'computer' || !mover.difficulty) return
      applyEdge(chooseMove(state, mover.difficulty))
    }

    function handleRematch(): void {
      active = false
      overlay.classList.remove('visible')
      overlay.replaceChildren()
      startGame(config)
    }

    function handleNewSetup(): void {
      active = false
      overlay.classList.remove('visible')
      overlay.replaceChildren()
      showSetup()
    }

    board.onEdgeSelect(handleEdgeSelected)
    scoreboard.setActivePlayer(currentPlayer().id)
    if (currentPlayer().type === 'computer') {
      board.setInputEnabled(false)
      setTimeout(runComputerTurn, AI_MOVE_DELAY_MS)
    }
  }

  showSetup()
}
