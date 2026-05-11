import React, { useMemo } from 'react'
import { PieceComponents } from '../ChessPieces'
import { getSquareColor, getSquareName } from '../../utils/chessUtils'
import { PremoveOverlay } from './PremoveOverlay'
import { MoveBadgeIcon } from './MoveBadge'
import type { BoardThemeColors, LastMoveState, PremoveState } from './types'
import type { MoveBadge } from '../ChessBoard'

interface BoardGridProps {
  pieces: Record<string, string>
  squareSize: number
  isFlipped: boolean
  selectedSquare: string | null
  legalMoves: string[]
  lastMove: LastMoveState | null
  lastMoveBadge?: MoveBadge | null
  inCheck: string | null
  premoves: PremoveState[]
  boardTheme: BoardThemeColors
  draggingFrom: string | null
  onSquareMouseDown: (e: React.MouseEvent<HTMLDivElement>, square: string) => void
  onSquareClick: (square: string) => void
}

const CHECK_BG =
  'radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,0,0,0.5) 25%, rgba(169,0,0,0.25) 50%, rgba(0,0,0,0) 75%)'

function getSquareStyle(
  col: number,
  row: number,
  square: string,
  selectedSquare: string | null,
  lastMove: LastMoveState | null,
  inCheck: string | null,
  boardTheme: BoardThemeColors,
): React.CSSProperties {
  const isSelected = selectedSquare === square
  const isLastMoveFrom = lastMove?.from === square
  const isLastMoveTo = lastMove?.to === square
  const isLight = getSquareColor(col, row) === 'light'
  const baseColor = isLight ? boardTheme.light : boardTheme.dark

  if (inCheck === square) return { background: CHECK_BG }
  if (isSelected) {
    return {
      background: `linear-gradient(rgba(255, 255, 100, 0.5), rgba(255, 255, 100, 0.5)), ${baseColor}`,
    }
  }
  if (isLastMoveFrom || isLastMoveTo) {
    return {
      background: `linear-gradient(rgba(255, 235, 59, 0.35), rgba(255, 235, 59, 0.35)), ${baseColor}`,
    }
  }
  return { backgroundColor: baseColor }
}

export const BoardGrid: React.FC<BoardGridProps> = React.memo(({
  pieces,
  squareSize,
  isFlipped,
  selectedSquare,
  legalMoves,
  lastMove,
  lastMoveBadge,
  inCheck,
  premoves,
  boardTheme,
  draggingFrom,
  onSquareMouseDown,
  onSquareClick,
}) => {
  const legalMoveSet = useMemo(() => new Set(legalMoves), [legalMoves])
  const premoveSquareSet = useMemo(() => {
    const squares = new Set<string>()
    for (const premove of premoves) {
      squares.add(premove.from)
      squares.add(premove.to)
    }
    return squares
  }, [premoves])
  const squares: React.ReactNode[] = []

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const square = getSquareName(col, row, isFlipped)
      const color = getSquareColor(col, row)
      const piece = pieces[square]
      const isLegalTarget = legalMoveSet.has(square)
      const isCapture = isLegalTarget && Boolean(pieces[square])
      const isDragSource = draggingFrom === square
      const isLastMoveDestination = lastMove?.to === square
      const isPremoveSquare = premoveSquareSet.has(square)
      const squareStyle = getSquareStyle(col, row, square, selectedSquare, lastMove, inCheck, boardTheme)
      const coordColor = color === 'light' ? boardTheme.dark : boardTheme.light
      const badgeSize = Math.max(22, Math.min(36, squareSize * 0.44))

      squares.push(
        <div
          key={square}
          className="relative flex items-center justify-center cursor-pointer select-none"
          style={{
            width: squareSize,
            height: squareSize,
            ...squareStyle,
          }}
          onMouseDown={(e) => onSquareMouseDown(e, square)}
          onClick={() => onSquareClick(square)}
          data-square={square}
        >
          {isPremoveSquare && <PremoveOverlay />}
          {isLastMoveDestination && lastMoveBadge && (
            <div className="absolute top-0.5 right-0.5 pointer-events-none z-[6]">
              <MoveBadgeIcon badge={lastMoveBadge} size={badgeSize} />
            </div>
          )}

          {col === 0 && (
            <span
              className="absolute top-0.5 left-1 text-[11px] font-bold pointer-events-none z-[2]"
              style={{ color: coordColor }}
            >
              {isFlipped ? row + 1 : 8 - row}
            </span>
          )}
          {row === 7 && (
            <span
              className="absolute bottom-0.5 right-1 text-[11px] font-bold pointer-events-none z-[2]"
              style={{ color: coordColor }}
            >
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
})

BoardGrid.displayName = 'BoardGrid'
