import type { Board, BoardSize, BoxId, BoxInfo, Dot, DotId, EdgeId, EdgeInfo } from './types'

export const BOARD_SIZES: BoardSize[] = [
  { rows: 3, cols: 3, label: 'Small (4x4 dots)' },
  { rows: 4, cols: 4, label: 'Classic (5x5 dots)' },
  { rows: 6, cols: 6, label: 'Large (7x7 dots)' },
]

function dotId(row: number, col: number): DotId {
  return `${row}:${col}`
}

function boxId(row: number, col: number): BoxId {
  return `${row}:${col}`
}

function hEdgeId(row: number, col: number): EdgeId {
  return `H:${row}:${col}`
}

function vEdgeId(row: number, col: number): EdgeId {
  return `V:${row}:${col}`
}

/**
 * Builds the full grid topology for an r x c box grid: (r+1) x (c+1) dots,
 * horizontal edges (r+1) x c, vertical edges r x (c+1), and boxes r x c,
 * each box knowing its 4 bounding edge ids and each edge knowing its 1-2
 * bounding box ids.
 */
export function createBoard(size: BoardSize): Board {
  const { rows, cols } = size

  const dots = new Map<DotId, Dot>()
  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const id = dotId(row, col)
      dots.set(id, { id, row, col })
    }
  }

  const edges = new Map<EdgeId, EdgeInfo>()

  for (let row = 0; row <= rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = hEdgeId(row, col)
      const boxIds: BoxId[] = []
      if (row - 1 >= 0) boxIds.push(boxId(row - 1, col))
      if (row <= rows - 1) boxIds.push(boxId(row, col))
      edges.set(id, {
        id,
        orientation: 'H',
        row,
        col,
        dotA: dotId(row, col),
        dotB: dotId(row, col + 1),
        boxIds,
      })
    }
  }

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col <= cols; col++) {
      const id = vEdgeId(row, col)
      const boxIds: BoxId[] = []
      if (col - 1 >= 0) boxIds.push(boxId(row, col - 1))
      if (col <= cols - 1) boxIds.push(boxId(row, col))
      edges.set(id, {
        id,
        orientation: 'V',
        row,
        col,
        dotA: dotId(row, col),
        dotB: dotId(row + 1, col),
        boxIds,
      })
    }
  }

  const boxes = new Map<BoxId, BoxInfo>()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const id = boxId(row, col)
      const edgeIds: [EdgeId, EdgeId, EdgeId, EdgeId] = [
        hEdgeId(row, col),
        vEdgeId(row, col + 1),
        hEdgeId(row + 1, col),
        vEdgeId(row, col),
      ]
      boxes.set(id, { id, row, col, edgeIds })
    }
  }

  return { size, dots, edges, boxes }
}

export function edgeDotPositions(board: Board, edgeId: EdgeId): [Dot, Dot] {
  const edge = board.edges.get(edgeId)
  if (!edge) throw new Error(`Unknown edge: ${edgeId}`)
  const dotA = board.dots.get(edge.dotA)
  const dotB = board.dots.get(edge.dotB)
  if (!dotA || !dotB) throw new Error(`Malformed edge: ${edgeId}`)
  return [dotA, dotB]
}

export function boxesForEdge(board: Board, edgeId: EdgeId): BoxId[] {
  const edge = board.edges.get(edgeId)
  if (!edge) throw new Error(`Unknown edge: ${edgeId}`)
  return edge.boxIds
}

export function edgesForBox(board: Board, boxId: BoxId): [EdgeId, EdgeId, EdgeId, EdgeId] {
  const box = board.boxes.get(boxId)
  if (!box) throw new Error(`Unknown box: ${boxId}`)
  return box.edgeIds
}

export function neighborBoxes(board: Board, boxId: BoxId): BoxId[] {
  const neighbors: BoxId[] = []
  for (const edgeId of edgesForBox(board, boxId)) {
    for (const neighborId of boxesForEdge(board, edgeId)) {
      if (neighborId !== boxId) neighbors.push(neighborId)
    }
  }
  return neighbors
}

/** Given a dot, the ids of adjacent dots reachable by a single undrawn or drawn edge (used for tap-to-select). */
export function adjacentDots(board: Board, dotId: DotId): DotId[] {
  const dot = board.dots.get(dotId)
  if (!dot) throw new Error(`Unknown dot: ${dotId}`)
  const candidates: Array<{ id: DotId; edgeId: EdgeId }> = [
    { id: `${dot.row}:${dot.col - 1}`, edgeId: hEdgeId(dot.row, dot.col - 1) },
    { id: `${dot.row}:${dot.col + 1}`, edgeId: hEdgeId(dot.row, dot.col) },
    { id: `${dot.row - 1}:${dot.col}`, edgeId: vEdgeId(dot.row - 1, dot.col) },
    { id: `${dot.row + 1}:${dot.col}`, edgeId: vEdgeId(dot.row, dot.col) },
  ]
  return candidates.filter((c) => board.dots.has(c.id) && board.edges.has(c.edgeId)).map((c) => c.id)
}

export function edgeBetweenDots(board: Board, dotIdA: DotId, dotIdB: DotId): EdgeId | null {
  const a = board.dots.get(dotIdA)
  const b = board.dots.get(dotIdB)
  if (!a || !b) return null
  if (a.row === b.row && Math.abs(a.col - b.col) === 1) {
    return hEdgeId(a.row, Math.min(a.col, b.col))
  }
  if (a.col === b.col && Math.abs(a.row - b.row) === 1) {
    return vEdgeId(Math.min(a.row, b.row), a.col)
  }
  return null
}
