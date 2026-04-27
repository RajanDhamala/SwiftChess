export interface DragState {
  piece: string
  from: string
}

export interface ArrowStyleOptions {
  color?: string
  opacity?: number
  widthScale?: number
  liveColor?: string
  liveOpacity?: number
}

export interface BoardThemeColors {
  light: string
  dark: string
}

export type BoardThemePreset = 'chessComClassic' | 'brownBoard' | 'iceBlue' | 'custom'

export const BOARD_THEME_PRESETS: Record<BoardThemePreset, BoardThemeColors> = {
  chessComClassic: {
    light: '#EEEED2',
    dark: '#769656',
  },
  brownBoard: {
    light: '#F0D9B5',
    dark: '#B58863',
  },
  iceBlue: {
    light: '#DEE3E6',
    dark: '#8CA2AD',
  },
  custom: {
    light: '#E8E8E8',
    dark: '#5EA01C',
  },
}

export interface Arrow {
  from: string
  to: string
  color?: string
  opacity?: number
  widthScale?: number
}

export interface PremoveState {
  from: string
  to: string
  promotion?: 'q' | 'r' | 'b' | 'n'
}

export interface PromotionPendingState {
  from: string
  to: string
}

export interface LastMoveState {
  from: string
  to: string
}
