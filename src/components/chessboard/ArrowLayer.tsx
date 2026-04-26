import React from 'react'
import { buildArrowPath } from '../../utils/arrowUtils'
import type { Arrow } from './types'

interface ArrowLayerProps {
  arrows: Arrow[]
  drawingArrow: boolean
  boardSize: number
  squareSize: number
  isFlipped: boolean
  liveArrowPathRef: React.RefObject<SVGPathElement | null>
}

export const ArrowLayer: React.FC<ArrowLayerProps> = ({
  arrows,
  drawingArrow,
  boardSize,
  squareSize,
  isFlipped,
  liveArrowPathRef,
}) => {
  const targetCounts = arrows.reduce<Record<string, number>>((acc, arrow) => {
    acc[arrow.to] = (acc[arrow.to] ?? 0) + 1
    return acc
  }, {})

  const arrowWidth = squareSize / 9
  const arrowData = arrows.map((arrow, index) => {
    const lengthReducer = targetCounts[arrow.to] > 1 ? squareSize / 5 : squareSize / 10
    const pathD = buildArrowPath(arrow.from, arrow.to, isFlipped, squareSize, lengthReducer)
    if (!pathD) return null
    const markerId = `arrowhead-${index}-${arrow.from}-${arrow.to}`
    return { ...arrow, pathD, markerId }
  })

  return (
    <svg
      width={boardSize}
      height={boardSize}
      className="absolute top-0 left-0 pointer-events-none z-10"
    >
      <defs>
        {arrowData.map((arrow) => {
          if (!arrow) return null
          return (
            <marker
              key={arrow.markerId}
              id={arrow.markerId}
              markerWidth="20"
              markerHeight="20"
              refX="3.5"
              refY="2"
              orient="auto"
              markerUnits="strokeWidth"
            >
              <polygon points="0,0 4,2 0,4" fill="rgba(0, 150, 50, 0.8)" />
            </marker>
          )
        })}
        {drawingArrow && (
          <marker id="arrowhead-live" markerWidth="20" markerHeight="20" refX="3.5" refY="2" orient="auto" markerUnits="strokeWidth">
            <polygon points="0,0 4,2 0,4" fill="rgba(0, 120, 200, 0.7)" />
          </marker>
        )}
      </defs>

      {arrowData.map((arrow) => {
        if (!arrow) return null
        return (
          <path
            key={`${arrow.from}-${arrow.to}-${arrow.markerId}`}
            d={arrow.pathD}
            fill="none"
            stroke="rgba(0, 150, 50, 0.8)"
            strokeWidth={arrowWidth}
            markerEnd={`url(#${arrow.markerId})`}
            opacity={0.85}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )
      })}

      {drawingArrow && (
        <path
          ref={liveArrowPathRef}
          d=""
          fill="none"
          stroke="rgba(0, 120, 200, 0.7)"
          strokeWidth={arrowWidth}
          markerEnd="url(#arrowhead-live)"
          opacity={0.7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
}
