import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Color, Move } from 'chess.js'
import {
  Check,
  CircleDot,
  Code2,
  Copy,
  FlipVertical2,
  Maximize2,
  RotateCcw,
  Search,
  StepBack,
  StepForward,
  Swords,
  Volume2,
  VolumeX,
} from 'lucide-react'
import {
  ChessBoard,
  type BoardThemePreset,
  type ChessBoardHandle,
  type ChessBoardMode,
  type MoveBadge,
} from '../lib'

const THEMES: Array<{ value: BoardThemePreset; label: string; colors: [string, string] }> = [
  { value: 'brownBoard', label: 'Brown', colors: ['#f0d9b5', '#b58863'] },
  { value: 'chessComClassic', label: 'Classic', colors: ['#eeeed2', '#769656'] },
  { value: 'iceBlue', label: 'Ice', colors: ['#dee3e6', '#8ca2ad'] },
  { value: 'custom', label: 'Green', colors: ['#e8e8e8', '#5ea01c'] },
]

const BADGES: MoveBadge[] = [
  { kind: 'book' },
  { kind: 'good' },
  { kind: 'excellent' },
  { kind: 'best' },
  { kind: 'brilliant' },
  { kind: 'inaccuracy' },
]

const CODE_EXAMPLES = {
  install: `npm install swiftchess chess.js`,
  basic: `import { useState } from 'react'
import { Chess } from 'chess.js'
import { ChessBoard } from 'swiftchess'
import 'swiftchess/style.css'

export function Game() {
  const [chess] = useState(() => new Chess())
  const [position, setPosition] = useState(chess.fen())

  return (
    <ChessBoard
      chess={chess}
      position={position}
      onPositionChange={setPosition}
      playerColor="w"
      showLegalMoves
      enableSounds
    />
  )
}`,
  premove: `<ChessBoard
  chess={chess}
  position={position}
  playerColor="w"
  relaxedPremoveMode
  onPremoveAdd={(move) => console.log('Queued', move)}
  onPremoveExecute={(move) => console.log('Played', move)}
/>`,
}

type CodeTab = keyof typeof CODE_EXAMPLES

function getStatus(game: Chess, thinking: boolean, playerColor: Color) {
  if (game.isCheckmate()) return `Checkmate - ${game.turn() === 'w' ? 'Black' : 'White'} wins`
  if (game.isDraw()) return 'Game drawn'
  if (thinking) return 'Opponent is thinking'
  if (game.turn() === playerColor) return 'Your move'
  return 'Opponent to move'
}

function getInitialViewportWidth() {
  return typeof window !== 'undefined' ? window.innerWidth : 1200
}

function LandingPage() {
  const [chess] = useState(() => new Chess())
  const [position, setPosition] = useState(chess.fen())
  const [mode, setMode] = useState<ChessBoardMode>('play')
  const [playerColor, setPlayerColor] = useState<Color>('w')
  const [flipped, setFlipped] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showLegalMoves, setShowLegalMoves] = useState(true)
  const [resizable, setResizable] = useState(false)
  const [theme, setTheme] = useState<BoardThemePreset>('brownBoard')
  const [requestedBoardSize, setRequestedBoardSize] = useState(600)
  const [viewportWidth, setViewportWidth] = useState(() => getInitialViewportWidth())
  const [thinking, setThinking] = useState(false)
  const [badge, setBadge] = useState<MoveBadge | null>(null)
  const [canPrevious, setCanPrevious] = useState(false)
  const [canNext, setCanNext] = useState(false)
  const [showCode, setShowCode] = useState(false)
  const [codeTab, setCodeTab] = useState<CodeTab>('basic')
  const [copied, setCopied] = useState(false)
  const boardRef = useRef<ChessBoardHandle>(null)
  const opponentTimerRef = useRef<number | null>(null)

  const maxBoardSize = Math.max(240, Math.min(600, viewportWidth - (viewportWidth < 640 ? 28 : 80)))
  const boardSize = Math.max(240, Math.min(requestedBoardSize, maxBoardSize))
  const gameView = useMemo(() => new Chess(position), [position])
  const moveHistory = useMemo(() => chess.history(), [chess, position])
  const status = getStatus(gameView, thinking, playerColor)

  const clearOpponentTimer = useCallback(() => {
    if (opponentTimerRef.current !== null) {
      window.clearTimeout(opponentTimerRef.current)
      opponentTimerRef.current = null
    }
    setThinking(false)
  }, [])

  const syncTimeline = useCallback(() => {
    setCanPrevious(Boolean(boardRef.current?.canGoToPreviousMove()))
    setCanNext(Boolean(boardRef.current?.canGoToNextMove()))
  }, [])

  const queueOpponentMove = useCallback((activePlayer: Color, delay = 850) => {
    if (opponentTimerRef.current !== null) {
      window.clearTimeout(opponentTimerRef.current)
    }

    setThinking(true)
    opponentTimerRef.current = window.setTimeout(() => {
      opponentTimerRef.current = null
      if (chess.turn() === activePlayer || chess.isGameOver()) {
        setThinking(false)
        return
      }

      const moves = chess.moves({ verbose: true })
      const nextMove = moves[Math.floor(Math.random() * moves.length)]
      if (nextMove) {
        chess.move({
          from: nextMove.from,
          to: nextMove.to,
          promotion: nextMove.promotion,
        })
        setPosition(chess.fen())
      }
      setThinking(false)
    }, delay)
  }, [chess])

  const resetGame = useCallback((activePlayer = playerColor) => {
    clearOpponentTimer()
    setBadge(null)
    const reset = boardRef.current?.resetToInitialFen()
    if (!reset) {
      chess.reset()
      setPosition(chess.fen())
    }
    if (activePlayer === 'b') queueOpponentMove(activePlayer, 500)
  }, [chess, clearOpponentTimer, playerColor, queueOpponentMove])

  const handleMove = useCallback((move: Move) => {
    if (mode === 'analysis') {
      setBadge(BADGES[Math.floor(Math.random() * BADGES.length)])
    }
    if (move.color === playerColor) {
      queueOpponentMove(playerColor)
    }
  }, [mode, playerColor, queueOpponentMove])

  const changePlayerColor = useCallback((color: Color) => {
    if (color === playerColor) return
    clearOpponentTimer()
    setPlayerColor(color)
    setFlipped(color === 'b')
    resetGame(color)
  }, [clearOpponentTimer, playerColor, resetGame])

  const moveTimeline = useCallback((direction: 'previous' | 'next') => {
    clearOpponentTimer()
    const moved = direction === 'previous'
      ? boardRef.current?.goToPreviousMove()
      : boardRef.current?.goToNextMove()
    if (moved) window.requestAnimationFrame(syncTimeline)
  }, [clearOpponentTimer, syncTimeline])

  const copyCode = useCallback(async () => {
    await navigator.clipboard.writeText(CODE_EXAMPLES[codeTab])
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }, [codeTab])

  useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth)
    handleResize()
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  useEffect(() => {
    const frame = window.requestAnimationFrame(syncTimeline)
    return () => window.cancelAnimationFrame(frame)
  }, [position, syncTimeline])

  useEffect(() => () => {
    if (opponentTimerRef.current !== null) {
      window.clearTimeout(opponentTimerRef.current)
    }
  }, [])

  return (
    <div className="min-h-screen w-full bg-[#f7f8fa] text-[#202733]">
      <header className="sticky top-0 z-40 border-b border-[#dfe3e8] bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 lg:px-8">
          <a href="#" className="flex items-center gap-3 text-[#202733]">
            <img
              src="/swiftchess-logo.svg"
              alt=""
              aria-hidden="true"
              className="h-10 w-10 shrink-0 object-contain"
            />
            <span>
              <strong className="block text-[15px] leading-4">SwiftChess</strong>
              <span className="text-[11px] text-[#687386]">React chessboard</span>
            </span>
          </a>
          <nav className="flex items-center gap-1 text-sm font-medium text-[#586274]">
            <a href="#playground" className="hidden px-3 py-2 hover:text-[#202733] sm:block">Playground</a>
            <a href="#usage" className="hidden px-3 py-2 hover:text-[#202733] sm:block">Usage</a>
            <a
              href="https://www.npmjs.com/package/swiftchess"
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-[#cfd5dc] bg-white px-3 py-2 text-[#202733] hover:bg-[#f3f5f7]"
            >
              npm package
            </a>
          </nav>
        </div>
      </header>

      <main>
        <section id="playground" className="border-b border-[#dfe3e8] bg-white">
          <div className="mx-auto max-w-[1240px] px-3 py-8 sm:px-5 lg:px-8 lg:py-10">
            <div className="mb-7 max-w-3xl">
              <p className="mb-2 text-xs font-bold uppercase text-[#2e7d54]">Interactive example</p>
              <h1 className="text-3xl font-bold leading-tight text-[#1f2732] sm:text-4xl">
                A fast React chessboard built for real games.
              </h1>
              <p className="mt-3 max-w-2xl text-[15px] leading-7 text-[#5e6878]">
                Play against random legal moves, queue premoves while the opponent thinks, draw arrows with
                right-drag, and test the board API directly.
              </p>
            </div>

            <div className="grid items-start gap-7 xl:grid-cols-[minmax(0,1fr)_340px]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2.5 w-2.5 rounded-full ${thinking ? 'bg-amber-500' : 'bg-[#2e8b57]'}`} />
                    <span className="text-sm font-semibold text-[#313a47]">{status}</span>
                    <span className="text-xs text-[#7b8492]">
                      {playerColor === 'w' ? 'You play White' : 'You play Black'}
                    </span>
                  </div>
                  <span className="text-xs tabular-nums text-[#7b8492]">
                    {moveHistory.length} {moveHistory.length === 1 ? 'move' : 'moves'}
                  </span>
                </div>

                <div className="-mx-1 flex min-h-[300px] justify-center overflow-visible rounded-md border border-[#dfe3e8] bg-[#eef1f4] p-1.5 sm:mx-0 sm:p-4">
                  <ChessBoard
                    ref={boardRef}
                    chess={chess}
                    position={position}
                    onPositionChange={(fen) => setPosition(fen)}
                    onMove={handleMove}
                    mode={mode}
                    playerColor={playerColor}
                    flipped={flipped}
                    onFlippedChange={setFlipped}
                    boardSize={boardSize}
                    onBoardSizeChange={(size) => setRequestedBoardSize(size)}
                    resizable={resizable}
                    minSize={30}
                    maxSize={75}
                    boardThemePreset={theme}
                    enableSounds={soundEnabled}
                    showLegalMoves={showLegalMoves}
                    showCapturedPieces
                    lastMoveBadge={mode === 'analysis' ? badge : null}
                    arrowStyle={{
                      color: '#2f8a50',
                      opacity: 0.68,
                      liveColor: '#2f8a50',
                      liveOpacity: 0.5,
                    }}
                    className="flex w-full justify-center"
                  />
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#747e8c]">
                  <span>Drag or click to move. Right-drag to draw an arrow.</span>
                  <button
                    type="button"
                    onClick={() => setShowCode((current) => !current)}
                    className="inline-flex items-center gap-1.5 rounded border border-[#cfd5dc] bg-white px-3 py-1.5 font-semibold text-[#313a47] hover:bg-[#f3f5f7]"
                  >
                    <Code2 size={14} aria-hidden="true" />
                    {showCode ? 'Hide code' : 'Show code'}
                  </button>
                </div>

                {showCode && (
                  <div className="mt-4 overflow-hidden rounded-md border border-[#d8dde3] bg-[#151a21] text-[#d8dee9]">
                    <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
                      <div className="flex gap-1">
                        {(['install', 'basic', 'premove'] as CodeTab[]).map((tab) => (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => setCodeTab(tab)}
                            className={`rounded px-2.5 py-1.5 text-xs font-semibold capitalize ${codeTab === tab ? 'bg-white/12 text-white' : 'text-[#9ca7b5] hover:text-white'
                              }`}
                          >
                            {tab}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        title="Copy code"
                        aria-label="Copy code"
                        onClick={copyCode}
                        className="grid h-8 w-8 place-items-center rounded border border-white/15 text-[#c9d1db] hover:bg-white/10"
                      >
                        {copied ? <Check size={15} /> : <Copy size={15} />}
                      </button>
                    </div>
                    <pre className="overflow-x-auto p-4 text-[12px] leading-6 sm:p-5 sm:text-[13px]">
                      <code>{CODE_EXAMPLES[codeTab]}</code>
                    </pre>
                  </div>
                )}
              </div>

              <aside className="border border-[#dfe3e8] bg-[#fbfcfd]">
                <div className="border-b border-[#dfe3e8] p-4">
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-[#e9edf1] p-1">
                    {(['play', 'analysis'] as ChessBoardMode[]).map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setMode(item)
                          setBadge(item === 'analysis' ? BADGES[3] : null)
                        }}
                        className={`rounded px-3 py-2 text-sm font-semibold capitalize ${mode === item ? 'bg-white text-[#202733] shadow-sm' : 'text-[#687386] hover:text-[#202733]'
                          }`}
                      >
                        {item === 'play' ? (
                          <Swords className="mr-1.5 inline" size={15} aria-hidden="true" />
                        ) : (
                          <Search className="mr-1.5 inline" size={15} aria-hidden="true" />
                        )}
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-5 p-4">
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase text-[#697384]">Your color</p>
                    <div className="grid grid-cols-2 gap-2">
                      {(['w', 'b'] as Color[]).map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => changePlayerColor(color)}
                          className={`flex items-center justify-center gap-2 rounded border px-3 py-2 text-sm font-semibold ${playerColor === color
                              ? 'border-[#2e7d54] bg-[#edf7f1] text-[#246343]'
                              : 'border-[#d3d8de] bg-white text-[#4d5765] hover:bg-[#f3f5f7]'
                            }`}
                        >
                          <span
                            className={`h-4 w-4 rounded-full border ${color === 'w' ? 'border-[#9ea6b1] bg-white' : 'border-[#202733] bg-[#202733]'
                              }`}
                          />
                          {color === 'w' ? 'White' : 'Black'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label htmlFor="board-theme" className="mb-2 block text-xs font-bold uppercase text-[#697384]">
                      Board theme
                    </label>
                    <select
                      id="board-theme"
                      value={theme}
                      onChange={(event) => setTheme(event.target.value as BoardThemePreset)}
                      className="h-10 w-full rounded border border-[#d3d8de] bg-white px-3 text-sm text-[#313a47] outline-none focus:border-[#2e7d54]"
                    >
                      {THEMES.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <div className="mt-2 flex gap-2">
                      {THEMES.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          title={option.label}
                          aria-label={`${option.label} board theme`}
                          onClick={() => setTheme(option.value)}
                          className={`grid h-7 flex-1 grid-cols-2 overflow-hidden rounded border-2 ${theme === option.value ? 'border-[#202733]' : 'border-transparent'
                            }`}
                        >
                          <span style={{ backgroundColor: option.colors[0] }} />
                          <span style={{ backgroundColor: option.colors[1] }} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label htmlFor="board-size" className="text-xs font-bold uppercase text-[#697384]">Board size</label>
                      <span className="text-xs tabular-nums text-[#697384]">{Math.round(boardSize)}px</span>
                    </div>
                    <input
                      id="board-size"
                      type="range"
                      min="240"
                      max={maxBoardSize}
                      step="8"
                      value={boardSize}
                      onChange={(event) => setRequestedBoardSize(Number(event.target.value))}
                      className="w-full accent-[#2e7d54]"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSoundEnabled((current) => !current)}
                      className={`rounded border px-3 py-2 text-sm font-semibold ${soundEnabled ? 'border-[#2e7d54] bg-[#edf7f1] text-[#246343]' : 'border-[#d3d8de] bg-white text-[#4d5765]'
                        }`}
                    >
                      {soundEnabled ? <Volume2 className="mr-1.5 inline" size={16} /> : <VolumeX className="mr-1.5 inline" size={16} />}
                      Sound {soundEnabled ? 'on' : 'off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowLegalMoves((current) => !current)}
                      className={`rounded border px-3 py-2 text-sm font-semibold ${showLegalMoves ? 'border-[#2e7d54] bg-[#edf7f1] text-[#246343]' : 'border-[#d3d8de] bg-white text-[#4d5765]'
                        }`}
                    >
                      <CircleDot className="mr-1.5 inline" size={16} />
                      Legal moves {showLegalMoves ? 'on' : 'off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setResizable((current) => !current)}
                      className={`rounded border px-3 py-2 text-sm font-semibold ${resizable ? 'border-[#2e7d54] bg-[#edf7f1] text-[#246343]' : 'border-[#d3d8de] bg-white text-[#4d5765]'
                        }`}
                    >
                      <Maximize2 className="mr-1.5 inline" size={16} />
                      Resize handle {resizable ? 'on' : 'off'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setFlipped((current) => !current)}
                      className="rounded border border-[#d3d8de] bg-white px-3 py-2 text-sm font-semibold text-[#4d5765] hover:bg-[#f3f5f7]"
                    >
                      <FlipVertical2 className="mr-1.5 inline" size={16} />
                      Flip board
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 border-t border-[#dfe3e8] pt-4">
                    <button
                      type="button"
                      title="Previous move"
                      aria-label="Previous move"
                      disabled={!canPrevious}
                      onClick={() => moveTimeline('previous')}
                      className="grid h-10 place-items-center rounded border border-[#d3d8de] bg-white text-[#3e4856] hover:bg-[#f3f5f7] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <StepBack size={18} />
                    </button>
                    <button
                      type="button"
                      title="Next move"
                      aria-label="Next move"
                      disabled={!canNext}
                      onClick={() => moveTimeline('next')}
                      className="grid h-10 place-items-center rounded border border-[#d3d8de] bg-white text-[#3e4856] hover:bg-[#f3f5f7] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <StepForward size={18} />
                    </button>
                    <button
                      type="button"
                      title="Flip board"
                      aria-label="Flip board"
                      onClick={() => setFlipped((current) => !current)}
                      className="grid h-10 place-items-center rounded border border-[#d3d8de] bg-white text-[#3e4856] hover:bg-[#f3f5f7]"
                    >
                      <FlipVertical2 size={18} />
                    </button>
                    <button
                      type="button"
                      title="Reset game"
                      aria-label="Reset game"
                      onClick={() => resetGame()}
                      className="grid h-10 place-items-center rounded bg-[#202733] text-white hover:bg-[#303946]"
                    >
                      <RotateCcw size={18} />
                    </button>
                  </div>
                </div>
              </aside>
            </div>

          </div>
        </section>

        <section id="usage" className="mx-auto max-w-[1080px] px-5 py-14 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="mb-2 text-xs font-bold uppercase text-[#2e7d54]">Getting started</p>
              <h2 className="text-2xl font-bold text-[#202733]">Use it with chess.js</h2>
              <p className="mt-3 text-[15px] leading-7 text-[#626d7c]">
                SwiftChess handles the board interaction and presentation. Pass it a chess.js instance and keep
                the current FEN in React state.
              </p>
              <div className="mt-5 rounded-md border border-[#d8dde3] bg-[#151a21] p-4 font-mono text-sm text-[#d8dee9]">
                npm install <span className="text-[#7ee2a8]">swiftchess chess.js</span>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-[#2e7d54]">Premove support</p>
              <h2 className="text-2xl font-bold text-[#202733]">Queue moves during the opponent turn</h2>
              <p className="mt-3 text-[15px] leading-7 text-[#626d7c]">
                Set the player color and the board automatically treats valid interactions during the other side&apos;s
                turn as premoves. Try it above while the random opponent is thinking.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowCode(true)
                  setCodeTab('premove')
                  document.querySelector('#playground')?.scrollIntoView({ behavior: 'smooth' })
                }}
                className="mt-5 rounded-md border border-[#bfc7d0] bg-white px-4 py-2.5 text-sm font-semibold text-[#303946] hover:bg-[#f0f2f5]"
              >
                View premove example
              </button>
            </div>
          </div>

          <div className="mt-14">
            <div className="mb-5">
              <p className="mb-2 text-xs font-bold uppercase text-[#2e7d54]">Core API</p>
              <h2 className="text-2xl font-bold text-[#202733]">Common board options</h2>
            </div>
            <div className="overflow-x-auto border border-[#d8dde3] bg-white">
              <table className="w-full min-w-[680px] border-collapse text-left text-sm">
                <thead className="bg-[#eef1f4] text-xs uppercase text-[#606b79]">
                  <tr>
                    <th className="px-4 py-3 font-bold">Prop</th>
                    <th className="px-4 py-3 font-bold">Type</th>
                    <th className="px-4 py-3 font-bold">Purpose</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e1e5e9] text-[#4f5a68]">
                  {[
                    ['position', 'string', 'Current FEN rendered by the board.'],
                    ['playerColor', '"w" | "b"', 'Controls playable pieces and premove behavior.'],
                    ['mode', '"play" | "analysis"', 'Enables play or analysis presentation.'],
                    ['boardSize', 'number', 'Sets the board width and height in pixels.'],
                    ['resizable', 'boolean', 'Shows the drag resize handle.'],
                    ['showLegalMoves', 'boolean', 'Shows or hides legal target indicators.'],
                    ['arrowStyle', 'object', 'Sets arrow color, opacity, and shaft width.'],
                    ['enableSounds', 'boolean', 'Enables move, capture, check, and game sounds.'],
                  ].map(([prop, type, purpose]) => (
                    <tr key={prop}>
                      <td className="px-4 py-3 font-mono text-[13px] font-semibold text-[#246343]">{prop}</td>
                      <td className="px-4 py-3 font-mono text-[13px] text-[#4c5665]">{type}</td>
                      <td className="px-4 py-3">{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#dfe3e8] bg-white">
        <div className="mx-auto flex max-w-[1080px] flex-col gap-2 px-5 py-7 text-sm text-[#697384] sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span>SwiftChess - React chessboard component</span>
          <a
            href="https://www.npmjs.com/package/swiftchess"
            target="_blank"
            rel="noreferrer"
            className="font-semibold text-[#246343] hover:underline"
          >
            View on npm
          </a>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
