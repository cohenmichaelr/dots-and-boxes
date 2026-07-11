export * from './types'
export {
  BOARD_SIZES,
  createBoard,
  edgeDotPositions,
  boxesForEdge,
  edgesForBox,
  neighborBoxes,
  adjacentDots,
  edgeBetweenDots,
} from './board'
export {
  createGameState,
  isMoveLegal,
  isBoardFull,
  applyMove,
  advanceTurn,
  checkGameOver,
  playTurn,
} from './gameState'
export type { MoveResult } from './gameState'
export { DEFAULT_COLORS, createPlayers } from './players'
