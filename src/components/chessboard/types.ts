export interface DragState {
  piece: string
  from: string
}

export interface Arrow {
  from: string
  to: string
}

export interface PremoveState {
  from: string
  to: string
}

export interface PromotionPendingState {
  from: string
  to: string
}

export interface LastMoveState {
  from: string
  to: string
}
