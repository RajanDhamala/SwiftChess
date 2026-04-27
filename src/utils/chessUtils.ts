import { Chess } from 'chess.js'
import type { Square, Move } from 'chess.js'

// Convert chess.js board to our piece map
export function boardFromFen(fen: string): Record<string, string> {
  const chess = new Chess(fen)
  const board = chess.board()
  const pieces: Record<string, string> = {}

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (piece) {
        const file = String.fromCharCode(97 + col) // a-h
        const rank = 8 - row // 8-1
        const square = `${file}${rank}`
        const color = piece.color === 'w' ? 'w' : 'b'
        const type = piece.type.toUpperCase()
        const pieceKey = `${color}${type}`
        pieces[square] = pieceKey
      }
    }
  }
  return pieces
}

// Get square coordinates from col/row
export function getSquareName(col: number, row: number, flipped: boolean): string {
  const file = flipped ? String.fromCharCode(104 - col) : String.fromCharCode(97 + col) // a-h
  const rank = flipped ? row + 1 : 8 - row
  return `${file}${rank}`
}

// Get col/row from square name
export function getSquareCoords(square: string, flipped: boolean): { col: number; row: number } {
  const file = square.charCodeAt(0) - 97 // 0-7
  const rank = parseInt(square[1]) // 1-8

  if (flipped) {
    return { col: 7 - file, row: rank - 1 }
  }
  return { col: file, row: 8 - rank }
}

// Get legal moves for a square
export function getLegalMoves(chess: Chess, square: string): Move[] {
  try {
    return chess.moves({ square: square as Square, verbose: true })
  } catch {
    return []
  }
}

// Check if a move is legal
export function isLegalMove(chess: Chess, from: string, to: string): Move | null {
  const moves = getLegalMoves(chess, from)
  return moves.find(m => m.to === to) || null
}

// Check if move needs promotion
export function needsPromotion(chess: Chess, from: string, to: string): boolean {
  const moves = chess.moves({ square: from as Square, verbose: true })
  return moves.some(m => m.to === to && m.promotion)
}

// Get the square color
export function getSquareColor(col: number, row: number): 'light' | 'dark' {
  return (col + row) % 2 === 0 ? 'light' : 'dark'
}

function toFileRank(square: string) {
  const file = square.charCodeAt(0) - 97
  const rank = Number(square[1])
  return { file, rank }
}

function fromFileRank(file: number, rank: number): string | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null
  return `${String.fromCharCode(97 + file)}${rank}`
}

function pushSquare(targets: Set<string>, file: number, rank: number) {
  const square = fromFileRank(file, rank)
  if (square) targets.add(square)
}

export function getRelaxedPremoveTargets(
  pieces: Record<string, string>,
  from: string,
  castlingRights = '-',
): string[] {
  const piece = pieces[from]
  if (!piece) return []

  const color = piece[0]
  const type = piece[1]
  const { file, rank } = toFileRank(from)
  const targets = new Set<string>()

  if (type === 'P') {
    const direction = color === 'w' ? 1 : -1
    const startRank = color === 'w' ? 2 : 7
    pushSquare(targets, file, rank + direction)
    if (rank === startRank) pushSquare(targets, file, rank + direction * 2)
    pushSquare(targets, file - 1, rank + direction)
    pushSquare(targets, file + 1, rank + direction)
  }

  if (type === 'N') {
    const jumps = [
      [1, 2], [2, 1], [2, -1], [1, -2],
      [-1, -2], [-2, -1], [-2, 1], [-1, 2],
    ]
    for (const [dx, dy] of jumps) {
      pushSquare(targets, file + dx, rank + dy)
    }
  }

  if (type === 'B' || type === 'R' || type === 'Q') {
    const directions: Array<[number, number]> = []
    if (type === 'B' || type === 'Q') {
      directions.push([1, 1], [1, -1], [-1, -1], [-1, 1])
    }
    if (type === 'R' || type === 'Q') {
      directions.push([1, 0], [-1, 0], [0, 1], [0, -1])
    }
    for (const [dx, dy] of directions) {
      let nextFile = file + dx
      let nextRank = rank + dy
      while (nextFile >= 0 && nextFile <= 7 && nextRank >= 1 && nextRank <= 8) {
        pushSquare(targets, nextFile, nextRank)
        nextFile += dx
        nextRank += dy
      }
    }
  }

  if (type === 'K') {
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue
        pushSquare(targets, file + dx, rank + dy)
      }
    }

    // In relaxed premove mode, include castle squares from rights while ignoring blockers/check.
    if (color === 'w' && from === 'e1') {
      if (castlingRights.includes('K')) targets.add('g1')
      if (castlingRights.includes('Q')) targets.add('c1')
    }
    if (color === 'b' && from === 'e8') {
      if (castlingRights.includes('k')) targets.add('g8')
      if (castlingRights.includes('q')) targets.add('c8')
    }
  }

  targets.delete(from)
  return Array.from(targets)
}
