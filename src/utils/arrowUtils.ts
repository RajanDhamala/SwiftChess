import { getSquareCoords } from './chessUtils'

export function getArrowPoints(from: string, to: string, isFlipped: boolean, squareSize: number) {
  const fromCoords = getSquareCoords(from, isFlipped)
  const toCoords = getSquareCoords(to, isFlipped)
  return {
    x1: fromCoords.col * squareSize + squareSize / 2,
    y1: fromCoords.row * squareSize + squareSize / 2,
    x2: toCoords.col * squareSize + squareSize / 2,
    y2: toCoords.row * squareSize + squareSize / 2,
  }
}

export function buildArrowPath(
  from: string,
  to: string,
  isFlipped: boolean,
  squareSize: number,
  lengthReducer: number,
): string | null {
  const { x1, y1, x2, y2 } = getArrowPoints(from, to, isFlipped, squareSize)
  const dx = x2 - x1
  const dy = y2 - y1
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return null

  const startOffset = squareSize * 0.3
  const knightDistance = Math.hypot(1, 2) * squareSize

  if (Math.round(distance) === Math.round(knightDistance)) {
    const isVerticalFirst = Math.abs(dx) < Math.abs(dy)
    const start = isVerticalFirst
      ? { x: x1, y: y1 + Math.sign(dy) * startOffset }
      : { x: x1 + Math.sign(dx) * startOffset, y: y1 }
    const corner = isVerticalFirst ? { x: x1, y: y2 } : { x: x2, y: y1 }
    const finalDx = x2 - corner.x
    const finalDy = y2 - corner.y
    const finalLegLength = Math.hypot(finalDx, finalDy)
    const shortenedFinalLeg = Math.max(finalLegLength - lengthReducer, 0)
    const end = finalLegLength > 0
      ? {
        x: corner.x + (finalDx * shortenedFinalLeg) / finalLegLength,
        y: corner.y + (finalDy * shortenedFinalLeg) / finalLegLength,
      }
      : corner
    return `M${start.x},${start.y} L${corner.x},${corner.y} L${end.x},${end.y}`
  }

  const shortenedDistance = Math.max(distance - lengthReducer, 0)
  const start = {
    x: x1 + (dx * startOffset) / distance,
    y: y1 + (dy * startOffset) / distance,
  }
  const end = {
    x: x1 + (dx * shortenedDistance) / distance,
    y: y1 + (dy * shortenedDistance) / distance,
  }
  return `M${start.x},${start.y} L${end.x},${end.y}`
}

interface Point {
  x: number
  y: number
}

export interface ArrowShape {
  shaftD: string
  headPoints: string
}

function formatPoint(point: Point) {
  return `${point.x},${point.y}`
}

function buildArrowHead(tip: Point, previous: Point, squareSize: number): { baseCenter: Point; points: string } | null {
  const dx = tip.x - previous.x
  const dy = tip.y - previous.y
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return null

  const ux = dx / distance
  const uy = dy / distance
  const px = -uy
  const py = ux
  const headLength = Math.min(squareSize * 0.46, distance * 0.68)
  const headWidth = Math.min(squareSize * 0.42, headLength * 1.25)
  const baseCenter = {
    x: tip.x - ux * headLength,
    y: tip.y - uy * headLength,
  }
  const left = {
    x: baseCenter.x + px * headWidth / 2,
    y: baseCenter.y + py * headWidth / 2,
  }
  const right = {
    x: baseCenter.x - px * headWidth / 2,
    y: baseCenter.y - py * headWidth / 2,
  }

  return {
    baseCenter,
    points: `${formatPoint(left)} ${formatPoint(tip)} ${formatPoint(right)}`,
  }
}

export function buildArrowShape(
  from: string,
  to: string,
  isFlipped: boolean,
  squareSize: number,
  _lengthReducer: number,
): ArrowShape | null {
  const { x1, y1, x2, y2 } = getArrowPoints(from, to, isFlipped, squareSize)
  const dx = x2 - x1
  const dy = y2 - y1
  const distance = Math.hypot(dx, dy)
  if (distance === 0) return null

  const knightDistance = Math.hypot(1, 2) * squareSize
  const start = { x: x1, y: y1 }
  const tip = { x: x2, y: y2 }

  if (Math.round(distance) === Math.round(knightDistance)) {
    const isVerticalFirst = Math.abs(dx) < Math.abs(dy)
    const corner = isVerticalFirst ? { x: x1, y: y2 } : { x: x2, y: y1 }
    const head = buildArrowHead(tip, corner, squareSize)
    if (!head) return null

    return {
      shaftD: `M${start.x},${start.y} L${corner.x},${corner.y} L${head.baseCenter.x},${head.baseCenter.y}`,
      headPoints: head.points,
    }
  }

  const head = buildArrowHead(tip, start, squareSize)
  if (!head) return null

  return {
    shaftD: `M${start.x},${start.y} L${head.baseCenter.x},${head.baseCenter.y}`,
    headPoints: head.points,
  }
}
