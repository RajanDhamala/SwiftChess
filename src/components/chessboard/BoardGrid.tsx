import React, { useCallback, useEffect, useMemo, useRef } from 'react'
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
  onSquarePointerDown: (e: React.PointerEvent<HTMLDivElement>, square: string) => void
  onSquareClick: (square: string) => void
}

interface SquareCellProps {
  square: string
  col: number
  row: number
  piece?: string
  squareSize: number
  isFlipped: boolean
  isSelected: boolean
  isLegalTarget: boolean
  isCapture: boolean
  isDragSource: boolean
  isLastMoveFrom: boolean
  isLastMoveDestination: boolean
  isPremoveSquare: boolean
  isInCheck: boolean
  boardTheme: BoardThemeColors
  lastMoveBadge?: MoveBadge | null
  onSquarePointerDown: (e: React.PointerEvent<HTMLDivElement>, square: string) => void
  onSquareClick: (square: string) => void
}

const CHECK_BG =
  'radial-gradient(ellipse at center, rgba(255,0,0,0.8) 0%, rgba(231,0,0,0.5) 25%, rgba(169,0,0,0.25) 50%, rgba(0,0,0,0) 75%)'

function getSquareStyle(
  col: number,
  row: number,
  isSelected: boolean,
  isLastMoveFrom: boolean,
  isLastMoveTo: boolean,
  isInCheck: boolean,
  boardTheme: BoardThemeColors,
): React.CSSProperties {
  const isLight = getSquareColor(col, row) === 'light'
  const baseColor = isLight ? boardTheme.light : boardTheme.dark

  if (isInCheck) return { background: `${CHECK_BG}, ${baseColor}` }
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

const PieceView = React.memo(({ piece, size }: { piece: string; size: number }) => {
  const PieceComp = PieceComponents[piece]
  if (!PieceComp) return null
  return <PieceComp size={size} />
})

PieceView.displayName = 'PieceView'

const SquareCell = React.memo(({
  square,
  col,
  row,
  piece,
  squareSize,
  isFlipped,
  isSelected,
  isLegalTarget,
  isCapture,
  isDragSource,
  isLastMoveFrom,
  isLastMoveDestination,
  isPremoveSquare,
  isInCheck,
  boardTheme,
  lastMoveBadge,
  onSquarePointerDown,
  onSquareClick,
}: SquareCellProps) => {
  const color = getSquareColor(col, row)
  const squareStyle = getSquareStyle(
    col,
    row,
    isSelected,
    isLastMoveFrom,
    isLastMoveDestination,
    isInCheck,
    boardTheme,
  )
  const coordColor = color === 'light' ? boardTheme.dark : boardTheme.light
  const badgeSize = Math.max(22, Math.min(36, squareSize * 0.44))

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    onSquarePointerDown(e, square)
  }, [onSquarePointerDown, square])

  const handleClick = useCallback(() => {
    onSquareClick(square)
  }, [onSquareClick, square])

  return (
    <div
      className="sw:relative sw:flex sw:items-center sw:justify-center sw:cursor-pointer sw:select-none"
      style={{
        width: squareSize,
        height: squareSize,
        ...squareStyle,
      }}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
      data-square={square}
    >
      {isPremoveSquare && <PremoveOverlay />}
      {isLastMoveDestination && lastMoveBadge && (
        <div className="sw:absolute sw:top-0.5 sw:right-0.5 sw:pointer-events-none sw:z-[6]">
          <MoveBadgeIcon badge={lastMoveBadge} size={badgeSize} />
        </div>
      )}

      {col === 0 && (
        <span
          className="sw:absolute sw:top-0.5 sw:left-1 sw:text-[11px] sw:font-bold sw:pointer-events-none sw:z-[2]"
          style={{ color: coordColor }}
        >
          {isFlipped ? row + 1 : 8 - row}
        </span>
      )}
      {row === 7 && (
        <span
          className="sw:absolute sw:bottom-0.5 sw:right-1 sw:text-[11px] sw:font-bold sw:pointer-events-none sw:z-[2]"
          style={{ color: coordColor }}
        >
          {isFlipped ? String.fromCharCode(104 - col) : String.fromCharCode(97 + col)}
        </span>
      )}

      {isLegalTarget && !isCapture && (
        <div className="sw:absolute sw:top-1/2 sw:left-1/2 sw:-translate-x-1/2 sw:-translate-y-1/2 sw:w-[28%] sw:h-[28%] sw:rounded-full sw:bg-black/[0.18] sw:pointer-events-none sw:z-[3]" />
      )}

      {isCapture && (
        <div className="sw:absolute sw:top-1/2 sw:left-1/2 sw:-translate-x-1/2 sw:-translate-y-1/2 sw:w-[90%] sw:h-[90%] sw:rounded-full sw:border-[5px] sw:border-black/[0.18] sw:pointer-events-none sw:z-[3] sw:box-border" />
      )}

      {piece && !isDragSource && (
        <div className="sw:flex sw:items-center sw:justify-center sw:w-full sw:h-full sw:z-[4] sw:cursor-grab sw:active:cursor-grabbing">
          <PieceView piece={piece} size={squareSize - 8} />
        </div>
      )}
    </div>
  )
})

SquareCell.displayName = 'SquareCell'

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
  onSquarePointerDown,
  onSquareClick,
}) => {
  const pointerDownRef = useRef(onSquarePointerDown)
  const clickRef = useRef(onSquareClick)

  useEffect(() => {
    pointerDownRef.current = onSquarePointerDown
  }, [onSquarePointerDown])

  useEffect(() => {
    clickRef.current = onSquareClick
  }, [onSquareClick])

  const handleSquarePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, square: string) => {
    pointerDownRef.current(e, square)
  }, [])

  const handleSquareClick = useCallback((square: string) => {
    clickRef.current(square)
  }, [])

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
      const piece = pieces[square]
      const isLegalTarget = legalMoveSet.has(square)
      const isCapture = isLegalTarget && Boolean(pieces[square])
      const isDragSource = draggingFrom === square
      const isLastMoveDestination = lastMove?.to === square
      const isLastMoveFrom = lastMove?.from === square
      const isPremoveSquare = premoveSquareSet.has(square)

      squares.push(
        <SquareCell
          key={square}
          square={square}
          col={col}
          row={row}
          piece={piece}
          squareSize={squareSize}
          isFlipped={isFlipped}
          isSelected={selectedSquare === square}
          isLegalTarget={isLegalTarget}
          isCapture={isCapture}
          isDragSource={isDragSource}
          isLastMoveFrom={isLastMoveFrom}
          isLastMoveDestination={isLastMoveDestination}
          isPremoveSquare={isPremoveSquare}
          isInCheck={inCheck === square}
          boardTheme={boardTheme}
          lastMoveBadge={isLastMoveDestination ? lastMoveBadge : null}
          onSquarePointerDown={handleSquarePointerDown}
          onSquareClick={handleSquareClick}
        />,
      )
    }
  }

  return <>{squares}</>
})

BoardGrid.displayName = 'BoardGrid'
