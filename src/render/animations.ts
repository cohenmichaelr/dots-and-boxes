import type { BoxId } from '../game/types'

export const BOX_FILL_DELAY_MS = 150
export const CHAIN_STAGGER_MS = 90

/** Applies a per-box callback with an incremental delay so multi-box chain completions cascade rather than pop at once. */
export function scheduleBoxFills(boxIds: BoxId[], apply: (boxId: BoxId, index: number) => void): void {
  boxIds.forEach((boxId, index) => {
    setTimeout(() => apply(boxId, index), BOX_FILL_DELAY_MS + index * CHAIN_STAGGER_MS)
  })
}
