import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Color, Move, Square } from 'chess.js'
import moveSoundSrc from '../assets/move.mp3'
import captureSoundSrc from '../assets/capture.mp3'
import castleSoundSrc from '../assets/castle.mp3'
import checkSoundSrc from '../assets/check.mp3'
import endSoundSrc from '../assets/end.mp3'
import {
  boardFromFen,
  getSquareName,
  getLegalMoves,
  getRelaxedPremoveTargets,
  needsPromotion,
} from '../utils/chessUtils'
import { buildArrowShape } from '../utils/arrowUtils'
import { PieceComponents } from './ChessPieces'
import { BoardGrid } from './chessboard/BoardGrid'
import { ArrowLayer } from './chessboard/ArrowLayer'
import { PromotionDialog } from './chessboard/PromotionDialog'
import { CapturedPiecesRow } from './chessboard/CapturedPiecesRow'
import { BOARD_THEME_PRESETS } from './chessboard/types'
import type {
  Arrow,
  ArrowCommitAction,
  ArrowCommitEvent,
  ArrowStyleOptions,
  BoardThemeColors,
  BoardThemePreset,
  DragState,
  LastMoveState,
  LiveArrow,
  PremoveState,
  PromotionPendingState,
} from './chessboard/types'

export type { BoardThemeColors, BoardThemePreset } from './chessboard/types'
export { BOARD_THEME_PRESETS } from './chessboard/types'
export type ChessBoardMode = 'play' | 'analysis'
export type ChessBoardExplorerMode = 'off' | 'normal' | 'god'
type PromotionPiece = 'q' | 'r' | 'b' | 'n'
export type MoveBadgeKind =
  | 'blunder'
  | 'mistake'
  | 'inaccuracy'
  | 'miss'
  | 'good'
  | 'excellent'
  | 'best'
  | 'brilliant'
  | 'book'
  | 'onlyMove'

export interface MoveBadge {
  kind: MoveBadgeKind
  label?: string
  src?: string
}

export interface MoveBadgeByPly {
  ply: number
  badge: MoveBadge
}

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
  lastMoveBadge?: MoveBadge | null
  moveBadges?: MoveBadgeByPly[]
  onPremoveAdd?: (premove: PremoveState) => void
  onPremoveExecute?: (premove: PremoveState, move: Move) => void
  onPremoveReject?: (premove: PremoveState) => void
  canQueuePremove?: (args: PremoveValidationArgs) => boolean
  premoves?: PremoveState[]
  onPremovesChange?: (premoves: PremoveState[]) => void
  overlayArrows?: Arrow[]
  arrows?: Arrow[]
  defaultArrows?: Arrow[]
  onArrowsChange?: (arrows: Arrow[]) => void
  onArrowCommit?: (event: ArrowCommitEvent) => void
  onLiveArrowChange?: (arrow: LiveArrow | null) => void
  customArrows?: Arrow[]
  onCustomArrowsChange?: (arrows: Arrow[]) => void
  arrowStyle?: ArrowStyleOptions
  overlayArrowStyle?: ArrowStyleOptions
  liveArrowStyle?: ArrowStyleOptions
  capturedWhitePieces?: string[]
  capturedBlackPieces?: string[]
  mode?: ChessBoardMode
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
  boardSize?: number
  onBoardSizeChange?: (boardSize: number, squareSize: number) => void
  resizable?: boolean
  squareSize?: number
  minSize?: number
  maxSize?: number
  fillContainer?: boolean
  showLegalMoves?: boolean
  showStatusBar?: boolean
  showCapturedPieces?: boolean
  className?: string
  explorerMode?: ChessBoardExplorerMode
}

export interface ChessBoardHandle {
  flipBoard: () => void
  setFlipped: (flipped: boolean) => void
  isFlipped: () => boolean
  goToPreviousMove: () => boolean
  goToNextMove: () => boolean
  canGoToPreviousMove: () => boolean
  canGoToNextMove: () => boolean
  setPositionFromFen: (fen: string) => boolean
  resetToInitialFen: () => boolean
}

const DEFAULT_POSITION = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'
const DEFAULT_ARROW_STYLE: Required<ArrowStyleOptions> = {
  color: '#15781B',
  opacity: 0.6,
  widthScale: 1 / 5,
  liveColor: '#15781B',
  liveOpacity: 0.6,
}
const DEFAULT_OVERLAY_ARROW_STYLE = {
  color: '#2563eb',
  opacity: 0.56,
  widthScale: 1 / 5,
}
const DEFAULT_SOUND_SRCS = {
  move: moveSoundSrc,
  capture: captureSoundSrc,
  castle: castleSoundSrc,
  check: checkSoundSrc,
  end: endSoundSrc,
}

const useSafeLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function clampBoardSize(size: number, minSquareSize: number, maxSquareSize: number) {
  const minBoardSize = Math.max(minSquareSize, 1) * 8
  const maxBoardSize = (Number.isFinite(maxSquareSize) ? maxSquareSize : Number.POSITIVE_INFINITY) * 8
  return Math.max(minBoardSize, Math.min(maxBoardSize, size))
}

function areLiveArrowsEqual(left: LiveArrow | null, right: LiveArrow | null) {
  return left?.from === right?.from && left?.to === right?.to
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

function getPieceColor(piece?: string): Color | null {
  if (!piece) return null
  const color = piece[0]
  return color === 'w' || color === 'b' ? color : null
}

function createGameWithTurn(fen: string, turn: Color): Chess | null {
  try {
    return new Chess(withTurn(fen, turn), { skipValidation: true })
  } catch {
    return null
  }
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

function piecesFromGame(activeGame: Chess): Record<string, string> {
  const board = activeGame.board()
  const nextPieces: Record<string, string> = {}

  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col]
      if (!piece) continue
      const file = String.fromCharCode(97 + col)
      const rank = 8 - row
      nextPieces[`${file}${rank}`] = `${piece.color}${piece.type.toUpperCase()}`
    }
  }

  return nextPieces
}

const ChessBoard = React.forwardRef<ChessBoardHandle, ChessBoardProps>(({
  chess,
  position,
  onPositionChange,
  onMove,
  lastMoveBadge,
  moveBadges,
  onPremoveAdd,
  onPremoveExecute,
  onPremoveReject,
  canQueuePremove,
  premoves,
  onPremovesChange,
  overlayArrows = [],
  arrows,
  defaultArrows,
  onArrowsChange,
  onArrowCommit,
  onLiveArrowChange,
  customArrows,
  onCustomArrowsChange,
  arrowStyle,
  overlayArrowStyle,
  liveArrowStyle,
  capturedWhitePieces,
  capturedBlackPieces,
  mode = 'play',
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
  boardSize: controlledBoardSize,
  onBoardSizeChange,
  resizable = false,
  squareSize: fixedSquareSize,
  minSize = 40,
  maxSize = Number.POSITIVE_INFINITY,
  fillContainer = false,
  showLegalMoves = true,
  showStatusBar = false,
  showCapturedPieces = false,
  className,
  explorerMode = 'off',
}, ref) => {
  const boardView = useMemo(() => new Chess(position), [position])
  const pieces = useMemo(() => piecesFromGame(boardView), [boardView])
  const mergedArrowStyle = useMemo(
    () => ({ ...DEFAULT_ARROW_STYLE, ...arrowStyle }),
    [arrowStyle],
  )
  const mergedOverlayArrowStyle = useMemo(
    () => ({
      ...DEFAULT_OVERLAY_ARROW_STYLE,
      ...overlayArrowStyle,
    }),
    [overlayArrowStyle],
  )
  const mergedLiveArrowStyle = useMemo(
    () => ({
      color: liveArrowStyle?.color ?? mergedArrowStyle.liveColor,
      opacity: liveArrowStyle?.opacity ?? mergedArrowStyle.liveOpacity,
      widthScale: liveArrowStyle?.widthScale ?? mergedArrowStyle.widthScale,
    }),
    [
      liveArrowStyle?.color,
      liveArrowStyle?.opacity,
      liveArrowStyle?.widthScale,
      mergedArrowStyle.liveColor,
      mergedArrowStyle.liveOpacity,
      mergedArrowStyle.widthScale,
    ],
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
  const [containerWidth, setContainerWidth] = useState(
    fixedSquareSize ? fixedSquareSize * 8 : Math.max(minSize * 8, 320),
  )
  const [userBoardSize, setUserBoardSize] = useState<number | null>(null)
  const [isTouchDragPending, setIsTouchDragPending] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const [internalArrows, setInternalArrows] = useState<Arrow[]>(() => defaultArrows ?? [])
  const [internalPremoves, setInternalPremoves] = useState<PremoveState[]>([])

  const rootRef = useRef<HTMLDivElement>(null)
  const boardRef = useRef<HTMLDivElement>(null)
  const dragPointerRef = useRef({ x: 0, y: 0 })
  const drawPointerRef = useRef({ x: 0, y: 0 })
  const boardRectRef = useRef<DOMRect | null>(null)
  const dragGhostRef = useRef<HTMLDivElement>(null)
  const liveArrowPathRef = useRef<SVGPathElement>(null)
  const liveArrowHeadRef = useRef<SVGPolygonElement>(null)
  const currentLiveArrowRef = useRef<LiveArrow | null>(null)
  const rafRef = useRef<number | null>(null)
  const resizeRafRef = useRef<number | null>(null)
  const pendingTouchDragRef = useRef<{ pointerId: number; from: string; piece: string; startX: number; startY: number; active: boolean } | null>(null)
  const resizeDragRef = useRef<{ startX: number; startY: number; startSize: number } | null>(null)
  const pendingResizeSizeRef = useRef<number | null>(null)
  const suppressBoardClickUntilRef = useRef(0)
  const redoStackRef = useRef<Move[]>([])
  const internalMutationRef = useRef<'move' | 'prev' | 'next' | 'load' | null>(null)
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

  const boardSize = useMemo(() => {
    const requestedSize = controlledBoardSize ?? userBoardSize ?? (fixedSquareSize && fixedSquareSize > 0
      ? fixedSquareSize * 8
      : containerWidth)
    return clampBoardSize(requestedSize, minSize, maxSize)
  }, [containerWidth, controlledBoardSize, fixedSquareSize, maxSize, minSize, userBoardSize])
  const squareSize = boardSize / 8
  const visibleLegalMoves = useMemo(() => (showLegalMoves ? legalMoves : []), [legalMoves, showLegalMoves])
  const verboseHistory = useMemo(() => chess.history({ verbose: true }), [chess, position])
  const turn = boardView.turn()
  const isExplorerEnabled = explorerMode !== 'off'
  const isGodExplorerMode = explorerMode === 'god'
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

  const activeUserArrows = arrows ?? customArrows ?? internalArrows
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
    if (isExplorerEnabled || turn === playerColor) return pieces[square]
    return premovePreview.previewPieces[square]
  }, [isExplorerEnabled, pieces, playerColor, premovePreview.previewPieces, turn])

  const canControlPiece = useCallback((piece?: string) => {
    const pieceColor = getPieceColor(piece)
    if (!pieceColor) return false
    if (explorerMode === 'god') return true
    if (explorerMode === 'normal') return pieceColor === turn
    return pieceColor === playerColor
  }, [explorerMode, playerColor, turn])

  const getPlayableGame = useCallback((moveColor: Color) => {
    if (!isGodExplorerMode || moveColor === turn) return boardView
    return createGameWithTurn(position, moveColor)
  }, [boardView, isGodExplorerMode, position, turn])

  const currentMoveBadge = useMemo(() => {
    if (lastMoveBadge !== undefined) return lastMoveBadge
    const currentPly = verboseHistory.length
    return moveBadges?.find((item) => item.ply === currentPly)?.badge ?? null
  }, [lastMoveBadge, moveBadges, verboseHistory.length])

  const emitLiveArrow = useCallback((next: LiveArrow | null) => {
    if (areLiveArrowsEqual(currentLiveArrowRef.current, next)) return
    currentLiveArrowRef.current = next
    onLiveArrowChange?.(next)
  }, [onLiveArrowChange])

  const commitUserArrows = useCallback((
    next: Arrow[] | ((prev: Arrow[]) => Arrow[]),
    commit?: { action: ArrowCommitAction; arrow?: Arrow },
  ) => {
    const previousArrows = activeUserArrows
    const resolved = typeof next === 'function' ? next(previousArrows) : next
    if (arrows === undefined && customArrows === undefined) {
      setInternalArrows(resolved)
    }
    onArrowsChange?.(resolved)
    onCustomArrowsChange?.(resolved)
    if (commit) {
      onArrowCommit?.({
        ...commit,
        previousArrows,
        nextArrows: resolved,
      })
    }
  }, [
    activeUserArrows,
    arrows,
    customArrows,
    onArrowCommit,
    onArrowsChange,
    onCustomArrowsChange,
  ])

  const clearUserArrows = useCallback(() => {
    commitUserArrows([], { action: 'clear' })
  }, [commitUserArrows])

  const toggleUserArrow = useCallback((from: string, to: string) => {
    const existing = activeUserArrows.findIndex(
      (arrow) => arrow.from === from && arrow.to === to,
    )

    if (existing >= 0) {
      const arrow = activeUserArrows[existing]
      commitUserArrows(
        activeUserArrows.filter((_, index) => index !== existing),
        { action: 'remove', arrow },
      )
      return
    }

    const arrow: Arrow = {
      from,
      to,
      color: mergedArrowStyle.color,
      opacity: mergedArrowStyle.opacity,
      widthScale: mergedArrowStyle.widthScale,
    }
    commitUserArrows([...activeUserArrows, arrow], { action: 'add', arrow })
  }, [
    activeUserArrows,
    commitUserArrows,
    mergedArrowStyle.color,
    mergedArrowStyle.opacity,
    mergedArrowStyle.widthScale,
  ])

  const setPremoves = useCallback((next: PremoveState[] | ((prev: PremoveState[]) => PremoveState[])) => {
    const resolved = typeof next === 'function' ? next(activePremoves) : next
    if (premoves === undefined) {
      setInternalPremoves(resolved)
    }
    onPremovesChange?.(resolved)
  }, [activePremoves, premoves, onPremovesChange])

  const commitBoardSize = useCallback((nextSize: number) => {
    const clampedSize = Math.round(clampBoardSize(nextSize, minSize, maxSize))
    pendingResizeSizeRef.current = clampedSize
    if (resizeRafRef.current !== null) return

    resizeRafRef.current = window.requestAnimationFrame(() => {
      resizeRafRef.current = null
      const pendingSize = pendingResizeSizeRef.current
      pendingResizeSizeRef.current = null
      if (pendingSize === null) return
      if (controlledBoardSize === undefined) {
        setUserBoardSize(pendingSize)
      }
      onBoardSizeChange?.(pendingSize, pendingSize / 8)
    })
  }, [controlledBoardSize, maxSize, minSize, onBoardSizeChange])

  const lastMove = useMemo<LastMoveState | null>(() => {
    const last = verboseHistory[verboseHistory.length - 1]
    return last ? { from: last.from, to: last.to } : null
  }, [verboseHistory])

  const { capturedWhite: calculatedCapturedWhite, capturedBlack: calculatedCapturedBlack } = useMemo(() => {
    if (!showCapturedPieces) {
      return { capturedWhite: [], capturedBlack: [] }
    }

    const white: string[] = []
    const black: string[] = []
    for (const move of verboseHistory) {
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
  }, [showCapturedPieces, verboseHistory])

  const capturedWhite = showCapturedPieces ? capturedWhitePieces ?? calculatedCapturedWhite : []
  const capturedBlack = showCapturedPieces ? capturedBlackPieces ?? calculatedCapturedBlack : []

  const emitPositionChange = useCallback((move?: Move) => {
    onPositionChange?.(chess.fen(), move)
  }, [chess, onPositionChange])

  const executeMove = useCallback((from: string, to: string, promotion?: PromotionPiece, moveColor?: Color) => {
    if (chess.fen() !== position) return null
    const resolvedMoveColor = moveColor ?? getPieceColor(pieces[from]) ?? turn
    const isOffTurnExplorerMove = isGodExplorerMode && resolvedMoveColor !== turn
    const moveGame = isOffTurnExplorerMove ? createGameWithTurn(position, resolvedMoveColor) : chess
    if (!moveGame) return null

    try {
      const move = moveGame.move({
        from: from as Square,
        to: to as Square,
        promotion,
      })
      if (!move) return null
      if (isOffTurnExplorerMove) {
        chess.load(moveGame.fen())
      }
      setSelectedSquare(null)
      setLegalMoves([])
      setPromotionPending(null)
      clearUserArrows()
      redoStackRef.current = []
      internalMutationRef.current = 'move'
      onMove?.(move)
      emitPositionChange(move)
      return move
    } catch {
      return null
    }
  }, [chess, clearUserArrows, emitPositionChange, isGodExplorerMode, onMove, pieces, position, turn])

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

  const needsPlayablePromotion = useCallback((from: string, to: string, moveColor: Color) => {
    const playableGame = getPlayableGame(moveColor)
    if (!playableGame) return false
    try {
      return needsPromotion(playableGame, from, to)
    } catch {
      return false
    }
  }, [getPlayableGame])

  const queuePremove = useCallback((from: string, to: string, promotion?: PromotionPiece) => {
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
    const planningPieces = isExplorerEnabled || turn === playerColor ? pieces : premovePreview.previewPieces
    const piece = planningPieces[square]
    const pieceColor = getPieceColor(piece)
    if (!pieceColor) return []

    if (explorerMode === 'god') {
      const playableGame = getPlayableGame(pieceColor)
      return playableGame ? getLegalMoves(playableGame, square).map((move) => move.to) : []
    }

    if (explorerMode === 'normal') {
      if (pieceColor !== turn) return []
      return getLegalMoves(boardView, square).map((move) => move.to)
    }

    if (pieceColor !== playerColor) return []
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
  }, [
    boardView,
    explorerMode,
    getPlayableGame,
    isExplorerEnabled,
    pieces,
    playerColor,
    premovePreview.previewCastlingRights,
    premovePreview.previewFen,
    premovePreview.previewPieces,
    relaxedPremoveMode,
    turn,
  ])

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
      const selectedPieceColor = getPieceColor(selectedPiece)
      if (!selectedPieceColor || !canControlPiece(selectedPiece)) {
        setSelectedSquare(null)
        setLegalMoves([])
        return
      }

      const shouldExecuteMove = isExplorerEnabled || turn === playerColor
      if (shouldExecuteMove) {
        if (needsPlayablePromotion(selectedSquare, square, selectedPieceColor)) {
          setPromotionPending({ from: selectedSquare, to: square })
          return
        }
      } else if (needsPremovePromotion(selectedSquare, square)) {
        setPromotionPending({ from: selectedSquare, to: square })
        return
      }

      const actionSuccessful = shouldExecuteMove
        ? Boolean(executeMove(selectedSquare, square, undefined, selectedPieceColor))
        : queuePremove(selectedSquare, square)
      if (actionSuccessful) return

      if (canControlPiece(piece)) {
        setSelectedSquare(square)
        setLegalMoves(getSelectableMoves(square))
      } else {
        setSelectedSquare(null)
        setLegalMoves([])
      }
      return
    }

    if (canControlPiece(piece)) {
      setSelectedSquare(square)
      setLegalMoves(getSelectableMoves(square))
      return
    }

    setSelectedSquare(null)
    setLegalMoves([])
  }, [
    canControlPiece,
    executeMove,
    getPlanningPiece,
    getSelectableMoves,
    isExplorerEnabled,
    needsPlayablePromotion,
    needsPremovePromotion,
    promotionPending,
    queuePremove,
    selectedSquare,
    turn,
  ])

  const handlePromotion = useCallback((promotionPiece: string) => {
    if (!promotionPending) return
    const promotion = promotionPiece as PromotionPiece
    const pendingPieceColor = getPieceColor(getPlanningPiece(promotionPending.from))
    if (isExplorerEnabled && pendingPieceColor) {
      executeMove(promotionPending.from, promotionPending.to, promotion, pendingPieceColor)
    } else if (turn === playerColor) {
      executeMove(promotionPending.from, promotionPending.to, promotion)
    } else {
      queuePremove(promotionPending.from, promotionPending.to, promotion)
    }
    setPromotionPending(null)
  }, [executeMove, getPlanningPiece, isExplorerEnabled, playerColor, promotionPending, queuePremove, turn])

  const startPieceDrag = useCallback((piece: string, from: string, clientX: number, clientY: number) => {
    setSelectedSquare(from)
    setLegalMoves(getSelectableMoves(from))
    clearUserArrows()
    dragPointerRef.current = { x: clientX, y: clientY }
    setDragging({ piece, from })
    scheduleOverlayFrame()
  }, [clearUserArrows, getSelectableMoves])

  const dropPiece = useCallback((dragState: DragState, clientX: number, clientY: number) => {
    const rect = boardRef.current?.getBoundingClientRect()
    if (rect) {
      const col = Math.floor((clientX - rect.left) / squareSize)
      const row = Math.floor((clientY - rect.top) / squareSize)
      if (col >= 0 && col < 8 && row >= 0 && row < 8) {
        const toSquare = getSquareName(col, row, isFlipped)
        if (dragState.from !== toSquare) {
          const dragPieceColor = getPieceColor(dragState.piece)
          if (!dragPieceColor) {
            setDragging(null)
            return
          }
          // Browsers dispatch a click after pointerup. Ignore that click so a
          // completed drag does not immediately select the piece again.
          suppressBoardClickUntilRef.current = performance.now() + 250
          if (isExplorerEnabled || turn === playerColor) {
            if (needsPlayablePromotion(dragState.from, toSquare, dragPieceColor)) {
              setPromotionPending({ from: dragState.from, to: toSquare })
              setDragging(null)
              return
            }
            executeMove(dragState.from, toSquare, undefined, dragPieceColor)
          } else {
            if (needsPremovePromotion(dragState.from, toSquare)) {
              setPromotionPending({ from: dragState.from, to: toSquare })
              setDragging(null)
              return
            }
            queuePremove(dragState.from, toSquare)
          }
        }
      }
    }
    setDragging(null)
  }, [
    executeMove,
    isExplorerEnabled,
    isFlipped,
    needsPlayablePromotion,
    needsPremovePromotion,
    playerColor,
    queuePremove,
    squareSize,
    turn,
  ])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>, square: string) => {
    if (e.pointerType === 'mouse' && e.button === 2) {
      e.preventDefault()
      drawPointerRef.current = { x: e.clientX, y: e.clientY }
      boardRectRef.current = boardRef.current?.getBoundingClientRect() ?? null
      setDrawingArrow({ from: square })
      emitLiveArrow({ from: square })
      scheduleOverlayFrame()
      return
    }

    if (e.button !== 0 || promotionPending) return
    const piece = getPlanningPiece(square)
    if (!canControlPiece(piece)) return

    if (e.pointerType === 'mouse') {
      e.preventDefault()
      startPieceDrag(piece, square, e.clientX, e.clientY)
      return
    }

    pendingTouchDragRef.current = {
      pointerId: e.pointerId,
      from: square,
      piece,
      startX: e.clientX,
      startY: e.clientY,
      active: false,
    }
    dragPointerRef.current = { x: e.clientX, y: e.clientY }
    setIsTouchDragPending(true)
  }, [canControlPiece, emitLiveArrow, getPlanningPiece, promotionPending, startPieceDrag])

  const handlePointerMove = useCallback((e: PointerEvent) => {
    const pendingTouchDrag = pendingTouchDragRef.current
    if (pendingTouchDrag && pendingTouchDrag.pointerId === e.pointerId) {
      dragPointerRef.current = { x: e.clientX, y: e.clientY }
      const moved = Math.hypot(e.clientX - pendingTouchDrag.startX, e.clientY - pendingTouchDrag.startY)
      if (!pendingTouchDrag.active && moved >= 6) {
        pendingTouchDrag.active = true
        startPieceDrag(pendingTouchDrag.piece, pendingTouchDrag.from, e.clientX, e.clientY)
      }
      if (pendingTouchDrag.active) {
        e.preventDefault()
        scheduleOverlayFrame()
      }
      return
    }

    if (!dragging && !drawingArrow) return
    if (dragging) dragPointerRef.current = { x: e.clientX, y: e.clientY }
    if (drawingArrow) drawPointerRef.current = { x: e.clientX, y: e.clientY }
    if (dragging || drawingArrow) scheduleOverlayFrame()
  }, [dragging, drawingArrow, startPieceDrag])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (drawingArrow && e.pointerType === 'mouse' && e.button === 2) {
      const rect = boardRectRef.current ?? boardRef.current?.getBoundingClientRect()
      if (rect) {
        const col = Math.floor((e.clientX - rect.left) / squareSize)
        const row = Math.floor((e.clientY - rect.top) / squareSize)
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
          const toSquare = getSquareName(col, row, isFlipped)
          if (drawingArrow.from !== toSquare) {
            toggleUserArrow(drawingArrow.from, toSquare)
          } else {
            if (activePremoves.length > 0) setPremoves([])
            clearUserArrows()
          }
        }
      }
      setDrawingArrow(null)
      emitLiveArrow(null)
      if (liveArrowPathRef.current) liveArrowPathRef.current.setAttribute('d', '')
      if (liveArrowHeadRef.current) liveArrowHeadRef.current.setAttribute('points', '')
      boardRectRef.current = null
      return
    }

    const pendingTouchDrag = pendingTouchDragRef.current
    if (pendingTouchDrag && pendingTouchDrag.pointerId === e.pointerId) {
      pendingTouchDragRef.current = null
      setIsTouchDragPending(false)
      if (pendingTouchDrag.active) {
        dropPiece({ piece: pendingTouchDrag.piece, from: pendingTouchDrag.from }, e.clientX, e.clientY)
      }
      return
    }

    if (!dragging) return
    dropPiece(dragging, e.clientX, e.clientY)
  }, [
    activePremoves.length,
    clearUserArrows,
    dragging,
    drawingArrow,
    dropPiece,
    emitLiveArrow,
    setPremoves,
    squareSize,
    toggleUserArrow,
  ])

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  const handleResizePointerDown = useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!resizable || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.setPointerCapture(e.pointerId)
    resizeDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startSize: boardSize,
    }
    setIsResizing(true)
  }, [boardSize, resizable])

  const handleResizePointerMove = useCallback((e: PointerEvent) => {
    if (!resizeDragRef.current) return
    const { startX, startY, startSize } = resizeDragRef.current
    const deltaX = e.clientX - startX
    const deltaY = e.clientY - startY
    const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY
    commitBoardSize(startSize + delta)
  }, [commitBoardSize])

  const handleResizePointerUp = useCallback(() => {
    resizeDragRef.current = null
    setIsResizing(false)
  }, [])

  const loadFen = useCallback((fen: string) => {
    try {
      chess.load(fen)
      setSelectedSquare(null)
      setLegalMoves([])
      setDrawingArrow(null)
      setPromotionPending(null)
      setDragging(null)
      emitLiveArrow(null)
      clearUserArrows()
      setPremoves([])
      redoStackRef.current = []
      internalMutationRef.current = 'load'
      emitPositionChange()
      return true
    } catch {
      return false
    }
  }, [chess, clearUserArrows, emitLiveArrow, emitPositionChange, setPremoves])

  const goToPreviousMove = useCallback(() => {
    if (chess.fen() !== position) return false
    const undone = chess.undo()
    if (!undone) return false
    redoStackRef.current.push(undone)
    setSelectedSquare(null)
    setLegalMoves([])
    setPromotionPending(null)
    setPremoves([])
    internalMutationRef.current = 'prev'
    emitPositionChange()
    return true
  }, [chess, emitPositionChange, position, setPremoves])

  const goToNextMove = useCallback(() => {
    if (chess.fen() !== position) return false
    const next = redoStackRef.current.pop()
    if (!next) return false
    try {
      const replayed = chess.move({
        from: next.from,
        to: next.to,
        promotion: next.promotion,
      })
      if (!replayed) {
        redoStackRef.current.push(next)
        return false
      }
      setSelectedSquare(null)
      setLegalMoves([])
      setPromotionPending(null)
      setPremoves([])
      internalMutationRef.current = 'next'
      emitPositionChange(replayed)
      return true
    } catch {
      redoStackRef.current.push(next)
      return false
    }
  }, [chess, emitPositionChange, position, setPremoves])

  useEffect(() => {
    setIsFlipped(flipped)
  }, [flipped])

  useImperativeHandle(ref, () => ({
    flipBoard: () => setBoardFlipped((prev) => !prev),
    setFlipped: (nextFlipped: boolean) => setBoardFlipped(nextFlipped),
    isFlipped: () => isFlipped,
    goToPreviousMove,
    goToNextMove,
    canGoToPreviousMove: () => chess.fen() === position && verboseHistory.length > 0,
    canGoToNextMove: () => redoStackRef.current.length > 0,
    setPositionFromFen: (fen: string) => loadFen(fen),
    resetToInitialFen: () => loadFen(initialFen),
  }), [chess, goToNextMove, goToPreviousMove, initialFen, isFlipped, loadFen, position, setBoardFlipped, verboseHistory.length])

  useEffect(() => {
    if (!dragging && !drawingArrow && !isTouchDragPending) return

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [dragging, drawingArrow, handlePointerMove, handlePointerUp, isTouchDragPending])

  useEffect(() => {
    if (!isResizing) return
    window.addEventListener('pointermove', handleResizePointerMove)
    window.addEventListener('pointerup', handleResizePointerUp)
    window.addEventListener('pointercancel', handleResizePointerUp)
    return () => {
      window.removeEventListener('pointermove', handleResizePointerMove)
      window.removeEventListener('pointerup', handleResizePointerUp)
      window.removeEventListener('pointercancel', handleResizePointerUp)
    }
  }, [handleResizePointerMove, handleResizePointerUp, isResizing])

  useEffect(() => {
    if (!fillContainer || (fixedSquareSize && fixedSquareSize > 0)) return
    const node = rootRef.current
    if (!node) return

    const applyWidth = (nextWidth: number) => {
      if (Number.isFinite(nextWidth) && nextWidth > 0) {
        setContainerWidth(nextWidth)
      }
    }

    applyWidth(node.clientWidth)

    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      applyWidth(entry.contentRect.width)
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [fillContainer, fixedSquareSize])

  useEffect(() => {
    if (!internalMutationRef.current) {
      redoStackRef.current = []
    }
    internalMutationRef.current = null
  }, [position])

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
    const previousHistoryLength = lastHistoryLengthRef.current
    const gameOverNow = boardView.isGameOver()
    const wasGameOver = wasGameOverRef.current

    if (verboseHistory.length > previousHistoryLength) {
      const latestMove = verboseHistory[verboseHistory.length - 1]
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

    lastHistoryLengthRef.current = verboseHistory.length
    wasGameOverRef.current = gameOverNow
  }, [boardView, playAudio, verboseHistory])

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
      if (resizeRafRef.current !== null) {
        window.cancelAnimationFrame(resizeRafRef.current)
      }
    }
  }, [])

  useSafeLayoutEffect(() => {
    if (isExplorerEnabled) return
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
      redoStackRef.current = []
      internalMutationRef.current = 'move'
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
    isExplorerEnabled,
    onMove,
    onPremoveExecute,
    onPremoveReject,
    playerColor,
    position,
    promotionPending,
    setPremoves,
    turn,
  ])

  useSafeLayoutEffect(() => {
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
        if (liveArrowHeadRef.current) liveArrowHeadRef.current.setAttribute('points', '')
        emitLiveArrow({ from: drawingArrow.from })
        return
      }

      boardRectRef.current = rect
      const col = Math.floor((drawPointerRef.current.x - rect.left) / squareSize)
      const row = Math.floor((drawPointerRef.current.y - rect.top) / squareSize)
      if (col < 0 || col > 7 || row < 0 || row > 7) {
        liveArrowPathRef.current.setAttribute('d', '')
        if (liveArrowHeadRef.current) liveArrowHeadRef.current.setAttribute('points', '')
        emitLiveArrow({ from: drawingArrow.from })
        return
      }

      const toSquare = getSquareName(col, row, isFlipped)
      if (toSquare === drawingArrow.from) {
        liveArrowPathRef.current.setAttribute('d', '')
        if (liveArrowHeadRef.current) liveArrowHeadRef.current.setAttribute('points', '')
        emitLiveArrow({ from: drawingArrow.from })
        return
      }

      const liveShape = buildArrowShape(
        drawingArrow.from,
        toSquare,
        isFlipped,
        squareSize,
        squareSize / 3.2,
      )
      liveArrowPathRef.current.setAttribute('d', liveShape?.shaftD ?? '')
      if (liveArrowHeadRef.current) {
        liveArrowHeadRef.current.setAttribute('points', liveShape?.headPoints ?? '')
      }
      emitLiveArrow({ from: drawingArrow.from, to: toSquare })
    }
  }

  function scheduleOverlayFrame() {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      updateOverlayFrame()
    })
  }

  const renderedPieces = !isExplorerEnabled && activePremoves.length > 0 && turn !== playerColor
    ? premovePreview.previewPieces
    : pieces

  const promotionColor = useMemo<Color>(() => {
    if (!isExplorerEnabled || !promotionPending) return playerColor
    return getPieceColor(getPlanningPiece(promotionPending.from)) ?? playerColor
  }, [getPlanningPiece, isExplorerEnabled, playerColor, promotionPending])

  const handleBoardSquareClick = useCallback((square: string) => {
    if (performance.now() <= suppressBoardClickUntilRef.current) {
      suppressBoardClickUntilRef.current = 0
      return
    }
    if (!dragging) handleSquareClick(square)
  }, [dragging, handleSquareClick])

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
    if (boardView.isStalemate()) return 'Stalemate!'
    if (boardView.isThreefoldRepetition()) return 'Draw by repetition!'
    if (boardView.isInsufficientMaterial()) return 'Draw by insufficient material!'
    if (boardView.isDraw()) return 'Draw!'
    if (boardView.isCheck()) return `${boardView.turn() === 'w' ? 'White' : 'Black'} is in check!`
    return `${boardView.turn() === 'w' ? 'White' : 'Black'} to move`
  }

  return (
    <div ref={rootRef} className={className ?? 'w-full'}>
      <div className="flex flex-col gap-2">
        {showStatusBar && (
          <div className="text-sm text-gray-400 bg-white/[0.06] px-3 py-1.5 rounded-lg inline-flex w-fit">
            <span className="font-semibold text-gray-300">{mode === 'analysis' ? 'Analysis' : 'Play'}</span>
            <span>&nbsp;• {getStatus()}</span>
          </div>
        )}
        {showCapturedPieces && (
          <CapturedPiecesRow
            capturedPieces={isFlipped ? capturedWhite : capturedBlack}
            label={isFlipped ? 'White captured:' : 'Black captured:'}
          />
        )}
        <div
          ref={boardRef}
          className={`grid grid-cols-[repeat(8,1fr)] grid-rows-[repeat(8,1fr)] border-[3px] border-[#3a3a5c] rounded relative shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)] select-none touch-none ${isResizing ? 'cursor-nwse-resize' : ''}`}
          style={{ width: boardSize, height: boardSize }}
          onContextMenu={handleContextMenu}
        >
          <BoardGrid
            pieces={renderedPieces}
            squareSize={squareSize}
            isFlipped={isFlipped}
            selectedSquare={selectedSquare}
            legalMoves={visibleLegalMoves}
            lastMove={lastMove}
            lastMoveBadge={currentMoveBadge}
            inCheck={inCheck}
            premoves={activePremoves}
            boardTheme={mergedBoardTheme}
            draggingFrom={dragging?.from ?? null}
            onSquarePointerDown={handlePointerDown}
            onSquareClick={handleBoardSquareClick}
          />

          <ArrowLayer
            arrows={activeUserArrows}
            overlayArrows={overlayArrows}
            drawingArrow={Boolean(drawingArrow)}
            boardSize={boardSize}
            squareSize={squareSize}
            isFlipped={isFlipped}
            liveArrowPathRef={liveArrowPathRef}
            liveArrowHeadRef={liveArrowHeadRef}
            defaultColor={mergedArrowStyle.color}
            defaultOpacity={mergedArrowStyle.opacity}
            defaultWidthScale={mergedArrowStyle.widthScale}
            overlayDefaultColor={mergedOverlayArrowStyle.color}
            overlayDefaultOpacity={mergedOverlayArrowStyle.opacity}
            overlayDefaultWidthScale={mergedOverlayArrowStyle.widthScale}
            liveArrowColor={mergedLiveArrowStyle.color}
            liveArrowOpacity={mergedLiveArrowStyle.opacity}
            liveArrowWidthScale={mergedLiveArrowStyle.widthScale}
          />

          <PromotionDialog
            pending={promotionPending}
            playerColor={promotionColor}
            squareSize={squareSize}
            boardSize={boardSize}
            isFlipped={isFlipped}
            onSelect={handlePromotion}
          />

          {resizable && (
            <button
              type="button"
              className="absolute -bottom-3 -right-3 z-20 h-7 w-7 touch-none rounded bg-zinc-800/95 border border-white/30 shadow-lg cursor-nwse-resize flex items-center justify-center hover:bg-zinc-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              aria-label="Resize board"
              title="Resize board"
              onPointerDown={handleResizePointerDown}
            >
              <span className="block h-3 w-3 border-r-2 border-b-2 border-white/80" />
            </button>
          )}
        </div>
        {showCapturedPieces && (
          <CapturedPiecesRow
            capturedPieces={isFlipped ? capturedBlack : capturedWhite}
            label={isFlipped ? 'Black captured:' : 'White captured:'}
          />
        )}
      </div>
      {renderDragPiece()}
    </div>
  )
})

ChessBoard.displayName = 'ChessBoard'

export default ChessBoard
