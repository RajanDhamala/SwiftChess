import React from 'react'
import type { MoveBadge, MoveBadgeKind } from '../ChessBoard'
import blunderBadgeSrc from '../../assets/blunder.png'
import mistakeBadgeSrc from '../../assets/mistake.png'
import inaccuracyBadgeSrc from '../../assets/inaccuracy.png'
import missBadgeSrc from '../../assets/miss.png'
import goodBadgeSrc from '../../assets/goodMove.png'
import excellentBadgeSrc from '../../assets/Excellent.png'
import bestBadgeSrc from '../../assets/bestMove.png'
import brilliantBadgeSrc from '../../assets/Brilliant.png'
import bookBadgeSrc from '../../assets/bookMove.png'
import onlyMoveBadgeSrc from '../../assets/OnlyMove.png'

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
  blunder: blunderBadgeSrc,
  mistake: mistakeBadgeSrc,
  inaccuracy: inaccuracyBadgeSrc,
  miss: missBadgeSrc,
  good: goodBadgeSrc,
  excellent: excellentBadgeSrc,
  best: bestBadgeSrc,
  brilliant: brilliantBadgeSrc,
  book: bookBadgeSrc,
  onlyMove: onlyMoveBadgeSrc,
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
