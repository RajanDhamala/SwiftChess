import React, { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Chess } from 'chess.js'
import type { Color, Move, Square } from 'chess.js'
import moveSoundSrc from '../assets/move.mp3?no-inline'
import captureSoundSrc from '../assets/capture.mp3?no-inline'
import castleSoundSrc from '../assets/castle.mp3?no-inline'
import checkSoundSrc from '../assets/check.mp3?no-inline'
import endSoundSrc from '../assets/end.mp3?no-inline'
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
interface BoardTimelineEntry {
  move: Move
  before: string
  after: string
}

interface BoardTimeline {
  chess: Chess
  entries: BoardTimelineEntry[]
  cursor: number
  usesSyntheticHistory: boolean
}

interface BoardHistorySnapshot {
  moves: Move[]
  sourceTimeline: BoardTimeline | null
  reconciliation?: BoardTimeline | null
}

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
  onPositionChange?: (fen: string, move: Move | undefined, history: readonly Move[]) => void
  onMove?: (move: Move, history: readonly Move[]) => void
  onHistoryChange?: (history: readonly Move[]) => void
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
  getHistory: () => Move[]
  getCurrentPly: () => number
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
const DEFAULT_CIRCLE_STYLE = {
  color: '#15781B',
  opacity: 0.6,
}
const DEFAULT_SOUND_SRCS = {
  move: moveSoundSrc,
  capture: captureSoundSrc,
  castle: castleSoundSrc,
  check: checkSoundSrc,
  end: endSoundSrc,
}
const EMPTY_ARROWS: Arrow[] = []
const BOARD_TIMELINES = new WeakMap<Chess, BoardTimeline>()

const useSafeLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

function useLatestRef<T>(value: T) {
  const valueRef = useRef(value)
  useSafeLayoutEffect(() => {
    valueRef.current = value
  }, [value])
  return valueRef
}

function useStableCallback<TArgs extends unknown[], TResult>(
  callback: (...args: TArgs) => TResult,
) {
  const callbackRef = useLatestRef(callback)
  return useCallback((...args: TArgs) => callbackRef.current(...args), [callbackRef])
}

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
  if (parts[1] !== turn) {
    // An en-passant target only belongs to the original side to move. Keeping
    // it while creating an off-turn planning board makes otherwise legal FENs
    // fail chess.js validation and can expose an impossible capture.
    parts[3] = '-'
  }
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

function getTimelineFen(timeline: BoardTimeline): string | null {
  if (timeline.cursor === 0) return timeline.entries[0]?.before ?? null
  return timeline.entries[timeline.cursor - 1]?.after ?? null
}

function getTimelineMoves(timeline: BoardTimeline): Move[] {
  return timeline.entries.slice(0, timeline.cursor).map((entry) => entry.move)
}

function createTimeline(
  chess: Chess,
  moves: Move[],
  usesSyntheticHistory: boolean,
): BoardTimeline {
  const entries = moves.map((move) => ({
    move,
    before: move.before,
    after: move.after,
  }))
  return { chess, entries, cursor: entries.length, usesSyntheticHistory }
}

function findTimelineCursor(timeline: BoardTimeline, fen: string): number | null {
  if (timeline.entries[0]?.before === fen) return 0
  for (let index = timeline.entries.length - 1; index >= 0; index -= 1) {
    if (timeline.entries[index].after === fen) return index + 1
  }
  return null
}

function reconcileBoardHistory(
  timeline: BoardTimeline,
  chessHistory: Move[],
  position: string,
): BoardHistorySnapshot {
  const knownCursor = findTimelineCursor(timeline, position)
  if (knownCursor === timeline.cursor) {
    return {
      moves: getTimelineMoves(timeline),
      sourceTimeline: timeline,
    }
  }

  if (
    knownCursor !== null
    && knownCursor > 0
    && timeline.usesSyntheticHistory
    && chessHistory.length === 0
  ) {
    const reconciledTimeline = { ...timeline, cursor: knownCursor }
    return {
      moves: getTimelineMoves(reconciledTimeline),
      sourceTimeline: timeline,
      reconciliation: reconciledTimeline,
    }
  }

  let bestBranch: { baseCursor: number; moves: Move[] } | null = null
  for (let startIndex = 0; startIndex < chessHistory.length; startIndex += 1) {
    const suffix = chessHistory.slice(startIndex)
    const baseCursor = findTimelineCursor(timeline, suffix[0].before)
    if (baseCursor === null || suffix[suffix.length - 1].after !== position) continue

    const isContiguous = suffix.every((move, index) => (
      index === 0 || suffix[index - 1].after === move.before
    ))
    if (!isContiguous) continue

    if (!bestBranch || baseCursor > bestBranch.baseCursor) {
      bestBranch = { baseCursor, moves: suffix }
    }
  }

  if (bestBranch) {
    const entries = [
      ...timeline.entries.slice(0, bestBranch.baseCursor),
      ...bestBranch.moves.map((move) => ({
        move,
        before: move.before,
        after: move.after,
      })),
    ]
    const reconciledTimeline = {
      chess: timeline.chess,
      entries,
      cursor: entries.length,
      usesSyntheticHistory: timeline.usesSyntheticHistory,
    }
    return {
      moves: getTimelineMoves(reconciledTimeline),
      sourceTimeline: timeline,
      reconciliation: reconciledTimeline,
    }
  }

  return {
    moves: chessHistory,
    sourceTimeline: timeline,
    reconciliation: null,
  }
}

export function getChessBoardHistory(chess: Chess): Move[] {
  const timeline = BOARD_TIMELINES.get(chess)
  if (timeline && getTimelineFen(timeline) === chess.fen()) {
    return getTimelineMoves(timeline)
  }
  const chessHistory = chess.history({ verbose: true })
  return timeline
    ? reconcileBoardHistory(timeline, chessHistory, chess.fen()).moves
    : chessHistory
}

const ChessBoard = React.forwardRef<ChessBoardHandle, ChessBoardProps>(({
  chess,
  position,
  onPositionChange,
  onMove,
  onHistoryChange,
  lastMoveBadge,
  moveBadges,
  onPremoveAdd,
  onPremoveExecute,
  onPremoveReject,
  canQueuePremove,
  premoves,
  onPremovesChange,
  overlayArrows = EMPTY_ARROWS,
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
    () => ({
      color: arrowStyle?.color ?? DEFAULT_ARROW_STYLE.color,
      opacity: arrowStyle?.opacity ?? DEFAULT_ARROW_STYLE.opacity,
      widthScale: arrowStyle?.widthScale ?? DEFAULT_ARROW_STYLE.widthScale,
      liveColor: arrowStyle?.liveColor ?? DEFAULT_ARROW_STYLE.liveColor,
      liveOpacity: arrowStyle?.liveOpacity ?? DEFAULT_ARROW_STYLE.liveOpacity,
    }),
    [
      arrowStyle?.color,
      arrowStyle?.liveColor,
      arrowStyle?.liveOpacity,
      arrowStyle?.opacity,
      arrowStyle?.widthScale,
    ],
  )
  const mergedOverlayArrowStyle = useMemo(
    () => ({
      color: overlayArrowStyle?.color ?? DEFAULT_OVERLAY_ARROW_STYLE.color,
      opacity: overlayArrowStyle?.opacity ?? DEFAULT_OVERLAY_ARROW_STYLE.opacity,
      widthScale: overlayArrowStyle?.widthScale ?? DEFAULT_OVERLAY_ARROW_STYLE.widthScale,
    }),
    [overlayArrowStyle?.color, overlayArrowStyle?.opacity, overlayArrowStyle?.widthScale],
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
    () => {
      const preset = BOARD_THEME_PRESETS[boardThemePreset] ?? BOARD_THEME_PRESETS.brownBoard
      return {
        light: boardTheme?.light ?? preset.light,
        dark: boardTheme?.dark ?? preset.dark,
      }
    },
    [boardTheme?.dark, boardTheme?.light, boardThemePreset],
  )
  const historySnapshot = useMemo<BoardHistorySnapshot>(() => {
    const timeline = BOARD_TIMELINES.get(chess) ?? null
    if (timeline && getTimelineFen(timeline) === position) {
      return { moves: getTimelineMoves(timeline), sourceTimeline: timeline }
    }

    const chessHistory = chess.history({ verbose: true })
    if (!timeline) {
      return {
        moves: chessHistory,
        sourceTimeline: null,
        reconciliation: chessHistory.length > 0
          ? createTimeline(chess, chessHistory, false)
          : undefined,
      }
    }
    return reconcileBoardHistory(timeline, chessHistory, position)
  }, [chess, position])
  const verboseHistory = historySnapshot.moves

  useSafeLayoutEffect(() => {
    if (historySnapshot.reconciliation === undefined) return
    if ((BOARD_TIMELINES.get(chess) ?? null) !== historySnapshot.sourceTimeline) return

    if (historySnapshot.reconciliation) {
      BOARD_TIMELINES.set(chess, historySnapshot.reconciliation)
    } else {
      BOARD_TIMELINES.delete(chess)
    }
  }, [chess, historySnapshot])

  const [selectedSquare, setSelectedSquare] = useState<string | null>(null)
  const [legalMoves, setLegalMoves] = useState<string[]>([])
  const [dragging, setDragging] = useState<DragState | null>(null)
  const [drawingArrow, setDrawingArrow] = useState<{ from: string } | null>(null)
  const [markedSquares, setMarkedSquares] = useState<string[]>([])
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
  const updateOverlayFrameRef = useRef<() => void>(() => {})
  const resizeRafRef = useRef<number | null>(null)
  const pendingTouchDragRef = useRef<{ pointerId: number; from: string; piece: string; startX: number; startY: number; active: boolean } | null>(null)
  const resizeDragRef = useRef<{ startX: number; startY: number; startSize: number } | null>(null)
  const pendingResizeSizeRef = useRef<number | null>(null)
  const suppressBoardClickUntilRef = useRef(0)
  const redoStackRef = useRef<Move[]>([])
  const internalMutationRef = useRef<'move' | 'prev' | 'next' | 'load' | null>(null)
  const lastHistoryLengthRef = useRef(verboseHistory.length)
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
  const onBoardSizeChangeRef = useLatestRef(onBoardSizeChange)
  const isBoardSizeControlled = controlledBoardSize !== undefined

  const boardSize = useMemo(() => {
    const requestedSize = controlledBoardSize ?? userBoardSize ?? (fixedSquareSize && fixedSquareSize > 0
      ? fixedSquareSize * 8
      : containerWidth)
    return clampBoardSize(requestedSize, minSize, maxSize)
  }, [containerWidth, controlledBoardSize, fixedSquareSize, maxSize, minSize, userBoardSize])
  const squareSize = boardSize / 8
  const visibleLegalMoves = useMemo(() => (showLegalMoves ? legalMoves : []), [legalMoves, showLegalMoves])
  const turn = boardView.turn()
  const isExplorerEnabled = explorerMode !== 'off'
  const isGodExplorerMode = explorerMode === 'god'
  const inCheck = useMemo(() => getCheckedKingSquare(boardView), [boardView])
  const castlingRights = useMemo(() => {
    const fenParts = position.trim().split(/\s+/)
    return fenParts[2] ?? '-'
  }, [position])

  const scheduleOverlayFrame = useCallback(() => {
    if (rafRef.current !== null) return
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null
      updateOverlayFrameRef.current()
    })
  }, [])

  const playAudio = useCallback((audio?: HTMLAudioElement) => {
    if (!enableSounds || !audio) return
    audio.currentTime = 0
    void audio.play().catch(() => { })
  }, [enableSounds])

  const activeUserArrows = arrows ?? customArrows ?? internalArrows
  const activePremoves = premoves ?? internalPremoves
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

  const updateOverlayFrame = useCallback(() => {
    if (dragging && dragGhostRef.current) {
      const dragX = dragPointerRef.current.x - squareSize / 2
      const dragY = dragPointerRef.current.y - squareSize / 2
      dragGhostRef.current.style.transform = `translate3d(${dragX}px, ${dragY}px, 0)`
    }

    if (drawingArrow && liveArrowPathRef.current) {
      const rect = boardRef.current?.getBoundingClientRect() ?? boardRectRef.current
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
  }, [dragging, drawingArrow, emitLiveArrow, isFlipped, squareSize])

  useSafeLayoutEffect(() => {
    updateOverlayFrameRef.current = updateOverlayFrame
  }, [updateOverlayFrame])

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
    if (activeUserArrows.length === 0) return
    commitUserArrows([], { action: 'clear' })
  }, [activeUserArrows.length, commitUserArrows])

  const clearUserAnnotations = useCallback(() => {
    clearUserArrows()
    setMarkedSquares((prev) => (prev.length === 0 ? prev : []))
  }, [clearUserArrows])

  const toggleMarkedSquare = useCallback((square: string) => {
    setMarkedSquares((prev) => (
      prev.includes(square)
        ? prev.filter((markedSquare) => markedSquare !== square)
        : [...prev, square]
    ))
  }, [])

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
    if (resolved === activePremoves || (resolved.length === 0 && activePremoves.length === 0)) return
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
      if (!isBoardSizeControlled) {
        setUserBoardSize(pendingSize)
      }
      onBoardSizeChangeRef.current?.(pendingSize, pendingSize / 8)
    })
  }, [isBoardSizeControlled, maxSize, minSize, onBoardSizeChangeRef])

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

  const emitPositionChange = useCallback((move?: Move, suppliedHistory?: Move[]) => {
    const history = suppliedHistory ?? getChessBoardHistory(chess)
    onHistoryChange?.(history)
    onPositionChange?.(chess.fen(), move, history)
  }, [chess, onHistoryChange, onPositionChange])

  const recordTimelineMove = useCallback((
    move: Move,
    before: string,
    after: string,
    forceTimeline = false,
  ): Move[] => {
    const current = BOARD_TIMELINES.get(chess)
    let entries: BoardTimelineEntry[]
    let usesSyntheticHistory = forceTimeline

    if (current?.chess === chess && getTimelineFen(current) === before) {
      entries = current.entries.slice(0, current.cursor)
      usesSyntheticHistory = current.usesSyntheticHistory || forceTimeline
    } else {
      entries = verboseHistory.map((historyMove) => ({
        move: historyMove,
        before: historyMove.before,
        after: historyMove.after,
      }))
    }

    entries.push({ move, before, after })
    const timeline = { chess, entries, cursor: entries.length, usesSyntheticHistory }
    BOARD_TIMELINES.set(chess, timeline)
    return getTimelineMoves(timeline)
  }, [chess, verboseHistory])

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
      const after = moveGame.fen()
      if (isOffTurnExplorerMove) {
        chess.load(after)
      }
      const history = recordTimelineMove(move, position, after, isOffTurnExplorerMove)
      setSelectedSquare(null)
      setLegalMoves((prev) => (prev.length === 0 ? prev : []))
      setPromotionPending(null)
      redoStackRef.current = []
      internalMutationRef.current = 'move'
      onMove?.(move, history)
      emitPositionChange(move, history)
      return move
    } catch {
      return null
    }
  }, [chess, emitPositionChange, isGodExplorerMode, onMove, pieces, position, recordTimelineMove, turn])

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

  const canQueuePremoveCandidate = useCallback((premove: PremoveState) => (
    canQueuePremove
      ? canQueuePremove({ premove, chess, position, playerColor })
      : defaultCanQueuePremove(premove)
  ), [canQueuePremove, chess, defaultCanQueuePremove, playerColor, position])

  const needsPremovePromotion = useCallback((from: string, to: string) => {
    const piece = premovePreview.previewPieces[from]
    if (!piece || piece[1] !== 'P') return false
    const destinationRank = Number(to[1])
    const reachesLastRank = piece[0] === 'w' ? destinationRank === 8 : destinationRank === 1
    if (!reachesLastRank) return false
    return canQueuePremoveCandidate({ from, to, promotion: 'q' })
  }, [canQueuePremoveCandidate, premovePreview.previewPieces])

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
    if (!canQueuePremoveCandidate(premove)) return false
    setPremoves((prev) => [...prev, premove])
    onPremoveAdd?.(premove)
    setSelectedSquare(null)
    setLegalMoves((prev) => (prev.length === 0 ? prev : []))
    return true
  }, [canQueuePremoveCandidate, onPremoveAdd, setPremoves])

  const getSelectableMoves = useCallback((square: string) => {
    if (!showLegalMoves) return []
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
    showLegalMoves,
    turn,
  ])

  const handleSquareClick = useCallback((square: string) => {
    if (promotionPending) return
    const piece = getPlanningPiece(square)

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null)
        setLegalMoves((prev) => (prev.length === 0 ? prev : []))
        if (activePremoves.length > 0) setPremoves([])
        clearUserAnnotations()
        return
      }

      const selectedPiece = getPlanningPiece(selectedSquare)
      const selectedPieceColor = getPieceColor(selectedPiece)
      if (!selectedPieceColor || !canControlPiece(selectedPiece)) {
        setSelectedSquare(null)
        setLegalMoves((prev) => (prev.length === 0 ? prev : []))
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
        setLegalMoves((prev) => (prev.length === 0 ? prev : []))
        if (activePremoves.length > 0) setPremoves([])
        clearUserAnnotations()
      }
      return
    }

    if (canControlPiece(piece)) {
      setSelectedSquare(square)
      setLegalMoves(getSelectableMoves(square))
      return
    }

    setSelectedSquare(null)
    setLegalMoves((prev) => (prev.length === 0 ? prev : []))
    if (activePremoves.length > 0) setPremoves([])
    clearUserAnnotations()
  }, [
    activePremoves.length,
    canControlPiece,
    clearUserAnnotations,
    executeMove,
    getPlanningPiece,
    getSelectableMoves,
    isExplorerEnabled,
    needsPlayablePromotion,
    needsPremovePromotion,
    promotionPending,
    queuePremove,
    selectedSquare,
    setPremoves,
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
    dragPointerRef.current = { x: clientX, y: clientY }
    setDragging({ piece, from })
    scheduleOverlayFrame()
  }, [getSelectableMoves, scheduleOverlayFrame])

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
  }, [canControlPiece, emitLiveArrow, getPlanningPiece, promotionPending, scheduleOverlayFrame, startPieceDrag])

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
  }, [dragging, drawingArrow, scheduleOverlayFrame, startPieceDrag])

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (drawingArrow && e.pointerType === 'mouse' && e.button === 2) {
      const rect = boardRef.current?.getBoundingClientRect() ?? boardRectRef.current
      if (rect) {
        const col = Math.floor((e.clientX - rect.left) / squareSize)
        const row = Math.floor((e.clientY - rect.top) / squareSize)
        if (col >= 0 && col < 8 && row >= 0 && row < 8) {
          const toSquare = getSquareName(col, row, isFlipped)
          if (drawingArrow.from !== toSquare) {
            toggleUserArrow(drawingArrow.from, toSquare)
          } else {
            toggleMarkedSquare(toSquare)
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
    dragging,
    drawingArrow,
    dropPiece,
    emitLiveArrow,
    isFlipped,
    squareSize,
    toggleMarkedSquare,
    toggleUserArrow,
  ])

  const handlePointerCancel = useCallback(() => {
    if (rafRef.current !== null) {
      window.cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    pendingTouchDragRef.current = null
    setIsTouchDragPending(false)
    setDragging(null)
    setDrawingArrow(null)
    emitLiveArrow(null)
    if (liveArrowPathRef.current) liveArrowPathRef.current.setAttribute('d', '')
    if (liveArrowHeadRef.current) liveArrowHeadRef.current.setAttribute('points', '')
    boardRectRef.current = null
  }, [emitLiveArrow])

  const setBoardFlipped = useCallback((nextFlipped: boolean) => {
    handlePointerCancel()
    if (nextFlipped === isFlipped) return
    setIsFlipped(nextFlipped)
    onFlippedChange?.(nextFlipped)
  }, [handlePointerCancel, isFlipped, onFlippedChange])

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
      handlePointerCancel()
      chess.load(fen)
      BOARD_TIMELINES.delete(chess)
      setSelectedSquare(null)
      setLegalMoves((prev) => (prev.length === 0 ? prev : []))
      setPromotionPending(null)
      clearUserAnnotations()
      setPremoves([])
      redoStackRef.current = []
      internalMutationRef.current = 'load'
      emitPositionChange()
      return true
    } catch {
      return false
    }
  }, [chess, clearUserAnnotations, emitPositionChange, handlePointerCancel, setPremoves])

  const goToPreviousMove = useCallback(() => {
    if (chess.fen() !== position) return false
    handlePointerCancel()
    const timeline = BOARD_TIMELINES.get(chess)
    if (
      timeline?.chess === chess
      && timeline.usesSyntheticHistory
      && getTimelineFen(timeline) === position
    ) {
      if (timeline.cursor === 0) return false
      const nextCursor = timeline.cursor - 1
      const targetFen = nextCursor === 0
        ? timeline.entries[0]?.before
        : timeline.entries[nextCursor - 1]?.after
      if (!targetFen) return false
      try {
        chess.load(targetFen)
        BOARD_TIMELINES.set(chess, { ...timeline, cursor: nextCursor })
        redoStackRef.current = []
        setSelectedSquare(null)
        setLegalMoves((prev) => (prev.length === 0 ? prev : []))
        setPromotionPending(null)
        setPremoves([])
        internalMutationRef.current = 'prev'
        emitPositionChange(undefined, timeline.entries.slice(0, nextCursor).map((entry) => entry.move))
        return true
      } catch {
        return false
      }
    }

    const undone = chess.undo()
    if (!undone) return false
    redoStackRef.current.push(undone)
    let history: Move[] | undefined
    if (
      timeline
      && !timeline.usesSyntheticHistory
      && getTimelineFen(timeline) === position
      && timeline.entries[timeline.cursor - 1]?.before === chess.fen()
    ) {
      const previousTimeline = { ...timeline, cursor: timeline.cursor - 1 }
      BOARD_TIMELINES.set(chess, previousTimeline)
      history = getTimelineMoves(previousTimeline)
    }
    setSelectedSquare(null)
    setLegalMoves((prev) => (prev.length === 0 ? prev : []))
    setPromotionPending(null)
    setPremoves([])
    internalMutationRef.current = 'prev'
    emitPositionChange(undefined, history)
    return true
  }, [chess, emitPositionChange, handlePointerCancel, position, setPremoves])

  const goToNextMove = useCallback(() => {
    if (chess.fen() !== position) return false
    handlePointerCancel()
    const timeline = BOARD_TIMELINES.get(chess)
    if (
      timeline?.chess === chess
      && timeline.usesSyntheticHistory
      && getTimelineFen(timeline) === position
    ) {
      const nextEntry = timeline.entries[timeline.cursor]
      if (!nextEntry) return false
      try {
        chess.load(nextEntry.after)
        const nextCursor = timeline.cursor + 1
        BOARD_TIMELINES.set(chess, { ...timeline, cursor: nextCursor })
        redoStackRef.current = []
        setSelectedSquare(null)
        setLegalMoves((prev) => (prev.length === 0 ? prev : []))
        setPromotionPending(null)
        setPremoves([])
        internalMutationRef.current = 'next'
        emitPositionChange(
          nextEntry.move,
          timeline.entries.slice(0, nextCursor).map((entry) => entry.move),
        )
        return true
      } catch {
        return false
      }
    }

    const pendingNext = redoStackRef.current[redoStackRef.current.length - 1]
    if (!pendingNext || pendingNext.before !== position) {
      redoStackRef.current = []
      return false
    }
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
      let history: Move[] | undefined
      if (
        timeline
        && !timeline.usesSyntheticHistory
        && getTimelineFen(timeline) === position
        && timeline.entries[timeline.cursor]?.after === chess.fen()
      ) {
        const nextTimeline = { ...timeline, cursor: timeline.cursor + 1 }
        BOARD_TIMELINES.set(chess, nextTimeline)
        history = getTimelineMoves(nextTimeline)
      }
      setSelectedSquare(null)
      setLegalMoves((prev) => (prev.length === 0 ? prev : []))
      setPromotionPending(null)
      setPremoves([])
      internalMutationRef.current = 'next'
      emitPositionChange(replayed, history)
      return true
    } catch {
      redoStackRef.current.push(next)
      return false
    }
  }, [chess, emitPositionChange, handlePointerCancel, position, setPremoves])

  useImperativeHandle(ref, () => ({
    flipBoard: () => setBoardFlipped(!isFlipped),
    setFlipped: (nextFlipped: boolean) => setBoardFlipped(nextFlipped),
    isFlipped: () => isFlipped,
    goToPreviousMove,
    goToNextMove,
    canGoToPreviousMove: () => chess.fen() === position && verboseHistory.length > 0,
    canGoToNextMove: () => {
      const timeline = BOARD_TIMELINES.get(chess)
      if (
        timeline?.chess === chess
        && timeline.usesSyntheticHistory
        && getTimelineFen(timeline) === position
      ) {
        return timeline.cursor < timeline.entries.length
      }
      const pendingNext = redoStackRef.current[redoStackRef.current.length - 1]
      return pendingNext?.before === position
    },
    getHistory: () => getChessBoardHistory(chess),
    getCurrentPly: () => getChessBoardHistory(chess).length,
    setPositionFromFen: (fen: string) => loadFen(fen),
    resetToInitialFen: () => loadFen(initialFen),
  }), [chess, goToNextMove, goToPreviousMove, initialFen, isFlipped, loadFen, position, setBoardFlipped, verboseHistory.length])

  const onWindowPointerMove = useStableCallback(handlePointerMove)
  const onWindowPointerUp = useStableCallback(handlePointerUp)
  const onWindowPointerCancel = useStableCallback(handlePointerCancel)
  const onWindowResizePointerMove = useStableCallback(handleResizePointerMove)
  const onWindowResizePointerUp = useStableCallback(handleResizePointerUp)
  const hasActivePointerGesture = Boolean(dragging || drawingArrow || isTouchDragPending)

  useEffect(() => {
    onWindowPointerCancel()
    setIsFlipped(flipped)
  }, [flipped, onWindowPointerCancel])

  useEffect(() => {
    if (!hasActivePointerGesture) return

    window.addEventListener('pointermove', onWindowPointerMove)
    window.addEventListener('pointerup', onWindowPointerUp)
    window.addEventListener('pointercancel', onWindowPointerCancel)
    return () => {
      window.removeEventListener('pointermove', onWindowPointerMove)
      window.removeEventListener('pointerup', onWindowPointerUp)
      window.removeEventListener('pointercancel', onWindowPointerCancel)
    }
  }, [hasActivePointerGesture, onWindowPointerCancel, onWindowPointerMove, onWindowPointerUp])

  useEffect(() => {
    if (!isResizing) return
    window.addEventListener('pointermove', onWindowResizePointerMove)
    window.addEventListener('pointerup', onWindowResizePointerUp)
    window.addEventListener('pointercancel', onWindowResizePointerUp)
    return () => {
      window.removeEventListener('pointermove', onWindowResizePointerMove)
      window.removeEventListener('pointerup', onWindowResizePointerUp)
      window.removeEventListener('pointercancel', onWindowResizePointerUp)
    }
  }, [isResizing, onWindowResizePointerMove, onWindowResizePointerUp])

  useSafeLayoutEffect(() => {
    if (isBoardSizeControlled || !fillContainer || (fixedSquareSize && fixedSquareSize > 0)) return
    const node = rootRef.current
    if (!node) return

    const applyWidth = (nextWidth: number) => {
      if (Number.isFinite(nextWidth) && nextWidth > 0) {
        const roundedWidth = Math.round(nextWidth)
        setContainerWidth((previousWidth) => (
          previousWidth === roundedWidth ? previousWidth : roundedWidth
        ))
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
  }, [fillContainer, fixedSquareSize, isBoardSizeControlled])

  useEffect(() => {
    if (!internalMutationRef.current) {
      redoStackRef.current = []
    }
    internalMutationRef.current = null
  }, [position])

  useEffect(() => {
    if (!enableSounds) {
      soundRefs.current = {}
      return
    }

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
      soundRefs.current = {}
    }
  }, [enableSounds, successSoundSrc])

  useEffect(() => {
    const shouldPlay = playSuccessSound && !wasPlaySuccessSoundRef.current
    if (shouldPlay) {
      playAudio(soundRefs.current.success)
    }
    wasPlaySuccessSoundRef.current = playSuccessSound
  }, [playAudio, playSuccessSound])

  useEffect(() => {
    if (!enableSounds) {
      lastHistoryLengthRef.current = verboseHistory.length
      return
    }

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
  }, [boardView, enableSounds, playAudio, verboseHistory])

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

    if (premoveMove) {
      setPremoves(rest)
      const history = recordTimelineMove(premoveMove, position, chess.fen())
      redoStackRef.current = []
      internalMutationRef.current = 'move'
      onPremoveExecute?.(nextPremove, premoveMove)
      onMove?.(premoveMove, history)
      emitPositionChange(premoveMove, history)
    } else {
      // Later premoves were planned on top of this one. Once the head is
      // illegal, the remaining preview chain is stale and must not execute.
      setPremoves([])
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
    recordTimelineMove,
    setPremoves,
    turn,
  ])

  useSafeLayoutEffect(() => {
    onWindowPointerCancel()
    setSelectedSquare(null)
    setLegalMoves((prev) => (prev.length === 0 ? prev : []))
    setPromotionPending(null)
  }, [onWindowPointerCancel, position])

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
  const onSquarePointerDown = useStableCallback(handlePointerDown)
  const onBoardSquareClick = useStableCallback(handleBoardSquareClick)

  const renderDragPiece = () => {
    if (!dragging) return null
    const PieceComp = PieceComponents[dragging.piece]
    if (!PieceComp) return null
    return (
      <div
        ref={dragGhostRef}
        className="sw:fixed sw:pointer-events-none sw:z-[1000] sw:flex sw:items-center sw:justify-center"
        style={{
          left: 0,
          top: 0,
          width: squareSize,
          height: squareSize,
          transform: `translate3d(${dragPointerRef.current.x - squareSize / 2}px, ${dragPointerRef.current.y - squareSize / 2}px, 0)`,
          willChange: 'transform',
        }}
      >
        <div className="sw:drop-shadow-lg sw:scale-110 sw:flex sw:items-center sw:justify-center sw:w-full sw:h-full">
          <PieceComp size={squareSize - 4} />
        </div>
      </div>
    )
  }

  const status = useMemo(() => {
    if (!showStatusBar) return ''
    if (boardView.isCheckmate()) return `Checkmate! ${boardView.turn() === 'w' ? 'Black' : 'White'} wins!`
    if (boardView.isStalemate()) return 'Stalemate!'
    if (boardView.isThreefoldRepetition()) return 'Draw by repetition!'
    if (boardView.isInsufficientMaterial()) return 'Draw by insufficient material!'
    if (boardView.isDraw()) return 'Draw!'
    if (boardView.isCheck()) return `${boardView.turn() === 'w' ? 'White' : 'Black'} is in check!`
    return `${boardView.turn() === 'w' ? 'White' : 'Black'} to move`
  }, [boardView, showStatusBar])

  return (
    <div ref={rootRef} className={`swiftchess-root ${className ?? 'sw:w-full'}`}>
      <div className="sw:flex sw:flex-col sw:gap-2">
        {showStatusBar && (
          <div className="sw:text-sm sw:text-gray-400 sw:bg-white/[0.06] sw:px-3 sw:py-1.5 sw:rounded-lg sw:inline-flex sw:w-fit">
            <span className="sw:font-semibold sw:text-gray-300">{mode === 'analysis' ? 'Analysis' : 'Play'}</span>
            <span>&nbsp;• {status}</span>
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
          className={`sw:grid sw:grid-cols-[repeat(8,1fr)] sw:grid-rows-[repeat(8,1fr)] sw:rounded sw:relative sw:shadow-[0_8px_32px_rgba(0,0,0,0.4),0_2px_8px_rgba(0,0,0,0.3)] sw:select-none sw:touch-none ${isResizing ? 'sw:cursor-nwse-resize' : ''}`}
          style={{ width: boardSize, height: boardSize, outline: '3px solid #3a3a5c' }}
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
            onSquarePointerDown={onSquarePointerDown}
            onSquareClick={onBoardSquareClick}
          />

          <ArrowLayer
            arrows={activeUserArrows}
            overlayArrows={overlayArrows}
            circles={markedSquares}
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
            circleColor={DEFAULT_CIRCLE_STYLE.color}
            circleOpacity={DEFAULT_CIRCLE_STYLE.opacity}
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
              className="sw:absolute sw:-bottom-3 sw:-right-3 sw:z-20 sw:h-7 sw:w-7 sw:touch-none sw:rounded sw:bg-zinc-800/95 sw:border sw:border-white/30 sw:shadow-lg sw:cursor-nwse-resize sw:flex sw:items-center sw:justify-center sw:hover:bg-zinc-700 sw:focus:outline-none sw:focus:ring-2 sw:focus:ring-blue-400"
              aria-label="Resize board"
              title="Resize board"
              onPointerDown={handleResizePointerDown}
            >
              <span className="sw:block sw:h-3 sw:w-3 sw:border-r-2 sw:border-b-2 sw:border-white/80" />
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
