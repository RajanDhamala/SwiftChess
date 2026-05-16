import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import {
  ChessBoard,
  type BoardThemePreset,
  type ChessBoardHandle,
  type ChessBoardMode,
  type MoveBadge,
} from '../lib'

const BOARD_THEME_OPTIONS: Array<{ value: BoardThemePreset; label: string }> = [
  { value: 'chessComClassic', label: 'Chess.com Classic' },
  { value: 'brownBoard', label: 'Your Brown Board' },
  { value: 'iceBlue', label: 'Ice Blue' },
  { value: 'custom', label: 'Custom (#E8E8E8 / #5EA01C)' },
]

const MOCK_BADGES: MoveBadge[] = [
  { kind: 'blunder' },
  { kind: 'mistake' },
  { kind: 'inaccuracy' },
  { kind: 'miss' },
  { kind: 'book' },
  { kind: 'onlyMove' },
  { kind: 'brilliant' },
  { kind: 'good' },
  { kind: 'excellent' },
  { kind: 'best' },
]

function pickRandomBadge() {
  return MOCK_BADGES[Math.floor(Math.random() * MOCK_BADGES.length)]
}

function DemoApp() {
  const [chess] = useState(() => new Chess())
  const [position, setPosition] = useState(chess.fen())
  const [boardMode, setBoardMode] = useState<ChessBoardMode>('play')
  const [boardSoundEnabled, setBoardSoundEnabled] = useState(true)
  const [boardThemePreset, setBoardThemePreset] = useState<BoardThemePreset>('brownBoard')
  const [boardSize, setBoardSize] = useState(560)
  const [boardResizable, setBoardResizable] = useState(false)
  const [fillContainer, setFillContainer] = useState(false)
  const [showLegalMoves, setShowLegalMoves] = useState(true)
  const [mockBadge, setMockBadge] = useState<MoveBadge | null>(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const blackReplyTimerRef = useRef<number | null>(null)
  const boardRef = useRef<ChessBoardHandle>(null)

  const syncTimelineButtons = useCallback(() => {
    setCanPrev(Boolean(boardRef.current?.canGoToPreviousMove()))
    setCanNext(Boolean(boardRef.current?.canGoToNextMove()))
  }, [])

  const queueRandomBlackMove = useCallback(() => {
    if (blackReplyTimerRef.current !== null) {
      window.clearTimeout(blackReplyTimerRef.current)
    }

    blackReplyTimerRef.current = window.setTimeout(() => {
      if (chess.turn() !== 'b') return
      const legalMoves = chess.moves({ verbose: true })
      if (legalMoves.length === 0) return
      const randomMove = legalMoves[Math.floor(Math.random() * legalMoves.length)]
      chess.move({
        from: randomMove.from,
        to: randomMove.to,
        promotion: randomMove.promotion,
      })
      setPosition(chess.fen())
    }, 1000)
  }, [chess])

  const handleMove = useCallback((move: Move) => {
    if (boardMode === 'analysis') {
      setMockBadge(pickRandomBadge())
    }
    if (move.color === 'w') {
      queueRandomBlackMove()
    }
  }, [boardMode, queueRandomBlackMove])

  const switchMode = useCallback((nextMode: ChessBoardMode) => {
    setBoardMode(nextMode)
    if (nextMode === 'analysis') {
      setMockBadge(pickRandomBadge())
      return
    }
    setMockBadge(null)
  }, [])

  useEffect(() => {
    syncTimelineButtons()
  }, [position, syncTimelineButtons])

  useEffect(() => {
    return () => {
      if (blackReplyTimerRef.current !== null) {
        window.clearTimeout(blackReplyTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="w-full max-w-[880px] mx-auto px-4 py-4">
      <div className="flex items-center justify-center gap-3 pb-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-1">
          <button
            onClick={() => switchMode('play')}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${boardMode === 'play' ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'}`}
          >
            Play
          </button>
          <button
            onClick={() => switchMode('analysis')}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${boardMode === 'analysis' ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'}`}
          >
            Analysis
          </button>
        </div>
        <label className="text-xs text-gray-300 font-semibold">
          Theme
          <select
            className="ml-2 px-2 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-colors"
            value={boardThemePreset}
            onChange={(e) => setBoardThemePreset(e.target.value as BoardThemePreset)}
          >
            {BOARD_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          onClick={() => setBoardSoundEnabled((prev) => !prev)}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-colors"
        >
          {boardSoundEnabled ? 'Sound: ON' : 'Sound: OFF'}
        </button>
        <span className="px-2.5 py-1.5 rounded bg-zinc-900 text-zinc-300 text-xs font-semibold">
          Board: {boardSize}px
        </span>
      </div>

      <div className="flex items-center justify-center gap-2 pb-4 flex-wrap">
        <button
          onClick={() => setBoardResizable((prev) => !prev)}
          className={`px-3 py-1.5 rounded text-white text-xs font-semibold transition-colors ${boardResizable ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
        >
          Resize Handle: {boardResizable ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setFillContainer((prev) => !prev)}
          className={`px-3 py-1.5 rounded text-white text-xs font-semibold transition-colors ${fillContainer ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
        >
          Fill Container: {fillContainer ? 'ON' : 'OFF'}
        </button>
        <button
          onClick={() => setShowLegalMoves((prev) => !prev)}
          className={`px-3 py-1.5 rounded text-white text-xs font-semibold transition-colors ${showLegalMoves ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-zinc-700 hover:bg-zinc-600'}`}
        >
          Legal Moves: {showLegalMoves ? 'ON' : 'OFF'}
        </button>
      </div>

      <div className="flex items-center justify-center gap-2 pb-4 flex-wrap">
        <button
          onClick={() => {
            boardRef.current?.goToPreviousMove()
            syncTimelineButtons()
          }}
          disabled={!canPrev}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          Prev Move
        </button>
        <button
          onClick={() => {
            boardRef.current?.goToNextMove()
            syncTimelineButtons()
          }}
          disabled={!canNext}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold transition-colors"
        >
          Next Move
        </button>
        <button
          onClick={() => boardRef.current?.flipBoard()}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-colors"
        >
          Flip
        </button>
        <button
          onClick={() => {
            boardRef.current?.resetToInitialFen()
            syncTimelineButtons()
          }}
          className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-white text-xs font-semibold transition-colors"
        >
          Reset
        </button>
      </div>

      <ChessBoard
        ref={boardRef}
        chess={chess}
        position={position}
        mode={boardMode}
        lastMoveBadge={boardMode === 'analysis' ? mockBadge : null}
        playerColor="w"
        onPositionChange={(fen) => setPosition(fen)}
        onMove={handleMove}
        enableSounds={boardSoundEnabled}
        successSoundSrc="/success.mp3"
        boardThemePreset={boardThemePreset}
        boardSize={fillContainer ? undefined : boardSize}
        onBoardSizeChange={(nextSize) => setBoardSize(nextSize)}
        resizable={boardResizable}
        fillContainer={fillContainer}
        showLegalMoves={showLegalMoves}
        minSize={36}
        maxSize={96}
        showStatusBar
        className="w-full flex justify-center"
        arrowStyle={{
          color: '#15781B',
          opacity: 0.6,
          liveColor: '#15781B',
          liveOpacity: 0.6,
        }}
      />
    </div>
  )
}

export default DemoApp
