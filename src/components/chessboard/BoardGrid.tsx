import React from 'react'
import type { Move } from 'chess.js'
import { PieceComponents } from '../ChessPieces'
import { getSquareColor, getSquareName } from '../../utils/chessUtils'
import { PremoveOverlay } from './PremoveOverlay'
import type { LastMoveState, PremoveState } from './types'

interface BoardGridProps {
  pieces: Record<string, string>
  squareSize: number
  isFlipped: boolean
  selectedSquare: string | null
  legalMoves: Move[]
  lastMove: LastMoveState | null
  inCheck: string | null
  premoves: PremoveState[]
  draggingFrom: string | null
  onSquareMouseDown: (e: React.MouseEvent<HTMLDivElement>, square: string) => void
  onSquareClick: (square: string) => void
}

function getSquareBgClass(
  col: number,
  row: number,
  square: string,
  selectedSquare: string | null,
  lastMove: LastMoveState | null,
  inCheck: string | null,
) {
  const isSelected = selectedSquare === square
  const isLastMoveFrom = lastMove?.from === square
  const isLastMoveTo = lastMove?.to === square
  const isLight = getSquareColor(col, row) === 'light'

  if (inCheck === square) return ''
  if (isSelected) return 'bg-yellow-300/50'
  if (isLastMoveFrom || isLastMoveTo) {
    return isLight ? 'bg-[rgba(205,210,106,0.7)]' : 'bg-[rgba(170,162,58,0.7)]'
  }
  return isLight ? 'bg-[#f0d9b5]' : 'bg-[#b58863]'
}

export const BoardGrid: React.FC<BoardGridProps> = ({
  pieces,
  squareSize,
  isFlipped,
  selectedSquare,
  legalMoves,
  lastMove,
  inCheck,
  premoves,
  draggingFrom,
  onSquareMouseDown,
  onSquareClick,
}) => {
  const squares: React.ReactNode[] = []

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = getSquareName(col, row, isFlipped)
      const color = getSquareColor(col, row)
      const piece = pieces[square]
      const isLegalTarget = legalMoves.some(move => move.to === square)
      const isCapture = isLegalTarget && pieces[square]
      const isInCheckSquare = inCheck === square
      const isDragSource = draggingFrom === square
      const isPremoveSquare = premoves.some(premove => premove.from === square || premove.to === square)
      const bgClass = getSquareBgClass(col, row, square, selectedSquare, lastMove, inCheck)
      const coordColor = color === 'light' ? 'text-[#b58863]' : 'text-[#f0d9b5]'

      squares.push(
        <div
          key={square}
          className={`relative flex items-center justify-center cursor-pointer select-none ${bgClass}`}
          style={{
            width: squareSize,
            height: squareSize,
            ...(isInCheckSquare
              ? {
                background:
                  'radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,0,0,0.5) 25%, rgba(169,0,0,0.25) 50%, rgba(0,0,0,0) 75%)',
              }
              : {}),
          }}
          onMouseDown={(e) => onSquareMouseDown(e, square)}
          onClick={() => onSquareClick(square)}
          data-square={square}
        >
          {isPremoveSquare && <PremoveOverlay />}

          {col === 0 && (
            <span className={`absolute top-0.5 left-1 text-[11px] font-bold pointer-events-none z-[2] ${coordColor}`}>
              {isFlipped ? row + 1 : 8 - row}
            </span>
          )}
          {row === 7 && (
            <span className={`absolute bottom-0.5 right-1 text-[11px] font-bold pointer-events-none z-[2] ${coordColor}`}>
              {isFlipped ? String.fromCharCode(104 - col) : String.fromCharCode(97 + col)}
            </span>
          )}

          {isLegalTarget && !isCapture && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28%] h-[28%] rounded-full bg-black/[0.18] pointer-events-none z-[3]" />
          )}

          {isCapture && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] rounded-full border-[5px] border-black/[0.18] pointer-events-none z-[3] box-border" />
          )}

          {piece && !isDragSource && (
            <div className="flex items-center justify-center w-full h-full z-[4] cursor-grab active:cursor-grabbing">
              {React.createElement(PieceComponents[piece] || (() => null), {
                size: squareSize - 8,
              })}
            </div>
          )}
        </div>,
      )
    }
  }

  return <>{squares}</>
}
