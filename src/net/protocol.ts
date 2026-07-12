import type { AiDifficulty, BoardSize, BoxId, EdgeId, GameStatus, PlayerId, PlayerType } from '../game/types'

export interface WireParticipant {
  playerId: PlayerId
  name: string
  color: string
  isHost: boolean
}

export interface WireAiSlot {
  difficulty: AiDifficulty
  color: string
}

export interface WirePlayer {
  id: PlayerId
  name: string
  type: PlayerType
  difficulty?: AiDifficulty
  color: string
  score: number
}

export interface LastMove {
  edgeId: EdgeId
  completedBoxIds: BoxId[]
  moverId: PlayerId
}

export interface LobbyInfo {
  boardSize: BoardSize
  aiPlayers: WireAiSlot[]
  participants: WireParticipant[]
}

export interface StatePayload {
  drawnEdges: EdgeId[]
  boxOwners: Array<[BoxId, PlayerId]>
  players: WirePlayer[]
  currentPlayerIndex: number
  status: GameStatus
  winnerIds: PlayerId[]
  lastMove: LastMove | null
}

export type GuestToHostMessage =
  | { type: 'join'; name: string; color: string }
  | { type: 'move'; edgeId: EdgeId }

export type HostToGuestMessage =
  | { type: 'joinAck'; ok: true; playerId: PlayerId }
  | { type: 'joinAck'; ok: false; error: string }
  | ({ type: 'lobbyUpdate' } & LobbyInfo)
  | { type: 'gameStarted'; boardSize: BoardSize; players: WirePlayer[] }
  | ({ type: 'state' } & StatePayload)
  | { type: 'roomError'; message: string }

export type PeerMessage = GuestToHostMessage | HostToGuestMessage

/** Common shape both HostSession and GuestSession expose to the UI layer once a game is in progress. */
export interface OnlineGameSession {
  localPlayerId: PlayerId
  onState(cb: (payload: StatePayload) => void): void
  submitMove(edgeId: EdgeId): void
  destroy(): void
}
