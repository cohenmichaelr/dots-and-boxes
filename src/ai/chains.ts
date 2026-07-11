import { boxesForEdge, edgesForBox, neighborBoxes } from '../game/board'
import type { BoxId, EdgeId, GameState } from '../game/types'
import { edgeCountForBox } from './moveClassification'

export interface Chain {
  boxIds: BoxId[]
  isLoop: boolean
  isOpen: boolean
  length: number
}

/** Adjacency among boxes that are "mid-chain" (exactly 2 undrawn edges), linked when they share an undrawn edge. */
function buildRegionGraph(state: GameState): Map<BoxId, BoxId[]> {
  const graph = new Map<BoxId, BoxId[]>()
  const chainBoxes = [...state.board.boxes.keys()].filter((boxId) => edgeCountForBox(state, boxId) === 2)
  const chainBoxSet = new Set(chainBoxes)

  for (const boxId of chainBoxes) {
    const neighbors = neighborBoxes(state.board, boxId).filter((n) => chainBoxSet.has(n))
    graph.set(boxId, neighbors)
  }
  return graph
}

/**
 * Groups mid-chain boxes into connected chains (open runs) or loops (closed
 * cycles), per standard Dots and Boxes chain theory. Ordering within a chain
 * follows a walk from an endpoint (or an arbitrary start for a loop) so
 * "remaining boxes" during a capture sweep stay in a sensible sequence.
 */
export function findChains(state: GameState): Chain[] {
  const graph = buildRegionGraph(state)
  const visited = new Set<BoxId>()
  const chains: Chain[] = []

  for (const startId of graph.keys()) {
    if (visited.has(startId)) continue

    // Collect the connected component first.
    const component = new Set<BoxId>()
    const stack = [startId]
    while (stack.length) {
      const current = stack.pop()!
      if (component.has(current)) continue
      component.add(current)
      for (const neighbor of graph.get(current) ?? []) {
        if (!component.has(neighbor)) stack.push(neighbor)
      }
    }
    for (const id of component) visited.add(id)

    let internalEdgeCount = 0
    for (const id of component) internalEdgeCount += (graph.get(id) ?? []).length
    internalEdgeCount /= 2

    const isLoop = internalEdgeCount === component.size

    // Walk the component in order, starting from an endpoint (degree <= 1) when open.
    const start = isLoop
      ? component.values().next().value!
      : [...component].find((id) => (graph.get(id) ?? []).length <= 1) ?? component.values().next().value!

    const ordered: BoxId[] = []
    const walked = new Set<BoxId>()
    let cursor: BoxId | undefined = start
    let previous: BoxId | null = null
    while (cursor && !walked.has(cursor)) {
      ordered.push(cursor)
      walked.add(cursor)
      const neighbors: BoxId[] = (graph.get(cursor) ?? []).filter((n: BoxId) => n !== previous)
      previous = cursor
      cursor = neighbors.find((n: BoxId) => !walked.has(n))
    }
    // Include any component members a simple walk missed (branchy/degenerate topology).
    for (const id of component) if (!walked.has(id)) ordered.push(id)

    chains.push({ boxIds: ordered, isLoop, isOpen: !isLoop, length: ordered.length })
  }

  return chains
}

export function shortChains(state: GameState): Chain[] {
  return [...findChains(state)].sort((a, b) => a.length - b.length)
}

/**
 * The advanced "double-cross" sacrifice: instead of greedily capturing every
 * box in a chain, decline the last 2 boxes (4 for a loop) by playing the
 * outer edge of a still-uncaptured box rather than the edge that would
 * complete it. This leaves a free "domino" for the opponent but forces them
 * to make the next move that opens a new chain, keeping control. Simplified
 * heuristic (not exhaustive game-theoretic play): returns null unless the
 * chain has been swept down to exactly the sacrifice threshold.
 */
export function doubleCrossMove(state: GameState, chain: Chain): EdgeId | null {
  const sacrificeSize = chain.isLoop ? 4 : 2
  const remaining = chain.boxIds.filter((boxId) => edgeCountForBox(state, boxId) < 4)
  if (remaining.length !== sacrificeSize) return null

  const remainingSet = new Set(remaining)
  const isNonCompleting = (edgeId: EdgeId) =>
    boxesForEdge(state.board, edgeId).every((boxId) => edgeCountForBox(state, boxId) !== 3)

  // Prefer a true "outer" edge (not shared between two still-remaining boxes) on a box that's not yet capturable.
  for (const boxId of remaining.filter((id) => edgeCountForBox(state, id) === 2)) {
    const undrawn = edgesForBox(state.board, boxId).filter((edgeId) => !state.drawnEdges.has(edgeId))
    for (const edgeId of undrawn) {
      const touched = boxesForEdge(state.board, edgeId)
      const isInternal = touched.length === 2 && touched.every((b) => remainingSet.has(b))
      if (!isInternal && isNonCompleting(edgeId)) return edgeId
    }
  }

  // Fallback: any non-completing undrawn edge touching the remaining group.
  for (const boxId of remaining) {
    const undrawn = edgesForBox(state.board, boxId).filter((edgeId) => !state.drawnEdges.has(edgeId))
    const candidate = undrawn.find(isNonCompleting)
    if (candidate) return candidate
  }

  return null
}

/** Simplified control heuristic: keep control (double-cross) while more than one long chain remains. */
export function shouldControlOrRelease(chains: Chain[]): 'control' | 'release' {
  const longChains = chains.filter((c) => c.length >= 3).length
  return longChains > 1 ? 'control' : 'release'
}
