import '../styles/swiftchess.css'

export { default as ChessBoard } from '../components/ChessBoard'
export type {
  ChessBoardProps,
  ChessBoardHandle,
  PremoveValidationArgs,
  BoardThemeColors,
  BoardThemePreset,
  ChessBoardMode,
  ChessBoardExplorerMode,
  MoveBadge,
  MoveBadgeByPly,
  MoveBadgeKind,
} from '../components/ChessBoard'
export { BOARD_THEME_PRESETS } from '../components/ChessBoard'
export type {
  Arrow,
  ArrowCommitAction,
  ArrowCommitEvent,
  ArrowStyleOptions,
  LiveArrow,
  PremoveState,
} from '../components/chessboard/types'
