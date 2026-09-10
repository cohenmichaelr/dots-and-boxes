import { chooseMove } from '../ai'
import { createBoard, createGameState, createPlayers, playTurn } from '../game'
import type { BoardSize, EdgeId, GameSetupConfig, GameState, Player } from '../game/types'
import {
  BOX_FILL_DELAY_MS,
  CHAIN_STAGGER_MS,
  applyPlayerColorVars,
  createSvgBoard,
  playerColorVar,
  scheduleBoxFills,
} from '../render'
import type { SvgBoardHandle } from '../render'
import { createSoundEngine } from '../sound'
import { createHostSession, joinRoom } from '../net'
import type { GuestSession, HostSession, OnlineGameSession, WirePlayer } from '../net'
import { applyBoardColorVars, resolveTheme, toggleTheme } from '../theme'
import { el } from './dom'
import { renderGameOver } from './gameOver'
import { renderJoinScreen } from './joinRoom'
import { renderLobbyScreen } from './lobby'
import { renderOnlineSetupScreen } from './onlineSetup'
import { renderScoreboard } from './scoreboard'
import type { ScoreboardHandle } from './scoreboard'
import { renderSetupScreen } from './setup'

const AI_MOVE_DELAY_MS = 550
const GAME_OVER_REVEAL_BUFFER_MS = 250

/** Was "you" (the local player online, or any human in hotseat play) among the winners? */
function determineOutcome(
  players: Array<{ id: number; type: 'human' | 'computer' }>,
  winnerIds: number[],
  localPlayerId?: number,
): 'win' | 'lose' {
  if (localPlayerId !== undefined) return winnerIds.includes(localPlayerId) ? 'win' : 'lose'
  const winners = players.filter((p) => winnerIds.includes(p.id))
  return winners.some((p) => p.type === 'human') ? 'win' : 'lose'
}

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

  const themeButton = el(
    'button',
    {
      class: 'mute-toggle',
      title: 'Toggle dark/light theme',
      ariaLabel: 'Toggle dark/light theme',
      onClick: () => {
        const theme = toggleTheme()
        themeButton.textContent = theme === 'dark' ? '🌙' : '☀️'
      },
    },
    [resolveTheme() === 'dark' ? '🌙' : '☀️'],
  )

  const headerActions = el('div', { class: 'header-actions' }, [themeButton, muteButton])
  const header = el('header', { class: 'app-header' }, [el('h1', {}, ['Dots and Boxes']), headerActions])
  const screen = el('div', { class: 'screen' })
  const shell = el('div', { class: 'app-shell' }, [header, screen])
  root.replaceChildren(shell)

  function showNotice(title: string, message: string, actionLabel: string, onAction: () => void): void {
    screen.replaceChildren(
      el('div', { class: 'setup-panel' }, [
        el('h1', {}, [title]),
        el('p', { class: 'setup-subtitle' }, [message]),
        el('button', { class: 'btn primary start-btn', onClick: onAction }, [actionLabel]),
      ]),
    )
  }

  function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error)
  }

  // ---------- Mode select ----------

  function showModeSelect(): void {
    const children = [
      el('h1', {}, ['Dots and Boxes']),
      el('p', { class: 'setup-subtitle' }, ['How do you want to play?']),
      el('div', { class: 'game-over-actions' }, [
        el('button', { class: 'btn primary', onClick: showSetup }, ['Play on this device']),
        el('button', { class: 'btn secondary', onClick: showOnlineSetup }, ['Play online']),
      ]),
      renderInstructions(),
    ]

    screen.replaceChildren(el('div', { class: 'setup-panel' }, children))
  }

  function renderInstructions(): HTMLElement {
    return el('div', { class: 'instructions' }, [
      el('h2', {}, ['How to play']),
      el('p', {}, [
        'Players take turns drawing one line between two neighboring dots. Tap or click a spot between two dots to draw a line there.',
      ]),
      el('p', {}, [
        'Complete the fourth side of a box and you claim it — it fills with your color, and you immediately get another turn. Chain several boxes together and you keep going until you draw a line that doesn’t finish a box.',
      ]),
      el('p', {}, [
        'When every line on the board is drawn, the game ends. Whoever owns the most boxes wins. Up to 4 players can play, any mix of humans and computer opponents.',
      ]),
      el('h2', {}, ['Playing against others']),
      el('p', {}, [
        'Choose ',
        el('strong', {}, ['Play online']),
        ' to set up a match across multiple devices — no accounts needed. One player hosts, picks a name, color, and any computer opponents, then taps ',
        el('strong', {}, ['Create Game']),
        ' to open a lobby with a shareable link.',
      ]),
      el('p', {}, [
        'Send that link to whoever you want to play with — they open it, pick a name and color, and join the lobby automatically. Once everyone has joined, the host taps ',
        el('strong', {}, ['Start Game']),
        ' and moves sync live for every player. If the host closes their tab, the match ends.',
      ]),
    ])
  }

  // ---------- Local hotseat mode (unchanged) ----------

  function showSetup(): void {
    screen.replaceChildren()
    renderSetupScreen(screen, (config) => {
      sound.resumeIfNeeded()
      const seriesWins = new Map(config.players.map((_, index) => [index, 0]))
      startGame(config, seriesWins)
    })
  }

  function startGame(config: GameSetupConfig, seriesWins: Map<number, number>): void {
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

    const scoreboard: ScoreboardHandle = renderScoreboard(scoreboardContainer, players, seriesWins)
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
          const outcome = determineOutcome(state.players, state.winnerIds)
          if (outcome === 'win') sound.playGameWon()
          else sound.playGameLost()
          for (const winnerId of state.winnerIds) seriesWins.set(winnerId, (seriesWins.get(winnerId) ?? 0) + 1)
          renderGameOver(
            overlay,
            state.players,
            state.winnerIds,
            outcome,
            [
              { label: 'Rematch', primary: true, onClick: handleRematch },
              { label: 'New Setup', onClick: handleNewSetup },
            ],
            seriesWins,
          )
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
      startGame(config, seriesWins)
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

  // ---------- Online mode (host) ----------

  function showOnlineSetup(): void {
    screen.replaceChildren()
    renderOnlineSetupScreen(
      screen,
      (config) => {
        sound.resumeIfNeeded()
        createHostSession(config)
          .then((session) => showHostLobby(session))
          .catch((error: unknown) => {
            showNotice('Could not create the game', errorMessage(error), 'Try Again', showOnlineSetup)
          })
      },
      showModeSelect,
    )
  }

  function showHostLobby(session: HostSession): void {
    screen.replaceChildren()
    const lobbyContainer = el('div', {})
    screen.append(lobbyContainer)
    const lobbyHandle = renderLobbyScreen(
      lobbyContainer,
      session.code,
      true,
      () => session.startGame(),
      () => {
        session.destroy()
        showModeSelect()
      },
    )
    session.onLobbyUpdate((lobby) => lobbyHandle.update(lobby))
    session.onGameStarted((boardSize, players) => {
      startOnlineGameScreen(session, boardSize, players, showModeSelect)
    })
  }

  // ---------- Online mode (guest) ----------

  function showJoinRoom(code: string): void {
    screen.replaceChildren()
    const joinContainer = el('div', {})
    screen.append(joinContainer)
    const joinHandle = renderJoinScreen(
      joinContainer,
      code,
      (result) => {
        sound.resumeIfNeeded()
        joinHandle.setBusy(true)
        joinRoom(code, result.name, result.color)
          .then((session) => showGuestLobby(session, code))
          .catch((error: unknown) => joinHandle.showError(errorMessage(error)))
      },
      showModeSelect,
    )
  }

  function showGuestLobby(session: GuestSession, code: string): void {
    screen.replaceChildren()
    const lobbyContainer = el('div', {})
    screen.append(lobbyContainer)
    const lobbyHandle = renderLobbyScreen(
      lobbyContainer,
      code,
      false,
      () => {},
      () => {
        session.destroy()
        showModeSelect()
      },
    )
    session.onLobbyUpdate((lobby) => lobbyHandle.update(lobby))
    session.onRoomError((message) => lobbyHandle.showError(message))
    session.onGameStarted((boardSize, players) => {
      startOnlineGameScreen(session, boardSize, players, showModeSelect)
    })
    session.onHostDisconnected(() => {
      showNotice('Host disconnected', 'The connection to the host was lost.', 'Back to Menu', showModeSelect)
    })
  }

  // ---------- Online mode (shared game screen: host and guest render identically) ----------

  function startOnlineGameScreen(
    session: OnlineGameSession,
    boardSize: BoardSize,
    initialPlayers: WirePlayer[],
    onLeave: () => void,
  ): void {
    applyPlayerColorVars(document.documentElement, initialPlayers)

    let players = initialPlayers
    let currentPlayerIndex = 0

    screen.replaceChildren()
    const quitButton = el('button', { class: 'btn secondary quit-btn', onClick: handleLeaveClick }, ['Leave Game'])
    const gameToolbar = el('div', { class: 'game-toolbar' }, [quitButton])
    const scoreboardContainer = el('div', { class: 'scoreboard-container' })
    const boardWrapper = el('div', { class: 'board-wrapper' })
    const overlay = el('div', { class: 'game-over-overlay' })
    screen.append(el('div', { class: 'game-screen' }, [gameToolbar, scoreboardContainer, boardWrapper, overlay]))

    const scoreboard: ScoreboardHandle = renderScoreboard(scoreboardContainer, players)
    const board: SvgBoardHandle = createSvgBoard(boardWrapper, createBoard(boardSize))

    function isMyTurn(): boolean {
      return players[currentPlayerIndex]?.id === session.localPlayerId
    }

    function handleLeaveClick(): void {
      overlay.replaceChildren(
        el('div', { class: 'game-over-panel' }, [
          el('h2', {}, ['Leave this game?']),
          el('p', { class: 'setup-subtitle' }, ['You will be disconnected from the match.']),
          el('div', { class: 'game-over-actions' }, [
            el(
              'button',
              {
                class: 'btn primary',
                onClick: () => {
                  session.destroy()
                  onLeave()
                },
              },
              ['Leave'],
            ),
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

    function showOnlineGameOver(finalPlayers: WirePlayer[], winnerIds: number[]): void {
      const outcome = determineOutcome(finalPlayers, winnerIds, session.localPlayerId)
      renderGameOver(overlay, finalPlayers, winnerIds, outcome, [
        {
          label: 'Back to Menu',
          primary: true,
          onClick: () => {
            session.destroy()
            onLeave()
          },
        },
      ])
    }

    board.onEdgeSelect((edgeId) => {
      if (isMyTurn()) session.submitMove(edgeId)
    })

    session.onState((payload) => {
      players = payload.players
      currentPlayerIndex = payload.currentPlayerIndex

      if (payload.lastMove) {
        const { edgeId, completedBoxIds, moverId } = payload.lastMove
        board.markEdgeDrawn(edgeId, playerColorVar(moverId))
        sound.playLineDrawn()

        if (completedBoxIds.length > 0) {
          scheduleBoxFills(completedBoxIds, (boxId, index) => {
            board.markBoxOwned(boxId, playerColorVar(moverId))
            sound.playBoxCompleted()
            if (index === completedBoxIds.length - 1) scoreboard.updateScores(payload.players)
          })
        } else {
          scoreboard.updateScores(payload.players)
        }

        if (payload.status === 'game_over') {
          board.setInputEnabled(false)
          const revealDelay = BOX_FILL_DELAY_MS + completedBoxIds.length * CHAIN_STAGGER_MS + GAME_OVER_REVEAL_BUFFER_MS
          setTimeout(() => {
            const outcome = determineOutcome(payload.players, payload.winnerIds, session.localPlayerId)
            if (outcome === 'win') sound.playGameWon()
            else sound.playGameLost()
            showOnlineGameOver(payload.players, payload.winnerIds)
          }, revealDelay)
          return
        }

        scoreboard.setActivePlayer(players[currentPlayerIndex].id)
        board.setInputEnabled(isMyTurn())
        return
      }

      // Initial state right after gameStarted, or a full resync: bulk-apply with no per-move animation.
      // Edge line ownership isn't tracked in the wire protocol (only box ownership is), so replayed
      // lines use a neutral color rather than the drawing player's color.
      board.reset()
      for (const edgeId of payload.drawnEdges) board.markEdgeDrawn(edgeId, 'var(--dot-color)')
      for (const [boxId, ownerId] of payload.boxOwners) board.markBoxOwned(boxId, playerColorVar(ownerId))
      scoreboard.updateScores(payload.players)

      if (payload.status === 'game_over') {
        board.setInputEnabled(false)
        showOnlineGameOver(payload.players, payload.winnerIds)
        return
      }

      scoreboard.setActivePlayer(players[currentPlayerIndex].id)
      board.setInputEnabled(isMyTurn())
    })
  }

  // ---------- Entry point ----------

  const roomCode = new URLSearchParams(location.search).get('room')
  if (roomCode) {
    showJoinRoom(roomCode.toUpperCase())
  } else {
    showModeSelect()
  }
}
