import type { DataConnection } from 'peerjs'
import { chooseMove } from '../ai'
import { createGameState, createPlayers, playTurn } from '../game'
import type { BoardSize, EdgeId, GameState, Player, PlayerId, PlayerSetupConfig } from '../game/types'
import { createHostPeer } from './peerConnection'
import type {
  GuestToHostMessage,
  HostToGuestMessage,
  LastMove,
  LobbyInfo,
  OnlineGameSession,
  StatePayload,
  WireAiSlot,
  WirePlayer,
} from './protocol'

// Kept in sync with the local hotseat mode's AI_MOVE_DELAY_MS in ui/app.ts by convention (same pacing feel);
// duplicated rather than imported since `net` must not depend on the `ui` layer.
const AI_MOVE_DELAY_MS = 550
const MAX_PLAYERS = 4

export interface HostSessionConfig {
  boardSize: BoardSize
  hostName: string
  hostColor: string
  aiSlots: WireAiSlot[]
}

export interface HostSession extends OnlineGameSession {
  code: string
  onLobbyUpdate(cb: (lobby: LobbyInfo) => void): void
  onGameStarted(cb: (boardSize: BoardSize, players: WirePlayer[]) => void): void
  canStart(): boolean
  startGame(): void
}

interface Participant {
  connection: DataConnection | null
  playerId: PlayerId
  name: string
  color: string
  isHost: boolean
}

function toWirePlayer(player: Player): WirePlayer {
  return {
    id: player.id,
    name: player.name,
    type: player.type,
    difficulty: player.difficulty,
    color: player.color,
    score: player.score,
  }
}

export async function createHostSession(config: HostSessionConfig): Promise<HostSession> {
  const { peer, code } = await createHostPeer()

  const participants: Participant[] = [
    { connection: null, playerId: 0, name: config.hostName, color: config.hostColor, isHost: true },
  ]
  let nextPlayerId = 1
  let state: GameState | null = null
  let aiTimer: ReturnType<typeof setTimeout> | null = null

  let lobbyCb: ((lobby: LobbyInfo) => void) | null = null
  let gameStartedCb: ((boardSize: BoardSize, players: WirePlayer[]) => void) | null = null
  let stateCb: ((payload: StatePayload) => void) | null = null

  function send(connection: DataConnection, message: HostToGuestMessage): void {
    connection.send(message)
  }

  function takenColors(): Set<string> {
    return new Set([...participants.map((p) => p.color), ...config.aiSlots.map((a) => a.color)])
  }

  function totalSlots(): number {
    return participants.length + config.aiSlots.length
  }

  function buildLobbyInfo(): LobbyInfo {
    return {
      boardSize: config.boardSize,
      aiPlayers: config.aiSlots,
      participants: participants.map((p) => ({
        playerId: p.playerId,
        name: p.name,
        color: p.color,
        isHost: p.isHost,
      })),
    }
  }

  function broadcastLobby(): void {
    const lobby = buildLobbyInfo()
    lobbyCb?.(lobby)
    for (const p of participants) {
      if (p.connection) send(p.connection, { type: 'lobbyUpdate', ...lobby })
    }
  }

  function emitState(lastMove: LastMove | null): void {
    if (!state) return
    const payload: StatePayload = {
      drawnEdges: [...state.drawnEdges],
      boxOwners: [...state.boxOwners.entries()],
      players: state.players.map(toWirePlayer),
      currentPlayerIndex: state.currentPlayerIndex,
      status: state.status,
      winnerIds: state.winnerIds,
      lastMove,
    }
    stateCb?.(payload)
    for (const p of participants) {
      if (p.connection) send(p.connection, { type: 'state', ...payload })
    }
  }

  function maybeRunAiTurn(): void {
    if (!state || state.status === 'game_over' || aiTimer) return
    const mover = state.players[state.currentPlayerIndex]
    if (mover.type !== 'computer' || !mover.difficulty) return
    aiTimer = setTimeout(() => {
      aiTimer = null
      if (!state || state.status === 'game_over') return
      applyMoveAndBroadcast(chooseMove(state, mover.difficulty!))
    }, AI_MOVE_DELAY_MS)
  }

  function applyMoveAndBroadcast(edgeId: EdgeId): void {
    if (!state) return
    const moverId = state.players[state.currentPlayerIndex].id
    const { state: nextState, completedBoxIds } = playTurn(state, edgeId)
    state = nextState
    emitState({ edgeId, completedBoxIds, moverId })
    maybeRunAiTurn()
  }

  function handleGuestMessage(connection: DataConnection, message: GuestToHostMessage): void {
    if (message.type === 'join') {
      if (state) {
        send(connection, { type: 'roomError', message: 'This game has already started.' })
        return
      }
      if (totalSlots() >= MAX_PLAYERS) {
        send(connection, { type: 'joinAck', ok: false, error: 'Room is full.' })
        return
      }
      if (takenColors().has(message.color)) {
        send(connection, { type: 'joinAck', ok: false, error: 'That color was just taken.' })
        return
      }
      const playerId = nextPlayerId++
      participants.push({
        connection,
        playerId,
        name: message.name.trim() || `Player ${playerId + 1}`,
        color: message.color,
        isHost: false,
      })
      send(connection, { type: 'joinAck', ok: true, playerId })
      broadcastLobby()
      return
    }

    if (message.type === 'move') {
      if (!state) return
      const participant = participants.find((p) => p.connection === connection)
      if (!participant) return
      if (state.players[state.currentPlayerIndex].id !== participant.playerId) return
      applyMoveAndBroadcast(message.edgeId)
    }
  }

  function handleDisconnect(connection: DataConnection): void {
    const index = participants.findIndex((p) => p.connection === connection)
    if (index === -1) return
    participants.splice(index, 1)
    if (!state) broadcastLobby()
  }

  // PeerJS can emit 'connection' more than once for the same incoming DataConnection
  // (observed in practice); guard so listeners are only ever wired up once per connection.
  const wiredConnectionIds = new Set<string>()
  peer.on('connection', (connection) => {
    if (wiredConnectionIds.has(connection.connectionId)) return
    wiredConnectionIds.add(connection.connectionId)
    connection.on('data', (data) => handleGuestMessage(connection, data as GuestToHostMessage))
    connection.on('close', () => handleDisconnect(connection))
  })

  return {
    code,
    localPlayerId: 0,
    onLobbyUpdate(cb) {
      lobbyCb = cb
      cb(buildLobbyInfo())
    },
    onGameStarted(cb) {
      gameStartedCb = cb
    },
    onState(cb) {
      stateCb = cb
    },
    canStart() {
      return !state && totalSlots() >= 2
    },
    startGame() {
      if (state || totalSlots() < 2) return
      const configs: PlayerSetupConfig[] = [
        ...participants.map((p): PlayerSetupConfig => ({ name: p.name, type: 'human', color: p.color })),
        ...config.aiSlots.map(
          (a): PlayerSetupConfig => ({ name: 'Computer', type: 'computer', difficulty: a.difficulty, color: a.color }),
        ),
      ]
      const players = createPlayers(configs)
      state = createGameState(config.boardSize, players)
      const wirePlayers = players.map(toWirePlayer)
      gameStartedCb?.(config.boardSize, wirePlayers)
      for (const p of participants) {
        if (p.connection) send(p.connection, { type: 'gameStarted', boardSize: config.boardSize, players: wirePlayers })
      }
      emitState(null)
      maybeRunAiTurn()
    },
    submitMove(edgeId) {
      if (!state || state.status === 'game_over') return
      if (state.players[state.currentPlayerIndex].id !== 0) return
      applyMoveAndBroadcast(edgeId)
    },
    destroy() {
      if (aiTimer) clearTimeout(aiTimer)
      peer.destroy()
    },
  }
}
