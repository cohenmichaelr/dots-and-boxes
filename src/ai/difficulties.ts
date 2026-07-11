import { boxesForEdge } from '../game/board'
import type { AiDifficulty, EdgeId, GameState } from '../game/types'
import { doubleCrossMove, findChains, shortChains, shouldControlOrRelease } from './chains'
import { classifyMoves, edgeCountForBox } from './moveClassification'

function randomChoice(edges: EdgeId[]): EdgeId {
  return edges[Math.floor(Math.random() * edges.length)]
}

/** How many touched boxes this safe move would newly turn into a 2-undrawn-edge "chain link". Lower is better. */
function chainRiskScore(state: GameState, edgeId: EdgeId): number {
  return boxesForEdge(state.board, edgeId).filter((boxId) => edgeCountForBox(state, boxId) === 1).length
}

function lowestRiskMove(state: GameState, safeMoves: EdgeId[]): EdgeId {
  let best = safeMoves[0]
  let bestScore = chainRiskScore(state, best)
  for (const edgeId of safeMoves.slice(1)) {
    const score = chainRiskScore(state, edgeId)
    if (score < bestScore) {
      best = edgeId
      bestScore = score
    }
  }
  return best
}

function chooseEasyMove(state: GameState): EdgeId {
  const { completing, safe, unsafe } = classifyMoves(state)
  if (completing.length) return randomChoice(completing)
  if (safe.length) return randomChoice(safe)
  return randomChoice(unsafe)
}

function chooseMediumMove(state: GameState): EdgeId {
  const { completing, safe, unsafe } = classifyMoves(state)
  if (completing.length) return randomChoice(completing)
  if (safe.length) return lowestRiskMove(state, safe)
  return randomChoice(unsafe)
}

function chooseHardMove(state: GameState): EdgeId {
  const { completing, safe, unsafe } = classifyMoves(state)

  if (completing.length) {
    const chains = findChains(state)
    if (shouldControlOrRelease(chains) === 'control') {
      for (const chain of chains) {
        if (chain.length < 3) continue
        const sacrifice = doubleCrossMove(state, chain)
        if (sacrifice) return sacrifice
      }
    }
    return completing[0]
  }

  if (safe.length) return lowestRiskMove(state, safe)

  // Forced to give away a chain: sacrifice the shortest one available.
  const sorted = shortChains(state)
  for (const chain of sorted) {
    const chainBoxes = new Set(chain.boxIds)
    const opener = unsafe.find((edgeId) => boxesForEdge(state.board, edgeId).some((boxId) => chainBoxes.has(boxId)))
    if (opener) return opener
  }
  return randomChoice(unsafe)
}

export function chooseMove(state: GameState, difficulty: AiDifficulty): EdgeId {
  switch (difficulty) {
    case 'easy':
      return chooseEasyMove(state)
    case 'medium':
      return chooseMediumMove(state)
    case 'hard':
      return chooseHardMove(state)
  }
}
