import { boxesForEdge, createBoard } from './board'
import type { BoardSize, BoxId, EdgeId, GameState, Player, PlayerId } from './types'

export function createGameState(size: BoardSize, players: Player[]): GameState {
  return {
    board: createBoard(size),
    players,
    drawnEdges: new Set<EdgeId>(),
    boxOwners: new Map<BoxId, PlayerId>(),
    currentPlayerIndex: 0,
    status: 'in_progress',
    winnerIds: [],
  }
}

export function isMoveLegal(state: GameState, edgeId: EdgeId): boolean {
  return state.board.edges.has(edgeId) && !state.drawnEdges.has(edgeId)
}

export function isBoardFull(state: GameState): boolean {
  return state.drawnEdges.size === state.board.edges.size
}

export interface MoveResult {
  state: GameState
  completedBoxIds: BoxId[]
}

function boxEdgeCount(state: GameState, boxId: BoxId): number {
  const box = state.board.boxes.get(boxId)
  if (!box) throw new Error(`Unknown box: ${boxId}`)
  return box.edgeIds.filter((edgeId) => state.drawnEdges.has(edgeId)).length
}

/**
 * Draws an edge and scores any box(es) it completes. Returns a new state
 * (players array is cloned with updated scores) plus the ids of boxes
 * completed by this specific move, which drives the extra-turn rule.
 */
export function applyMove(state: GameState, edgeId: EdgeId): MoveResult {
  if (!isMoveLegal(state, edgeId)) {
    throw new Error(`Illegal move: ${edgeId}`)
  }

  const drawnEdges = new Set(state.drawnEdges)
  drawnEdges.add(edgeId)

  const boxOwners = new Map(state.boxOwners)
  const completedBoxIds: BoxId[] = []
  const scoringPlayerId = state.players[state.currentPlayerIndex].id

  const nextState: GameState = { ...state, drawnEdges, boxOwners }

  for (const boxId of boxesForEdge(state.board, edgeId)) {
    if (boxEdgeCount(nextState, boxId) === 4) {
      boxOwners.set(boxId, scoringPlayerId)
      completedBoxIds.push(boxId)
    }
  }

  const players = completedBoxIds.length
    ? state.players.map((p) => (p.id === scoringPlayerId ? { ...p, score: p.score + completedBoxIds.length } : p))
    : state.players

  return { state: { ...nextState, players }, completedBoxIds }
}

/** Completing a box grants an immediate extra turn; only rotate on a non-scoring move. */
export function advanceTurn(state: GameState, completedBoxIds: BoxId[]): GameState {
  if (completedBoxIds.length > 0) return state
  return { ...state, currentPlayerIndex: (state.currentPlayerIndex + 1) % state.players.length }
}

export function checkGameOver(state: GameState): GameState {
  if (!isBoardFull(state)) return state
  const maxScore = Math.max(...state.players.map((p) => p.score))
  const winnerIds = state.players.filter((p) => p.score === maxScore).map((p) => p.id)
  return { ...state, status: 'game_over', winnerIds }
}

/**
 * Single orchestrating entry point for a move: applies it, checks for
 * game-over, then advances the turn (skipped if the game just ended). Both
 * human clicks and AI moves must go through this function.
 */
export function playTurn(state: GameState, edgeId: EdgeId): MoveResult {
  const { state: appliedState, completedBoxIds } = applyMove(state, edgeId)
  const checkedState = checkGameOver(appliedState)
  const finalState = checkedState.status === 'game_over' ? checkedState : advanceTurn(checkedState, completedBoxIds)
  return { state: finalState, completedBoxIds }
}
