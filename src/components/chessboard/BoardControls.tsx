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
  <div className="sw:flex sw:flex-col sw:gap-3 sw:w-full sw:max-w-[576px]">
    <div className="sw:flex sw:gap-2 sw:max-sm:flex-col">
      <button
        onClick={onReset}
        className="sw:px-4 sw:py-2.5 sw:rounded-lg sw:font-semibold sw:text-sm sw:text-white sw:bg-emerald-500 sw:hover:bg-emerald-600 sw:hover:-translate-y-px sw:transition-all sw:max-sm:w-full"
      >
        ↻ New Game
      </button>
      <button
        onClick={onUndo}
        className="sw:px-4 sw:py-2.5 sw:rounded-lg sw:font-semibold sw:text-sm sw:text-white sw:bg-orange-500 sw:hover:bg-orange-600 sw:hover:-translate-y-px sw:transition-all sw:max-sm:w-full"
      >
        ← Undo
      </button>
      <button
        onClick={onFlip}
        className="sw:px-4 sw:py-2.5 sw:rounded-lg sw:font-semibold sw:text-sm sw:text-white sw:bg-blue-500 sw:hover:bg-blue-600 sw:hover:-translate-y-px sw:transition-all sw:max-sm:w-full"
      >
        ⇅ Flip Board
      </button>
    </div>

    <div className="sw:flex sw:items-center sw:justify-center sw:gap-3">
      <button
        onClick={onResizeDown}
        disabled={squareSize <= minSize}
        className="sw:w-8 sw:h-8 sw:rounded-full sw:bg-gray-700 sw:hover:bg-gray-600 sw:disabled:opacity-30 sw:disabled:cursor-not-allowed sw:text-white sw:font-bold sw:text-lg sw:flex sw:items-center sw:justify-center sw:transition-colors"
      >
        −
      </button>
      <span className="sw:text-xs sw:text-gray-400 sw:w-24 sw:text-center">
        Board: {boardSize}×{boardSize}px
      </span>
      <button
        onClick={onResizeUp}
        disabled={squareSize >= maxSize}
        className="sw:w-8 sw:h-8 sw:rounded-full sw:bg-gray-700 sw:hover:bg-gray-600 sw:disabled:opacity-30 sw:disabled:cursor-not-allowed sw:text-white sw:font-bold sw:text-lg sw:flex sw:items-center sw:justify-center sw:transition-colors"
      >
        +
      </button>
    </div>
  </div>
)
