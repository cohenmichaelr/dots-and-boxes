import { adjacentDots, edgeBetweenDots, edgeDotPositions } from '../game/board'
import type { Board, BoxId, DotId, EdgeId } from '../game/types'

const SVG_NS = 'http://www.w3.org/2000/svg'
const CELL_UNIT = 64
const PADDING = 28
const BOX_INSET = 7
const DOT_RADIUS = 5
const DOT_HIT_RADIUS = 17
const EDGE_HIT_WIDTH = 24

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NS, tag)
}

function dotPoint(row: number, col: number): { x: number; y: number } {
  return { x: PADDING + col * CELL_UNIT, y: PADDING + row * CELL_UNIT }
}

export interface SvgBoardHandle {
  element: SVGSVGElement
  onEdgeSelect(callback: (edgeId: EdgeId) => void): void
  markEdgeDrawn(edgeId: EdgeId, color: string): void
  markBoxOwned(boxId: BoxId, color: string): void
  setInputEnabled(enabled: boolean): void
  reset(): void
}

export function createSvgBoard(container: HTMLElement, board: Board): SvgBoardHandle {
  const width = PADDING * 2 + board.size.cols * CELL_UNIT
  const height = PADDING * 2 + board.size.rows * CELL_UNIT

  const svg = svgEl('svg')
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`)
  svg.setAttribute('class', 'board-svg')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', 'Dots and Boxes board')

  const boxesGroup = svgEl('g')
  const edgesGroup = svgEl('g')
  const dotsGroup = svgEl('g')
  svg.append(boxesGroup, edgesGroup, dotsGroup)

  const boxEls = new Map<BoxId, SVGRectElement>()
  const edgeEls = new Map<EdgeId, { visible: SVGLineElement; hit: SVGLineElement; length: number }>()
  const dotEls = new Map<DotId, { visible: SVGCircleElement; hit: SVGCircleElement }>()

  for (const box of board.boxes.values()) {
    const rect = svgEl('rect')
    rect.setAttribute('class', 'box')
    rect.setAttribute('x', String(PADDING + box.col * CELL_UNIT + BOX_INSET))
    rect.setAttribute('y', String(PADDING + box.row * CELL_UNIT + BOX_INSET))
    rect.setAttribute('width', String(CELL_UNIT - BOX_INSET * 2))
    rect.setAttribute('height', String(CELL_UNIT - BOX_INSET * 2))
    rect.setAttribute('rx', '8')
    boxesGroup.appendChild(rect)
    boxEls.set(box.id, rect)
  }

  for (const edge of board.edges.values()) {
    const [dotA, dotB] = edgeDotPositions(board, edge.id)
    const a = dotPoint(dotA.row, dotA.col)
    const b = dotPoint(dotB.row, dotB.col)
    const length = Math.hypot(b.x - a.x, b.y - a.y)

    const visible = svgEl('line')
    visible.setAttribute('class', 'edge-visible')
    visible.setAttribute('x1', String(a.x))
    visible.setAttribute('y1', String(a.y))
    visible.setAttribute('x2', String(b.x))
    visible.setAttribute('y2', String(b.y))
    visible.style.strokeDasharray = String(length)
    visible.style.strokeDashoffset = String(length)

    const hit = svgEl('line')
    hit.setAttribute('class', 'edge-hit')
    hit.setAttribute('x1', String(a.x))
    hit.setAttribute('y1', String(a.y))
    hit.setAttribute('x2', String(b.x))
    hit.setAttribute('y2', String(b.y))
    hit.setAttribute('stroke-width', String(EDGE_HIT_WIDTH))
    hit.setAttribute('stroke-linecap', 'round')

    edgesGroup.append(visible, hit)
    edgeEls.set(edge.id, { visible, hit, length })
  }

  for (const dot of board.dots.values()) {
    const p = dotPoint(dot.row, dot.col)

    const visible = svgEl('circle')
    visible.setAttribute('class', 'dot-visible')
    visible.setAttribute('cx', String(p.x))
    visible.setAttribute('cy', String(p.y))
    visible.setAttribute('r', String(DOT_RADIUS))

    const hit = svgEl('circle')
    hit.setAttribute('class', 'dot-hit')
    hit.setAttribute('cx', String(p.x))
    hit.setAttribute('cy', String(p.y))
    hit.setAttribute('r', String(DOT_HIT_RADIUS))

    dotsGroup.append(visible, hit)
    dotEls.set(dot.id, { visible, hit })
  }

  container.replaceChildren(svg)

  const drawn = new Set<EdgeId>()
  let selectedDot: DotId | null = null
  let inputEnabled = true
  let onEdgeSelectCb: ((edgeId: EdgeId) => void) | null = null

  function clearHighlights(): void {
    for (const { visible } of dotEls.values()) visible.classList.remove('legal-target')
  }

  function clearSelection(): void {
    if (selectedDot) dotEls.get(selectedDot)?.visible.classList.remove('selected')
    clearHighlights()
    selectedDot = null
  }

  function highlightNeighbors(dotId: DotId): void {
    for (const neighborId of adjacentDots(board, dotId)) {
      const edgeId = edgeBetweenDots(board, dotId, neighborId)
      if (edgeId && !drawn.has(edgeId)) dotEls.get(neighborId)?.visible.classList.add('legal-target')
    }
  }

  function beginSelection(dotId: DotId): void {
    selectedDot = dotId
    dotEls.get(dotId)?.visible.classList.add('selected')
    highlightNeighbors(dotId)
  }

  function selectDot(dotId: DotId): void {
    if (!inputEnabled) return
    if (selectedDot === dotId) {
      clearSelection()
      return
    }
    if (selectedDot) {
      const edgeId = edgeBetweenDots(board, selectedDot, dotId)
      clearSelection()
      if (edgeId && !drawn.has(edgeId)) {
        onEdgeSelectCb?.(edgeId)
        return
      }
      // Not a legal neighbor: treat this tap as the start of a fresh selection.
      beginSelection(dotId)
      return
    }
    beginSelection(dotId)
  }

  function selectEdgeDirect(edgeId: EdgeId): void {
    if (!inputEnabled || drawn.has(edgeId)) return
    clearSelection()
    onEdgeSelectCb?.(edgeId)
  }

  for (const [dotId, { hit }] of dotEls) {
    hit.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      selectDot(dotId)
    })
  }
  for (const [edgeId, { hit }] of edgeEls) {
    hit.addEventListener('pointerdown', (event) => {
      event.preventDefault()
      selectEdgeDirect(edgeId)
    })
  }

  return {
    element: svg,
    onEdgeSelect(callback) {
      onEdgeSelectCb = callback
    },
    markEdgeDrawn(edgeId, color) {
      drawn.add(edgeId)
      const els = edgeEls.get(edgeId)
      if (!els) return
      els.visible.style.stroke = color
      els.visible.style.strokeWidth = '4'
      els.visible.style.strokeDashoffset = '0'
      els.hit.classList.add('drawn')
    },
    markBoxOwned(boxId, color) {
      const rect = boxEls.get(boxId)
      if (!rect) return
      rect.style.fill = color
      rect.classList.add('owned')
    },
    setInputEnabled(enabled) {
      inputEnabled = enabled
      if (!enabled) clearSelection()
    },
    reset() {
      clearSelection()
      drawn.clear()
      for (const { visible, length } of edgeEls.values()) {
        visible.style.stroke = ''
        visible.style.strokeWidth = ''
        visible.style.strokeDashoffset = String(length)
      }
      for (const { hit } of edgeEls.values()) hit.classList.remove('drawn')
      for (const rect of boxEls.values()) {
        rect.classList.remove('owned')
        rect.style.fill = ''
      }
    },
  }
}
