import React from 'react'
import { PieceComponents } from '../ChessPieces'

interface CapturedPiecesRowProps {
  capturedPieces: string[]
  label: string
}

export const CapturedPiecesRow: React.FC<CapturedPiecesRowProps> = ({
  capturedPieces,
  label,
}) => (
  <div className="flex items-center gap-1 min-h-[32px] px-2 py-1">
    <span className="text-xs text-gray-500 whitespace-nowrap">{label}</span>
    <div className="flex flex-wrap gap-px">
      {capturedPieces.map((piece, index) => {
        const PieceComp = PieceComponents[piece]
        return PieceComp ? (
          <div key={`${piece}-${index}`} className="flex items-center justify-center opacity-85">
            <PieceComp size={24} />
          </div>
        ) : null
      })}
    </div>
  </div>
)
