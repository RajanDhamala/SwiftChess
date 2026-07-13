import React from 'react'
import { PieceComponents } from '../ChessPieces'

interface CapturedPiecesRowProps {
  capturedPieces: string[]
  label: string
}

export const CapturedPiecesRow: React.FC<CapturedPiecesRowProps> = React.memo(({
  capturedPieces,
  label,
}) => (
  <div className="sw:flex sw:items-center sw:gap-1 sw:min-h-[32px] sw:px-2 sw:py-1">
    <span className="sw:text-xs sw:text-gray-500 sw:whitespace-nowrap">{label}</span>
    <div className="sw:flex sw:flex-wrap sw:gap-px">
      {capturedPieces.map((piece, index) => {
        const PieceComp = PieceComponents[piece]
        return PieceComp ? (
          <div key={`${piece}-${index}`} className="sw:flex sw:items-center sw:justify-center sw:opacity-85">
            <PieceComp size={24} />
          </div>
        ) : null
      })}
    </div>
  </div>
))

CapturedPiecesRow.displayName = 'CapturedPiecesRow'
