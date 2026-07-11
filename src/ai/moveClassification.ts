import { boxesForEdge, edgesForBox } from '../game/board'
import type { BoxId, EdgeId, GameState } from '../game/types'

export function edgeCountForBox(state: GameState, boxId: BoxId): number {
  return edgesForBox(state.board, boxId).filter((edgeId) => state.drawnEdges.has(edgeId)).length
}

/** Boxes that would reach 4/4 drawn edges if this (currently undrawn) edge were drawn. */
export function wouldCompleteBox(state: GameState, edgeId: EdgeId): BoxId[] {
  return boxesForEdge(state.board, edgeId).filter((boxId) => edgeCountForBox(state, boxId) === 3)
}

/** A move is unsafe if it leaves any touched box with exactly 3 drawn edges (a free box for the opponent). */
export function isSafeMove(state: GameState, edgeId: EdgeId): boolean {
  return boxesForEdge(state.board, edgeId).every((boxId) => edgeCountForBox(state, boxId) !== 2)
}

export function getAllLegalMoves(state: GameState): EdgeId[] {
  return [...state.board.edges.keys()].filter((edgeId) => !state.drawnEdges.has(edgeId))
}

export interface ClassifiedMoves {
  completing: EdgeId[]
  safe: EdgeId[]
  unsafe: EdgeId[]
}

export function classifyMoves(state: GameState): ClassifiedMoves {
  const completing: EdgeId[] = []
  const safe: EdgeId[] = []
  const unsafe: EdgeId[] = []

  for (const edgeId of getAllLegalMoves(state)) {
    if (wouldCompleteBox(state, edgeId).length > 0) {
      completing.push(edgeId)
    } else if (isSafeMove(state, edgeId)) {
      safe.push(edgeId)
    } else {
      unsafe.push(edgeId)
    }
  }

  return { completing, safe, unsafe }
}
