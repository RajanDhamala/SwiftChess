import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Chess } from 'chess.js'
import type { Square, Move } from 'chess.js'
import {
  boardFromFen,
  getSquareName,
  getLegalMoves,
  needsPromotion,
} from '../utils/chessUtils'
import { buildArrowPath } from '../utils/arrowUtils'
import { PieceComponents } from './ChessPieces'
import { BoardGrid } from './chessboard/BoardGrid'
import { ArrowLayer } from './chessboard/ArrowLayer'
import { PromotionDialog } from './chessboard/PromotionDialog'
import { CapturedPiecesRow } from './chessboard/CapturedPiecesRow'
import { BoardControls } from './chessboard/BoardControls'
import { FenLoader } from './chessboard/FenLoader'
import type {
  Arrow,
  DragState,
  LastMoveState,
  PremoveState,
  PromotionPendingState,
} from './chessboard/types'

interface ChessBoardProps {
  initialFen?: string
  flipped?: boolean
  squareSize?: number
  minSize?: number
  maxSize?: number
}

const BOARD_SIZES = [48, 56, 64, 72, 80, 88, 96]

const ChessBoard: React.FC<ChessBoardProps> = ({
  initialFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  flipped = false,
  squareSize: initialSquareSize = 72,
  minSize = 48,
  maxSize = 96,
}) => {
  const [game, setGame] = useState(() => new Chess(initialFen))
  const [pieces, setPieces] = useState<Record<string, string>>(() => boardFromFen(initialFen))
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<Move[]>([])
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [lastMove, setLastMove] = useState<LastMoveState | null>(null)
  const [arrows, setArrows] = useState<Arrow[]>([])
  const [drawingArrow, setDrawingArrow] = useState<{ from: string } | null>(null)
  const [premoves, setPremoves] = useState<PremoveState[]>([])
  const [inCheck, setInCheck] = useState<string | null>(null)
  const [capturedWhite, setCapturedWhite] = useState<string[]>([])
  const [capturedBlack, setCapturedBlack] = useState<string[]>([])
  const [promotionPending, setPromotionPending] = useState<PromotionPendingState | null>(null)
  const [isFlipped, setIsFlipped] = useState(flipped)
  const [squareSize, setSquareSize] = useState(initialSquareSize)
  const [fenInput, setFenInput] = useState('')
  const [fenError, setFenError] = useState('')

  const boardRef = useRef<HTMLDivElement>(null)
  const dragPointerRef = useRef({ x: 0, y: 0 })
  const drawPointerRef = useRef({ x: 0, y: 0 })
  const boardRectRef = useRef<DOMRect | null>(null)
  const dragGhostRef = useRef<HTMLDivElement>(null)
  const liveArrowPathRef = useRef<SVGPathElement>(null)
  const rafRef = useRef<number | null>(null)
  const boardSize = squareSize * 8

  const updateCheckStatus = useCallback((activeGame: Chess) => {
    if (activeGame.isCheck()) {
      const board = activeGame.board()
      const turn = activeGame.turn()
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 8; col++) {
          const piece = board[row][col]
          if (piece && piece.type === 'k' && piece.color === turn) {
            const file = String.fromCharCode(97 + col)
            const rank = 8 - row
            setInCheck(`${file}${rank}`)
            return
          }
        }
      }
    }
    setInCheck(null)
  }, [])

  const loadFen = useCallback((fen: string) => {
    try {
      const newGame = new Chess(fen)
      setGame(newGame)
      setPieces(boardFromFen(fen))
      setSelectedSquare(null)
      setLegalMoves([])
      setLastMove(null)
      setArrows([])
      setPremoves([])
      setInCheck(null)
      setCapturedWhite([])
      setCapturedBlack([])
      setPromotionPending(null)
      setFenError('')
      updateCheckStatus(newGame)
    } catch {
      setFenError('Invalid FEN string')
    }
  }, [updateCheckStatus])

  const handleResize = useCallback((direction: 'up' | 'down') => {
    setSquareSize((prev) => {
      const idx = BOARD_SIZES.indexOf(prev)
      if (direction === 'up' && idx < BOARD_SIZES.length - 1) return BOARD_SIZES[idx + 1]
      if (direction === 'down' && idx > 0) return BOARD_SIZES[idx - 1]
      if (idx === -1) {
        if (direction === 'up') return BOARD_SIZES.find(size => size > prev) || prev
        return [...BOARD_SIZES].reverse().find(size => size < prev) || prev
      }
      return prev
    })
  }, [])

  const makeMove = useCallback((from: string, to: string, promotion?: string) => {
    const gameCopy = new Chess(game.fen())
    try {
      const move = gameCopy.move({
        from: from as Square,
        to: to as Square,
        promotion: promotion || undefined,
      })
      if (move) {
        if (move.captured) {
          const capturedPiece = move.color === 'w'
            ? `b${move.captured.toUpperCase()}`
            : `w${move.captured.toUpperCase()}`
          if (move.color === 'w') {
            setCapturedBlack(prev => [...prev, capturedPiece])
          } else {
            setCapturedWhite(prev => [...prev, capturedPiece])
          }
        }
        setGame(gameCopy)
        setPieces(boardFromFen(gameCopy.fen()))
        setLastMove({ from, to })
        setPremoves([])
        updateCheckStatus(gameCopy)
        setSelectedSquare(null)
        setLegalMoves([])
        setArrows([])
        return true
      }
    } catch {
      // illegal move
    }
    return false
  }, [game, updateCheckStatus])

  const handleSquareClick = useCallback((square: string) => {
    if (promotionPending) return

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setLegalMoves([])
        return
      }
      if (needsPromotion(game, selectedSquare, square)) {
        setPromotionPending({ from: selectedSquare, to: square })
        return
      }
      if (makeMove(selectedSquare, square)) return

      const piece = pieces[square]
      if (piece && piece[0] === (game.turn() === 'w' ? 'w' : 'b')) {
        setSelectedSquare(square)
        setLegalMoves(getLegalMoves(game, square))
        return
      }

      setSelectedSquare(null)
      setLegalMoves([])
      return
    }

    const piece = pieces[square]
    if (piece && piece[0] === (game.turn() === 'w' ? 'w' : 'b')) {
      setSelectedSquare(square)
      setLegalMoves(getLegalMoves(game, square))
    }
  }, [selectedSquare, pieces, game, makeMove, promotionPending])

  const handlePromotion = useCallback((promotionPiece: string) => {
    if (promotionPending) {
      makeMove(promotionPending.from, promotionPending.to, promotionPiece)
      setPromotionPending(null)
    }
  }, [promotionPending, makeMove])

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>, square: string) => {
    if (e.button === 2) {
      e.preventDefault()
      drawPointerRef.current = { x: e.clientX, y: e.clientY }
      boardRectRef.current = boardRef.current?.getBoundingClientRect() ?? null
      setDrawingArrow({ from: square })
      scheduleOverlayFrame()
      return
    }
    if (e.button !== 0 || promotionPending) return

    const piece = pieces[square]
    if (!piece) {
      handleSquareClick(square)
      return
    }
    if (piece[0] !== (game.turn() === 'w' ? 'w' : 'b')) {
      handleSquareClick(square)
      return
    }

    setSelectedSquare(square)
    setLegalMoves(getLegalMoves(game, square))
    setArrows([])

    dragPointerRef.current = { x: e.clientX, y: e.clientY }
    setDragging({ piece, from: square })
    scheduleOverlayFrame()
  }, [pieces, game, handleSquareClick, promotionPending])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging && !drawingArrow) return
    if (dragging) dragPointerRef.current = { x: e.clientX, y: e.clientY }
    if (drawingArrow) drawPointerRef.current = { x: e.clientX, y: e.clientY }
    scheduleOverlayFrame()
  }, [dragging, drawingArrow])

  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (drawingArrow && e.button === 2) {
      const rect = boardRectRef.current ?? boardRef.current?.getBoundingClientRect()
      if (rect) {
        const col = Math.floor((e.clientX - rect.left) / squareSize)
        const row = Math.floor((e.clientY - rect.top) / squareSize)
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
          const toSquare = getSquareName(col, row, isFlipped)
          if (drawingArrow.from !== toSquare) {
            setArrows((prev) => {
              const existing = prev.findIndex(arrow => arrow.from === drawingArrow.from && arrow.to === toSquare)
              if (existing >= 0) return prev.filter((_, index) => index !== existing)
              return [...prev, { from: drawingArrow.from, to: toSquare }]
            })
          } else {
            setArrows([])
          }
        }
      }
      setDrawingArrow(null)
      if (liveArrowPathRef.current) liveArrowPathRef.current.setAttribute('d', '')
      boardRectRef.current = null
      return
    }

    if (!dragging) return
    const rect = boardRef.current?.getBoundingClientRect()
    if (rect) {
      const col = Math.floor((e.clientX - rect.left) / squareSize)
      const row = Math.floor((e.clientY - rect.top) / squareSize)
      if (col >= 0 && col < 8 && row >= 0 && row < 8) {
        const toSquare = getSquareName(col, row, isFlipped)
        if (dragging.from !== toSquare) {
          if (needsPromotion(game, dragging.from, toSquare)) {
            setPromotionPending({ from: dragging.from, to: toSquare })
          } else {
            makeMove(dragging.from, toSquare)
          }
        }
      }
    }
    setDragging(null)
  }, [dragging, drawingArrow, squareSize, isFlipped, game, makeMove])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const resetGame = useCallback(() => {
    loadFen(initialFen)
  }, [initialFen, loadFen])

  const undoMove = useCallback(() => {
    const gameCopy = new Chess(game.fen())
    const undone = gameCopy.undo()
    if (undone) {
      setGame(gameCopy)
      setPieces(boardFromFen(gameCopy.fen()))
      updateCheckStatus(gameCopy)
      setSelectedSquare(null)
      setLegalMoves([])
      setLastMove(null)
      setPremoves([])
      if (undone.captured) {
        if (undone.color === 'w') {
          setCapturedBlack((prev) => {
            const index = prev.lastIndexOf(`b${undone.captured!.toUpperCase()}`)
            if (index >= 0) return [...prev.slice(0, index), ...prev.slice(index + 1)]
            return prev
          })
        } else {
          setCapturedWhite((prev) => {
            const index = prev.lastIndexOf(`w${undone.captured!.toUpperCase()}`)
            if (index >= 0) return [...prev.slice(0, index), ...prev.slice(index + 1)]
            return prev
          })
        }
      }
    }
  }, [game, updateCheckStatus])

  function updateOverlayFrame() {
    if (dragging && dragGhostRef.current) {
      const dragX = dragPointerRef.current.x - squareSize / 2
      const dragY = dragPointerRef.current.y - squareSize / 2
      dragGhostRef.current.style.transform = `translate3d(${dragX}px, ${dragY}px, 0)`
    }

    if (drawingArrow && liveArrowPathRef.current) {
      const rect = boardRectRef.current ?? boardRef.current?.getBoundingClientRect() ?? null
      if (!rect) {
        liveArrowPathRef.current.setAttribute('d', '')
        return
      }

      boardRectRef.current = rect
      const col = Math.floor((drawPointerRef.current.x - rect.left) / squareSize)
      const row = Math.floor((drawPointerRef.current.y - rect.top) / squareSize)
      if (col < 0 || col > 7 || row < 0 || row > 7) {
        liveArrowPathRef.current.setAttribute('d', '')
        return
      }

      const toSquare = getSquareName(col, row, isFlipped)
      if (toSquare === drawingArrow.from) {
        liveArrowPathRef.current.setAttribute('d', '')
        return
      }

      const livePath = buildArrowPath(drawingArrow.from, toSquare, isFlipped, squareSize, squareSize / 3.5)
      liveArrowPathRef.current.setAttribute('d', livePath ?? '')
    }
  }

  function scheduleOverlayFrame() {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      updateOverlayFrame()
    })
  }

  useEffect(() => {
    if (dragging || drawingArrow) {
      scheduleOverlayFrame()
    }
  }, [dragging, drawingArrow, squareSize, isFlipped])

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current)
      }
    }
  }, [])

  const renderDragPiece = () => {
    if (!dragging) return null
    const PieceComp = PieceComponents[dragging.piece]
    if (!PieceComp) return null
    return (
      <div
        ref={dragGhostRef}
        className="fixed pointer-events-none z-[1000] flex items-center justify-center"
        style={{
          left: 0,
          top: 0,
          width: squareSize,
          height: squareSize,
          transform: `translate3d(${dragPointerRef.current.x - squareSize / 2}px, ${dragPointerRef.current.y - squareSize / 2}px, 0)`,
          willChange: 'transform',
        }}
      >
        <div className="drop-shadow-lg scale-110 flex items-center justify-center w-full h-full">
          <PieceComp size={squareSize - 4} />
        </div>
      </div>
    )
  }

  const getStatus = () => {
    if (game.isCheckmate()) return `Checkmate! ${game.turn() === 'w' ? 'Black' : 'White'} wins!`
    if (game.isDraw()) return 'Draw!'
    if (game.isStalemate()) return 'Stalemate!'
    if (game.isThreefoldRepetition()) return 'Draw by repetition!'
    if (game.isInsufficientMaterial()) return 'Draw by insufficient material!'
    if (game.isCheck()) return `${game.turn() === 'w' ? 'White' : 'Black'} is in check!`
    return `${game.turn() === 'w' ? 'White' : 'Black'} to move`
  }

  return (
    <div className="flex flex-col items-center gap-4 p-5">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-100 tracking-wide">♟ Chess Board</h1>
        <div className="mt-1 text-sm text-gray-400 bg-white/[0.06] px-5 py-1.5 rounded-lg inline-block">
          {getStatus()}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <CapturedPiecesRow
          capturedPieces={isFlipped ? capturedWhite : capturedBlack}
          label={isFlipped ? 'White captured:' : 'Black captured:'}
        />

        <div
          ref={boardRef}
          className="grid grid-cols-[repeat(8,1fr)] grid-rows-[repeat(8,1fr)] border-[3px] border-[#3a3a5c] rounded relative shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)] select-none"
          style={{ width: boardSize, height: boardSize }}
          onContextMenu={handleContextMenu}
        >
          <BoardGrid
            pieces={pieces}
            squareSize={squareSize}
            isFlipped={isFlipped}
            selectedSquare={selectedSquare}
            legalMoves={legalMoves}
            lastMove={lastMove}
            inCheck={inCheck}
            premoves={premoves}
            draggingFrom={dragging?.from ?? null}
            onSquareMouseDown={handleMouseDown}
            onSquareClick={(square) => {
              if (!dragging) handleSquareClick(square)
            }}
          />

          <ArrowLayer
            arrows={arrows}
            drawingArrow={Boolean(drawingArrow)}
            boardSize={boardSize}
            squareSize={squareSize}
            isFlipped={isFlipped}
            liveArrowPathRef={liveArrowPathRef}
          />

          <PromotionDialog
            pending={promotionPending}
            turn={game.turn()}
            squareSize={squareSize}
            boardSize={boardSize}
            isFlipped={isFlipped}
            onSelect={handlePromotion}
          />
        </div>

        <CapturedPiecesRow
          capturedPieces={isFlipped ? capturedBlack : capturedWhite}
          label={isFlipped ? 'Black captured:' : 'White captured:'}
        />
      </div>

      <BoardControls
        boardSize={boardSize}
        squareSize={squareSize}
        minSize={minSize}
        maxSize={maxSize}
        onReset={resetGame}
        onUndo={undoMove}
        onFlip={() => setIsFlipped(prev => !prev)}
        onResizeDown={() => handleResize('down')}
        onResizeUp={() => handleResize('up')}
      />

      <FenLoader
        fenInput={fenInput}
        fenError={fenError}
        onFenInputChange={(value) => {
          setFenInput(value)
          setFenError('')
        }}
        onLoad={() => {
          if (fenInput.trim()) loadFen(fenInput.trim())
        }}
      />

      {renderDragPiece()}
    </div>
  )
}

export default ChessBoard
