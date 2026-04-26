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
