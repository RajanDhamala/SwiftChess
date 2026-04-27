import React from 'react'
import type { MoveBadge, MoveBadgeKind } from '../ChessBoard'

interface MoveBadgeIconProps {
  badge: MoveBadge
  size: number
}

const BADGE_LABELS: Record<MoveBadgeKind, string> = {
  blunder: 'Blunder',
  mistake: 'Mistake',
  inaccuracy: 'Inaccuracy',
  miss: 'Miss',
  good: 'Good move',
  excellent: 'Excellent',
  best: 'Best move',
  brilliant: 'Brilliant',
  book: 'Book move',
  onlyMove: 'Only move',
}

const BADGE_IMAGE_SRCS: Record<MoveBadgeKind, string> = {
  blunder: '/blunder.png',
  mistake: '/mistake.png',
  inaccuracy: '/inaccuracy',
  miss: '/miss.png',
  good: '/goodMove.png',
  excellent: '/Excellent.png',
  best: '/bestMove.png',
  brilliant: '/Brilliant.png',
  book: '/bookMove.png',
  onlyMove: '/OnlyMove.png',
}

export const MoveBadgeIcon: React.FC<MoveBadgeIconProps> = ({ badge, size }) => {
  const src = badge.src ?? BADGE_IMAGE_SRCS[badge.kind]
  const title = badge.label ?? BADGE_LABELS[badge.kind]

  return (
    <img
      src={src}
      alt={title}
      width={size}
      height={size}
      className="rounded-full object-cover drop-shadow-[0_2px_6px_rgba(0,0,0,0.45)]"
      aria-label={title}
      title={title}
      draggable={false}
    />
  )
}
