import React from 'react'

interface BoardControlsProps {
  boardSize: number
  squareSize: number
  minSize: number
  maxSize: number
  onReset: () => void
  onUndo: () => void
  onFlip: () => void
  onResizeDown: () => void
  onResizeUp: () => void
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  boardSize,
  squareSize,
  minSize,
  maxSize,
  onReset,
  onUndo,
  onFlip,
  onResizeDown,
  onResizeUp,
}) => (
  <div className="flex flex-col gap-3 w-full max-w-[576px]">
    <div className="flex gap-2 max-sm:flex-col">
      <button
        onClick={onReset}
        className="px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-emerald-500 hover:bg-emerald-600 hover:-translate-y-px transition-all max-sm:w-full"
      >
        ↻ New Game
      </button>
      <button
        onClick={onUndo}
        className="px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-orange-500 hover:bg-orange-600 hover:-translate-y-px transition-all max-sm:w-full"
      >
        ← Undo
      </button>
      <button
        onClick={onFlip}
        className="px-4 py-2.5 rounded-lg font-semibold text-sm text-white bg-blue-500 hover:bg-blue-600 hover:-translate-y-px transition-all max-sm:w-full"
      >
        ⇅ Flip Board
      </button>
    </div>

    <div className="flex items-center justify-center gap-3">
      <button
        onClick={onResizeDown}
        disabled={squareSize <= minSize}
        className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center transition-colors"
      >
        −
      </button>
      <span className="text-xs text-gray-400 w-24 text-center">
        Board: {boardSize}×{boardSize}px
      </span>
      <button
        onClick={onResizeUp}
        disabled={squareSize >= maxSize}
        className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 disabled:opacity-30 disabled:cursor-not-allowed text-white font-bold text-lg flex items-center justify-center transition-colors"
      >
        +
      </button>
    </div>
  </div>
)
