import React from 'react'
import { PieceComponents } from '../ChessPieces'
import { getSquareCoords } from '../../utils/chessUtils'
import type { PromotionPendingState } from './types'

interface PromotionDialogProps {
  pending: PromotionPendingState | null
  turn: 'w' | 'b'
  squareSize: number
  boardSize: number
  isFlipped: boolean
  onSelect: (piece: string) => void
}

export const PromotionDialog: React.FC<PromotionDialogProps> = ({
  pending,
  turn,
  squareSize,
  boardSize,
  isFlipped,
  onSelect,
}) => {
  if (!pending) return null

  const toCoords = getSquareCoords(pending.to, isFlipped)
  const isTop = toCoords.row === 0
  const promotionPieces = ['Q', 'R', 'B', 'N']

  return (
    <div className="absolute inset-0 z-[100] bg-black/30">
      <div
        className="absolute flex flex-col bg-white rounded shadow-2xl overflow-hidden z-[101]"
        style={{
          left: toCoords.col * squareSize,
          top: isTop ? 0 : (boardSize - squareSize * 4),
        }}
      >
        {promotionPieces.map((piece) => {
          const key = `${turn}${piece}`
          const PieceComp = PieceComponents[key]
          return (
            <div
              key={piece}
              className="flex items-center justify-center cursor-pointer bg-white hover:bg-indigo-100 transition-colors"
              style={{ width: squareSize, height: squareSize }}
              onClick={() => onSelect(piece.toLowerCase())}
            >
              {PieceComp && <PieceComp size={squareSize - 12} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
