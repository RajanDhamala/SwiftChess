import React from 'react'

export const PremoveOverlay: React.FC = React.memo(() => (
  <div className="absolute inset-0 bg-red-900/50 pointer-events-none z-[1]" />
))

PremoveOverlay.displayName = 'PremoveOverlay'
