import { Chess } from 'chess.js'
import type { Square, Move } from 'chess.js'

// Convert chess.js board to our piece map
export function boardFromFen(fen: string): Record<string, string> {
  const chess = new Chess(fen)
  const board = chess.board()
  console.log("numerical board :",   board)
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
        // const pieceKey = type === 'P' ? `${color}P` :
        //                  type === 'N' ? `${color}N` :
        //                  type === 'B' ? `${color}B` :
        //                  type === 'R' ? `${color}R` :
        //                  type === 'Q' ? `${color}Q` :
        //                  `${color}K`
         let pieceKey;
        if (type === 'P') {
          pieceKey = `${color}P`;
        } else if (type === 'N') {
          pieceKey = `${color}N`;
        } else if (type === 'B') {
          pieceKey = `${color}B`;
        } else if (type === 'R') {
          pieceKey = `${color}R`;
        } else if (type === 'Q') {
          pieceKey = `${color}Q`;
        } else {
          pieceKey = `${color}K`; // default to King if none of the above
        }
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
