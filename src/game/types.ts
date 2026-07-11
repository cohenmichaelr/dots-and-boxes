export type Orientation = 'H' | 'V'

/** Canonical edge key, e.g. `H:0:2` (horizontal edge above box row 0, col 2) or `V:1:3`. */
export type EdgeId = string

export type DotId = string

export type BoxId = string

export type PlayerId = number

export type PlayerType = 'human' | 'computer'

export type AiDifficulty = 'easy' | 'medium' | 'hard'

export interface Player {
  id: PlayerId
  name: string
  type: PlayerType
  difficulty?: AiDifficulty
  color: string
  score: number
}

export interface BoardSize {
  rows: number
  cols: number
  label: string
}

export interface Dot {
  id: DotId
  row: number
  col: number
}

export interface EdgeInfo {
  id: EdgeId
  orientation: Orientation
  row: number
  col: number
  dotA: DotId
  dotB: DotId
  boxIds: BoxId[]
}

export interface BoxInfo {
  id: BoxId
  row: number
  col: number
  edgeIds: [EdgeId, EdgeId, EdgeId, EdgeId]
}

export interface Board {
  size: BoardSize
  dots: Map<DotId, Dot>
  edges: Map<EdgeId, EdgeInfo>
  boxes: Map<BoxId, BoxInfo>
}

export type GameStatus = 'in_progress' | 'game_over'

export interface GameState {
  board: Board
  players: Player[]
  drawnEdges: Set<EdgeId>
  boxOwners: Map<BoxId, PlayerId>
  currentPlayerIndex: number
  status: GameStatus
  winnerIds: PlayerId[]
}

export interface PlayerSetupConfig {
  name: string
  type: PlayerType
  difficulty?: AiDifficulty
  color: string
}

export interface GameSetupConfig {
  players: PlayerSetupConfig[]
  boardSize: BoardSize
}
