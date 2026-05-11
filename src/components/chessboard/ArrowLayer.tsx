import React, { useMemo } from 'react'
import { buildArrowPath } from '../../utils/arrowUtils'
import type { Arrow } from './types'

interface ArrowLayerProps {
  arrows: Arrow[]
  drawingArrow: boolean
  boardSize: number
  squareSize: number
  isFlipped: boolean
  liveArrowPathRef: React.RefObject<SVGPathElement | null>
  defaultColor: string
  defaultOpacity: number
  defaultWidthScale: number
  liveArrowColor: string
  liveArrowOpacity: number
}

export const ArrowLayer: React.FC<ArrowLayerProps> = React.memo(({
  arrows,
  drawingArrow,
  boardSize,
  squareSize,
  isFlipped,
  liveArrowPathRef,
  defaultColor,
  defaultOpacity,
  defaultWidthScale,
  liveArrowColor,
  liveArrowOpacity,
}) => {
  const arrowData = useMemo(() => {
    const targetCounts = arrows.reduce<Record<string, number>>((acc, arrow) => {
      acc[arrow.to] = (acc[arrow.to] ?? 0) + 1
      return acc
    }, {})

    return arrows.map((arrow, index) => {
      const lengthReducer = targetCounts[arrow.to] > 1 ? squareSize / 5 : squareSize / 10
      const pathD = buildArrowPath(arrow.from, arrow.to, isFlipped, squareSize, lengthReducer)
      if (!pathD) return null
      const markerId = `arrowhead-${index}-${arrow.from}-${arrow.to}`
      const stroke = arrow.color ?? defaultColor
      const opacity = arrow.opacity ?? defaultOpacity
      const strokeWidth = squareSize * (arrow.widthScale ?? defaultWidthScale)
      return { ...arrow, pathD, markerId, stroke, opacity, strokeWidth }
    })
  }, [arrows, defaultColor, defaultOpacity, defaultWidthScale, isFlipped, squareSize])

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
              <polygon points="0,0 4,2 0,4" fill={arrow.stroke} fillOpacity={arrow.opacity} />
            </marker>
          )
        })}
        {drawingArrow && (
          <marker id="arrowhead-live" markerWidth="20" markerHeight="20" refX="3.5" refY="2" orient="auto" markerUnits="strokeWidth">
            <polygon points="0,0 4,2 0,4" fill={liveArrowColor} fillOpacity={liveArrowOpacity} />
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
            stroke={arrow.stroke}
            strokeWidth={arrow.strokeWidth}
            markerEnd={`url(#${arrow.markerId})`}
            opacity={arrow.opacity}
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
          stroke={liveArrowColor}
          strokeWidth={squareSize * defaultWidthScale}
          markerEnd="url(#arrowhead-live)"
          opacity={liveArrowOpacity}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  )
})

ArrowLayer.displayName = 'ArrowLayer'
