import React from 'react'

export const PremoveOverlay: React.FC = React.memo(() => (
  <div className="sw:absolute sw:inset-0 sw:bg-red-900/50 sw:pointer-events-none sw:z-[1]" />
))

PremoveOverlay.displayName = 'PremoveOverlay'
