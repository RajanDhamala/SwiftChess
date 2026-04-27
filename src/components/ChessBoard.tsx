import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Color, Move, Square } from 'chess.js'
import {
  boardFromFen,
  getSquareName,
  getLegalMoves,
  getRelaxedPremoveTargets,
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
import { BOARD_THEME_PRESETS } from './chessboard/types'
import type {
  Arrow,
  ArrowStyleOptions,
  BoardThemeColors,
  BoardThemePreset,
  DragState,
  LastMoveState,
  PremoveState,
  PromotionPendingState,
} from './chessboard/types'

export type { BoardThemeColors, BoardThemePreset } from './chessboard/types'
export { BOARD_THEME_PRESETS } from './chessboard/types'

export interface PremoveValidationArgs {
  premove: PremoveState
  chess: Chess
  position: string
  playerColor: Color
}

export interface ChessBoardProps {
  chess: Chess
  position: string
  onPositionChange?: (fen: string, move?: Move) => void
  onMove?: (move: Move) => void
  onPremoveAdd?: (premove: PremoveState) => void
  onPremoveExecute?: (premove: PremoveState, move: Move) => void
  onPremoveReject?: (premove: PremoveState) => void
  canQueuePremove?: (args: PremoveValidationArgs) => boolean
  premoves?: PremoveState[]
  onPremovesChange?: (premoves: PremoveState[]) => void
  arrows?: Arrow[]
  onArrowsChange?: (arrows: Arrow[]) => void
  customArrows?: Arrow[]
  onCustomArrowsChange?: (arrows: Arrow[]) => void
  arrowStyle?: ArrowStyleOptions
  capturedWhitePieces?: string[]
  capturedBlackPieces?: string[]
  playerColor?: Color
  relaxedPremoveMode?: boolean
  enableSounds?: boolean
  successSoundSrc?: string
  playSuccessSound?: boolean
  initialFen?: string
  boardThemePreset?: BoardThemePreset
  boardTheme?: Partial<BoardThemeColors>
  flipped?: boolean
  onFlippedChange?: (flipped: boolean) => void
  squareSize?: number
  minSize?: number
  maxSize?: number
}

export interface ChessBoardHandle {
  flipBoard: () => void
  setFlipped: (flipped: boolean) => void
  isFlipped: () => boolean
}

const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const BOARD_SIZES = [48, 56, 64, 72, 80, 88, 96]
const DEFAULT_ARROW_STYLE: Required<ArrowStyleOptions> = {
  color: 'rgb(0, 150, 50)',
  opacity: 0.85,
  widthScale: 1 / 9,
  liveColor: 'rgb(0, 120, 200)',
  liveOpacity: 0.7,
}
const DEFAULT_SOUND_SRCS = {
  move: '/move.mp3',
  capture: '/capture.mp3',
  castle: '/castle.mp3',
  check: '/check.mp3',
  end: '/end.mp3',
}

function removeCastlingRights(castlingRights: string, flags: string[]) {
  let next = castlingRights === '-' ? '' : castlingRights
  for (const flag of flags) {
    next = next.replace(flag, '')
  }
  return next || '-'
}

function applyRelaxedPremoveStep(
  pieces: Record<string, string>,
  castlingRights: string,
  premove: PremoveState,
  playerColor: Color,
): { pieces: Record<string, string>; castlingRights: string } | null {
  const movingPiece = pieces[premove.from]
  if (!movingPiece || movingPiece[0] !== playerColor) return null

  const targets = getRelaxedPremoveTargets(pieces, premove.from, castlingRights)
  if (!targets.includes(premove.to)) return null

  const nextPieces = { ...pieces }
  const from = premove.from
  const to = premove.to
  const fromFile = from.charCodeAt(0)
  const toFile = to.charCodeAt(0)
  const isKing = movingPiece[1] === 'K'
  const isRook = movingPiece[1] === 'R'
  const isPawn = movingPiece[1] === 'P'

  let nextRights = castlingRights
  if (movingPiece[0] === 'w' && isKing) nextRights = removeCastlingRights(nextRights, ['K', 'Q'])
  if (movingPiece[0] === 'b' && isKing) nextRights = removeCastlingRights(nextRights, ['k', 'q'])

  if (isRook && from === 'h1') nextRights = removeCastlingRights(nextRights, ['K'])
  if (isRook && from === 'a1') nextRights = removeCastlingRights(nextRights, ['Q'])
  if (isRook && from === 'h8') nextRights = removeCastlingRights(nextRights, ['k'])
  if (isRook && from === 'a8') nextRights = removeCastlingRights(nextRights, ['q'])

  if (to === 'h1') nextRights = removeCastlingRights(nextRights, ['K'])
  if (to === 'a1') nextRights = removeCastlingRights(nextRights, ['Q'])
  if (to === 'h8') nextRights = removeCastlingRights(nextRights, ['k'])
  if (to === 'a8') nextRights = removeCastlingRights(nextRights, ['q'])

  let placedPiece = movingPiece
  if (isPawn && premove.promotion) {
    placedPiece = `${movingPiece[0]}${premove.promotion.toUpperCase()}`
  }

  delete nextPieces[from]
  nextPieces[to] = placedPiece

  const isCastling = isKing && Math.abs(toFile - fromFile) === 2
  if (isCastling) {
    if (from === 'e1' && to === 'g1' && nextPieces.h1 === 'wR') {
      delete nextPieces.h1
      nextPieces.f1 = 'wR'
    }
    if (from === 'e1' && to === 'c1' && nextPieces.a1 === 'wR') {
      delete nextPieces.a1
      nextPieces.d1 = 'wR'
    }
    if (from === 'e8' && to === 'g8' && nextPieces.h8 === 'bR') {
      delete nextPieces.h8
      nextPieces.f8 = 'bR'
    }
    if (from === 'e8' && to === 'c8' && nextPieces.a8 === 'bR') {
      delete nextPieces.a8
      nextPieces.d8 = 'bR'
    }
  }

  return { pieces: nextPieces, castlingRights: nextRights }
}

function withTurn(fen: string, turn: Color): string {
  const parts = fen.trim().split(/\s+/)
  if (parts.length < 6) return fen
  parts[1] = turn
  return parts.join(' ')
}

function getCheckedKingSquare(activeGame: Chess): string | null {
  if (!activeGame.isCheck()) return null
  const board = activeGame.board()
  const turn = activeGame.turn()
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (piece && piece.type === 'k' && piece.color === turn) {
        const file = String.fromCharCode(97 + col)
        const rank = 8 - row
        return `${file}${rank}`
      }
    }
  }
  return null
}

const ChessBoard = React.forwardRef<ChessBoardHandle, ChessBoardProps>(({
  chess,
  position,
  onPositionChange,
  onMove,
  onPremoveAdd,
  onPremoveExecute,
  onPremoveReject,
  canQueuePremove,
  premoves,
  onPremovesChange,
  arrows,
  onArrowsChange,
  customArrows,
  onCustomArrowsChange,
  arrowStyle,
  capturedWhitePieces,
  capturedBlackPieces,
  playerColor = 'w',
  relaxedPremoveMode = true,
  enableSounds = true,
  successSoundSrc,
  playSuccessSound = false,
  initialFen = DEFAULT_POSITION,
  boardThemePreset = 'brownBoard',
  boardTheme,
  flipped = false,
  onFlippedChange,
  squareSize: initialSquareSize = 80,
  minSize = 48,
  maxSize = 96,
}, ref) => {
  const boardView = useMemo(() => new Chess(position), [position])
  const pieces = useMemo(() => boardFromFen(position), [position])
  const mergedArrowStyle = useMemo(
    () => ({ ...DEFAULT_ARROW_STYLE, ...arrowStyle }),
    [arrowStyle],
  )
  const mergedBoardTheme = useMemo(
    () => ({
      ...(BOARD_THEME_PRESETS[boardThemePreset] ?? BOARD_THEME_PRESETS.brownBoard),
      ...boardTheme,
    }),
    [boardTheme, boardThemePreset],
  )

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [drawingArrow, setDrawingArrow] = useState<{ from: string } | null>(null)
  const [promotionPending, setPromotionPending] = useState<PromotionPendingState | null>(null)
  const [isFlipped, setIsFlipped] = useState(flipped)
  const [squareSize, setSquareSize] = useState(initialSquareSize)
  const [fenInput, setFenInput] = useState('')
  const [fenError, setFenError] = useState('')
  const [internalArrows, setInternalArrows] = useState<Arrow[]>([])
  const [internalPremoves, setInternalPremoves] = useState<PremoveState[]>([])

  const boardRef = useRef<HTMLDivElement>(null)
  const dragPointerRef = useRef({ x: 0, y: 0 })
  const drawPointerRef = useRef({ x: 0, y: 0 })
  const boardRectRef = useRef<DOMRect | null>(null)
  const dragGhostRef = useRef<HTMLDivElement>(null)
  const liveArrowPathRef = useRef<SVGPathElement>(null)
  const rafRef = useRef<number | null>(null)
  const lastHistoryLengthRef = useRef(chess.history().length)
  const wasGameOverRef = useRef(false)
  const wasPlaySuccessSoundRef = useRef(playSuccessSound)
  const soundRefs = useRef<{
    move?: HTMLAudioElement
    capture?: HTMLAudioElement
    castle?: HTMLAudioElement
    check?: HTMLAudioElement
    end?: HTMLAudioElement
    success?: HTMLAudioElement
  }>({})

  const boardSize = squareSize * 8
  const turn = boardView.turn()
  const inCheck = useMemo(() => getCheckedKingSquare(boardView), [boardView])
  const castlingRights = useMemo(() => {
    const fenParts = position.trim().split(/\s+/)
    return fenParts[2] ?? '-'
  }, [position])

  const playAudio = useCallback((audio?: HTMLAudioElement) => {
    if (!enableSounds || !audio) return
    audio.currentTime = 0
    void audio.play().catch(() => { })
  }, [enableSounds])

  const activeArrows = arrows ?? customArrows ?? internalArrows
  const activePremoves = premoves ?? internalPremoves
  const setBoardFlipped = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    setIsFlipped((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next
      onFlippedChange?.(resolved)
      return resolved
    })
  }, [onFlippedChange])
  const premovePreview = useMemo(() => {
    if (relaxedPremoveMode) {
      let previewPieces = { ...pieces }
      let previewCastlingRights = castlingRights

      for (const premove of activePremoves) {
        const next = applyRelaxedPremoveStep(
          previewPieces,
          previewCastlingRights,
          premove,
          playerColor,
        )
        if (!next) break
        previewPieces = next.pieces
        previewCastlingRights = next.castlingRights
      }

      return {
        previewFen: withTurn(position, playerColor),
        previewPieces,
        previewCastlingRights,
      }
    }

    let previewGame = new Chess(withTurn(position, playerColor))
    for (const premove of activePremoves) {
      try {
        const stepGame = new Chess(withTurn(previewGame.fen(), playerColor))
        const move = stepGame.move({
          from: premove.from as Square,
          to: premove.to as Square,
          promotion: premove.promotion,
        })
        if (!move) break
        previewGame = stepGame
      } catch {
        break
      }
    }

    const previewFen = previewGame.fen()
    const previewPieces = boardFromFen(previewFen)
    const previewCastlingRights = previewFen.trim().split(/\s+/)[2] ?? '-'
    return { previewFen, previewPieces, previewCastlingRights }
  }, [activePremoves, castlingRights, pieces, playerColor, position, relaxedPremoveMode])

  const getPlanningPiece = useCallback((square: string) => {
    if (turn === playerColor) return pieces[square]
    return premovePreview.previewPieces[square]
  }, [pieces, playerColor, premovePreview.previewPieces, turn])

  const setArrows = useCallback((next: Arrow[] | ((prev: Arrow[]) => Arrow[])) => {
    const resolved = typeof next === 'function' ? next(activeArrows) : next
    if (arrows === undefined && customArrows === undefined) {
      setInternalArrows(resolved)
    }
    onArrowsChange?.(resolved)
    onCustomArrowsChange?.(resolved)
  }, [activeArrows, arrows, customArrows, onArrowsChange, onCustomArrowsChange])

  const setPremoves = useCallback((next: PremoveState[] | ((prev: PremoveState[]) => PremoveState[])) => {
    const resolved = typeof next === 'function' ? next(activePremoves) : next
    if (premoves === undefined) {
      setInternalPremoves(resolved)
    }
    onPremovesChange?.(resolved)
  }, [activePremoves, premoves, onPremovesChange])

  const lastMove = useMemo<LastMoveState | null>(() => {
    const history = chess.history({ verbose: true })
    const last = history[history.length - 1]
    return last ? { from: last.from, to: last.to } : null
  }, [chess, position])

  const { capturedWhite: calculatedCapturedWhite, capturedBlack: calculatedCapturedBlack } = useMemo(() => {
    const white: string[] = []
    const black: string[] = []
    const history = chess.history({ verbose: true })
    for (const move of history) {
      if (!move.captured) continue
      const capturedPiece = move.color === 'w'
        ? `b${move.captured.toUpperCase()}`
        : `w${move.captured.toUpperCase()}`
      if (move.color === 'w') {
        black.push(capturedPiece)
      } else {
        white.push(capturedPiece)
      }
    }
    return { capturedWhite: white, capturedBlack: black }
  }, [chess, position])

  const capturedWhite = capturedWhitePieces ?? calculatedCapturedWhite
  const capturedBlack = capturedBlackPieces ?? calculatedCapturedBlack

  const emitPositionChange = useCallback((move?: Move) => {
    onPositionChange?.(chess.fen(), move)
  }, [chess, onPositionChange])

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

  const executeMove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    if (chess.fen() !== position) return null
    try {
      const move = chess.move({
        from: from as Square,
        to: to as Square,
        promotion,
      })
      if (!move) return null
      setSelectedSquare(null)
      setLegalMoves([])
      setPromotionPending(null)
      setArrows([])
      onMove?.(move)
      emitPositionChange(move)
      return move
    } catch {
      return null
    }
  }, [chess, emitPositionChange, onMove, position, setArrows])

  const defaultCanQueuePremove = useCallback((premove: PremoveState) => {
    if (relaxedPremoveMode) {
      const relaxedTargets = getRelaxedPremoveTargets(
        premovePreview.previewPieces,
        premove.from,
        premovePreview.previewCastlingRights,
      )
      return relaxedTargets.includes(premove.to)
    }
    try {
      const premoveGame = new Chess(withTurn(premovePreview.previewFen, playerColor))
      return Boolean(
        premoveGame.move({
          from: premove.from as Square,
          to: premove.to as Square,
          promotion: premove.promotion,
        }),
      )
    } catch {
      return false
    }
  }, [playerColor, premovePreview.previewCastlingRights, premovePreview.previewFen, premovePreview.previewPieces, relaxedPremoveMode])

  const needsPremovePromotion = useCallback((from: string, to: string) => {
    const piece = premovePreview.previewPieces[from]
    if (!piece || piece[1] !== 'P') return false
    const destinationRank = Number(to[1])
    return piece[0] === 'w' ? destinationRank === 8 : destinationRank === 1
  }, [premovePreview.previewPieces])

  const queuePremove = useCallback((from: string, to: string, promotion?: 'q' | 'r' | 'b' | 'n') => {
    const premove: PremoveState = { from, to, promotion }
    const canQueue = canQueuePremove
      ? canQueuePremove({ premove, chess, position, playerColor })
      : defaultCanQueuePremove(premove)
    if (!canQueue) return false
    setPremoves((prev) => [...prev, premove])
    onPremoveAdd?.(premove)
    setSelectedSquare(null)
    setLegalMoves([])
    return true
  }, [canQueuePremove, chess, defaultCanQueuePremove, onPremoveAdd, playerColor, position, setPremoves])

  const getSelectableMoves = useCallback((square: string) => {
    const planningPieces = turn === playerColor ? pieces : premovePreview.previewPieces
    const piece = planningPieces[square]
    if (!piece || piece[0] !== playerColor) return []
    if (turn === playerColor) {
      return getLegalMoves(boardView, square).map((move) => move.to)
    }
    if (relaxedPremoveMode) {
      return getRelaxedPremoveTargets(planningPieces, square, premovePreview.previewCastlingRights)
    }
    try {
      const premoveGame = new Chess(withTurn(premovePreview.previewFen, playerColor))
      return getLegalMoves(premoveGame, square).map((move) => move.to)
    } catch {
      return []
    }
  }, [boardView, pieces, playerColor, premovePreview.previewCastlingRights, premovePreview.previewFen, premovePreview.previewPieces, relaxedPremoveMode, turn])

  const handleSquareClick = useCallback((square: string) => {
    if (promotionPending) return
    const piece = getPlanningPiece(square)

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setLegalMoves([])
        return
      }

      const selectedPiece = getPlanningPiece(selectedSquare)
      if (!selectedPiece || selectedPiece[0] !== playerColor) {
        setSelectedSquare(null)
        setLegalMoves([])
        return
      }

      if (turn === playerColor) {
        if (needsPromotion(boardView, selectedSquare, square)) {
          setPromotionPending({ from: selectedSquare, to: square })
          return
        }
      } else if (needsPremovePromotion(selectedSquare, square)) {
        setPromotionPending({ from: selectedSquare, to: square })
        return
      }

      const actionSuccessful = turn === playerColor
        ? Boolean(executeMove(selectedSquare, square))
        : queuePremove(selectedSquare, square)
      if (actionSuccessful) return

      if (piece && piece[0] === playerColor) {
        setSelectedSquare(square)
        setLegalMoves(getSelectableMoves(square))
      } else {
        setSelectedSquare(null)
        setLegalMoves([])
      }
      return
    }

    if (piece && piece[0] === playerColor) {
      setSelectedSquare(square)
      setLegalMoves(getSelectableMoves(square))
      return
    }

    setSelectedSquare(null)
    setLegalMoves([])
  }, [
    boardView,
    executeMove,
    getPlanningPiece,
    getSelectableMoves,
    needsPremovePromotion,
    playerColor,
    promotionPending,
    queuePremove,
    selectedSquare,
    turn,
  ])

  const handlePromotion = useCallback((promotionPiece: string) => {
    if (!promotionPending) return
    const promotion = promotionPiece as 'q' | 'r' | 'b' | 'n'
    if (turn === playerColor) {
      executeMove(promotionPending.from, promotionPending.to, promotion)
    } else {
      queuePremove(promotionPending.from, promotionPending.to, promotion)
    }
    setPromotionPending(null)
  }, [executeMove, playerColor, promotionPending, queuePremove, turn])

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
    const piece = getPlanningPiece(square)
    if (!piece || piece[0] !== playerColor) {
      handleSquareClick(square)
      return
    }

    setSelectedSquare(square)
    setLegalMoves(getSelectableMoves(square))
    setArrows([])
    dragPointerRef.current = { x: e.clientX, y: e.clientY }
    setDragging({ piece, from: square })
    scheduleOverlayFrame()
  }, [getPlanningPiece, getSelectableMoves, handleSquareClick, playerColor, promotionPending, setArrows])

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
              const existing = prev.findIndex(
                (arrow) => arrow.from === drawingArrow.from && arrow.to === toSquare,
              )
              if (existing >= 0) {
                return prev.filter((_, index) => index !== existing)
              }
              return [
                ...prev,
                {
                  from: drawingArrow.from,
                  to: toSquare,
                  color: mergedArrowStyle.color,
                  opacity: mergedArrowStyle.opacity,
                  widthScale: mergedArrowStyle.widthScale,
                },
              ]
            })
          } else {
            if (activePremoves.length > 0) setPremoves([])
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
          if (turn === playerColor) {
            if (needsPromotion(boardView, dragging.from, toSquare)) {
              setPromotionPending({ from: dragging.from, to: toSquare })
              setDragging(null)
              return
            }
            executeMove(dragging.from, toSquare)
          } else {
            if (needsPremovePromotion(dragging.from, toSquare)) {
              setPromotionPending({ from: dragging.from, to: toSquare })
              setDragging(null)
              return
            }
            queuePremove(dragging.from, toSquare)
          }
        }
      }
    }
    setDragging(null)
  }, [
    activePremoves.length,
    boardView,
    dragging,
    drawingArrow,
    executeMove,
    isFlipped,
    mergedArrowStyle.color,
    mergedArrowStyle.opacity,
    mergedArrowStyle.widthScale,
    needsPremovePromotion,
    playerColor,
    queuePremove,
    setArrows,
    setPremoves,
    squareSize,
    turn,
  ])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const loadFen = useCallback((fen: string) => {
    try {
      chess.load(fen)
      setFenError('')
      setSelectedSquare(null)
      setLegalMoves([])
      setDrawingArrow(null)
      setPromotionPending(null)
      setArrows([])
      setPremoves([])
      emitPositionChange()
    } catch {
      setFenError('Invalid FEN string')
    }
  }, [chess, emitPositionChange, setArrows, setPremoves])

  const resetGame = useCallback(() => {
    loadFen(initialFen)
  }, [initialFen, loadFen])

  const undoMove = useCallback(() => {
    if (chess.fen() !== position) return
    const undone = chess.undo()
    if (!undone) return
    setSelectedSquare(null)
    setLegalMoves([])
    setPromotionPending(null)
    setPremoves([])
    emitPositionChange()
  }, [chess, emitPositionChange, position, setPremoves])

  useEffect(() => {
    setIsFlipped(flipped)
  }, [flipped])

  useImperativeHandle(ref, () => ({
    flipBoard: () => setBoardFlipped((prev) => !prev),
    setFlipped: (nextFlipped: boolean) => setBoardFlipped(nextFlipped),
    isFlipped: () => isFlipped,
  }), [isFlipped, setBoardFlipped])

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  useEffect(() => {
    soundRefs.current.move = new Audio(DEFAULT_SOUND_SRCS.move)
    soundRefs.current.capture = new Audio(DEFAULT_SOUND_SRCS.capture)
    soundRefs.current.castle = new Audio(DEFAULT_SOUND_SRCS.castle)
    soundRefs.current.check = new Audio(DEFAULT_SOUND_SRCS.check)
    soundRefs.current.end = new Audio(DEFAULT_SOUND_SRCS.end)
    soundRefs.current.success = successSoundSrc ? new Audio(successSoundSrc) : undefined

    for (const key of Object.keys(soundRefs.current) as Array<keyof typeof soundRefs.current>) {
      const audio = soundRefs.current[key]
      if (!audio) continue
      audio.preload = 'auto'
    }

    return () => {
      for (const key of Object.keys(soundRefs.current) as Array<keyof typeof soundRefs.current>) {
        const audio = soundRefs.current[key]
        if (!audio) continue
        audio.pause()
      }
    }
  }, [successSoundSrc])

  useEffect(() => {
    const shouldPlay = playSuccessSound && !wasPlaySuccessSoundRef.current
    if (shouldPlay) {
      playAudio(soundRefs.current.success)
    }
    wasPlaySuccessSoundRef.current = playSuccessSound
  }, [playAudio, playSuccessSound])

  useEffect(() => {
    const history = chess.history({ verbose: true })
    const previousHistoryLength = lastHistoryLengthRef.current
    const gameOverNow = boardView.isGameOver()
    const wasGameOver = wasGameOverRef.current

    if (history.length > previousHistoryLength) {
      const latestMove = history[history.length - 1]
      const gaveCheck = boardView.isCheck()
      const castled = latestMove.flags.includes('k') || latestMove.flags.includes('q')
      const captured = Boolean(latestMove.captured)
      const justFinished = !wasGameOver && gameOverNow

      if (justFinished) {
        playAudio(soundRefs.current.end)
      } else if (castled) {
        playAudio(soundRefs.current.castle)
      } else if (captured) {
        playAudio(soundRefs.current.capture)
      } else if (gaveCheck) {
        playAudio(soundRefs.current.check)
      } else {
        playAudio(soundRefs.current.move)
      }

    }

    lastHistoryLengthRef.current = history.length
    wasGameOverRef.current = gameOverNow
  }, [boardView, chess, playAudio, position])

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

  useEffect(() => {
    if (promotionPending || activePremoves.length === 0) return
    if (turn !== playerColor) return
    if (chess.fen() !== position) return

    const [nextPremove, ...rest] = activePremoves
    let premoveMove: Move | null = null
    try {
      premoveMove = chess.move({
        from: nextPremove.from as Square,
        to: nextPremove.to as Square,
        promotion: nextPremove.promotion,
      })
    } catch {
      premoveMove = null
    }

    setPremoves(rest)
    if (premoveMove) {
      onPremoveExecute?.(nextPremove, premoveMove)
      onMove?.(premoveMove)
      emitPositionChange(premoveMove)
    } else {
      onPremoveReject?.(nextPremove)
    }
  }, [
    activePremoves,
    chess,
    emitPositionChange,
    onMove,
    onPremoveExecute,
    onPremoveReject,
    playerColor,
    position,
    promotionPending,
    setPremoves,
    turn,
  ])

  useEffect(() => {
    setSelectedSquare(null)
    setLegalMoves([])
    setPromotionPending(null)
  }, [position])

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

      const livePath = buildArrowPath(
        drawingArrow.from,
        toSquare,
        isFlipped,
        squareSize,
        squareSize / 3.5,
      )
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
    if (boardView.isCheckmate()) return `Checkmate! ${boardView.turn() === 'w' ? 'Black' : 'White'} wins!`
    if (boardView.isDraw()) return 'Draw!'
    if (boardView.isStalemate()) return 'Stalemate!'
    if (boardView.isThreefoldRepetition()) return 'Draw by repetition!'
    if (boardView.isInsufficientMaterial()) return 'Draw by insufficient material!'
    if (boardView.isCheck()) return `${boardView.turn() === 'w' ? 'White' : 'Black'} is in check!`
    return `${boardView.turn() === 'w' ? 'White' : 'Black'} to move`
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
            premoves={activePremoves}
            boardTheme={mergedBoardTheme}
            draggingFrom={dragging?.from ?? null}
            onSquareMouseDown={handleMouseDown}
            onSquareClick={(square) => {
              if (!dragging) handleSquareClick(square)
            }}
          />

          <ArrowLayer
            arrows={activeArrows}
            drawingArrow={Boolean(drawingArrow)}
            boardSize={boardSize}
            squareSize={squareSize}
            isFlipped={isFlipped}
            liveArrowPathRef={liveArrowPathRef}
            defaultColor={mergedArrowStyle.color}
            defaultOpacity={mergedArrowStyle.opacity}
            defaultWidthScale={mergedArrowStyle.widthScale}
            liveArrowColor={mergedArrowStyle.liveColor}
            liveArrowOpacity={mergedArrowStyle.liveOpacity}
          />

          <PromotionDialog
            pending={promotionPending}
            turn={turn}
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
        onFlip={() => setBoardFlipped((prev) => !prev)}
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
})

ChessBoard.displayName = 'ChessBoard'

export default ChessBoard
