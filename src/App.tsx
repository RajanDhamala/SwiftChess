import { useCallback, useEffect, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Move } from 'chess.js'
import ChessBoard, { type BoardThemePreset, type ChessBoardMode, type MoveBadge } from './components/ChessBoard'

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

function App() {
  const [chess] = useState(() => new Chess())
  const [position, setPosition] = useState(chess.fen())
  const [boardMode, setBoardMode] = useState<ChessBoardMode>('play')
  const [boardSoundEnabled, setBoardSoundEnabled] = useState(true)
  const [boardThemePreset, setBoardThemePreset] = useState<BoardThemePreset>('brownBoard')
  const [mockBadge, setMockBadge] = useState<MoveBadge | null>(null)
  const blackReplyTimerRef = useRef<number | null>(null)

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
    }, 500)
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
    return () => {
      if (blackReplyTimerRef.current !== null) {
        window.clearTimeout(blackReplyTimerRef.current)
      }
    }
  }, [])

  return (
    <div>
      <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-800 p-1">
          <button
            onClick={() => switchMode('play')}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
              boardMode === 'play' ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            Play
          </button>
          <button
            onClick={() => switchMode('analysis')}
            className={`px-2.5 py-1.5 rounded text-xs font-semibold transition-colors ${
              boardMode === 'analysis' ? 'bg-zinc-600 text-white' : 'text-zinc-300 hover:bg-zinc-700'
            }`}
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
      </div>
      <ChessBoard
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
        arrowStyle={{
          color: 'rgb(16, 185, 129)',
          opacity: 0.85,
          liveColor: 'rgb(59, 130, 246)',
          liveOpacity: 0.7,
        }}
      />
    </div>
  )
}

export default App
