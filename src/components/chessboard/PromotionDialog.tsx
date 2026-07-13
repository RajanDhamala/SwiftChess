import React from 'react'
import { PieceComponents } from '../ChessPieces'
import { getSquareCoords } from '../../utils/chessUtils'
import type { PromotionPendingState } from './types'

interface PromotionDialogProps {
  pending: PromotionPendingState | null
  playerColor: 'w' | 'b'
  squareSize: number
  boardSize: number
  isFlipped: boolean
  onSelect: (piece: string) => void
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  pending,
  playerColor,
  squareSize,
  boardSize,
  isFlipped,
  onSelect,
}) => {
  if (!pending) return null

  const toCoords = getSquareCoords(pending.to, isFlipped)
  const isTop = toCoords.row === 0
  // Keep the queen (the primary choice) anchored to the destination square
  // regardless of which edge the pawn reached.
  const promotionPieces = isTop ? ['Q', 'R', 'B', 'N'] : ['N', 'B', 'R', 'Q']

  return (
    <div className="sw:absolute sw:inset-0 sw:z-[100] sw:bg-black/30">
      <div
        className="sw:absolute sw:flex sw:flex-col sw:bg-white sw:rounded sw:shadow-2xl sw:overflow-hidden sw:z-[101]"
        style={{
          left: toCoords.col * squareSize,
          top: isTop ? 0 : (boardSize - squareSize * 4),
        }}
      >
        {promotionPieces.map((piece) => {
          const key = `${playerColor}${piece}`
          const PieceComp = PieceComponents[key]
          return (
            <button
              type="button"
              key={piece}
              className="sw:flex sw:items-center sw:justify-center sw:cursor-pointer sw:bg-white sw:hover:bg-indigo-100 sw:transition-colors"
              style={{ width: squareSize, height: squareSize }}
              onClick={() => onSelect(piece.toLowerCase())}
              aria-label={`Promote to ${piece}`}
            >
              {PieceComp && <PieceComp size={squareSize - 12} />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
