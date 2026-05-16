import React, { useMemo } from 'react'
import { buildArrowShape } from '../../utils/arrowUtils'
import type { Arrow } from './types'

interface ArrowLayerProps {
  arrows: Arrow[]
  drawingArrow: boolean
  boardSize: number
  squareSize: number
  isFlipped: boolean
  liveArrowPathRef: React.RefObject<SVGPathElement | null>
  liveArrowHeadRef: React.RefObject<SVGPolygonElement | null>
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
  liveArrowHeadRef,
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
      const lengthReducer = targetCounts[arrow.to] > 1 ? squareSize / 2.7 : squareSize / 3.2
      const shape = buildArrowShape(arrow.from, arrow.to, isFlipped, squareSize, lengthReducer)
      if (!shape) return null
      const stroke = arrow.color ?? defaultColor
      const opacity = arrow.opacity ?? defaultOpacity
      const strokeWidth = squareSize * (arrow.widthScale ?? defaultWidthScale)
      return { ...arrow, id: `${index}-${arrow.from}-${arrow.to}`, shape, stroke, opacity, strokeWidth }
    })
  }, [arrows, defaultColor, defaultOpacity, defaultWidthScale, isFlipped, squareSize])

  return (
    <svg
      width={boardSize}
      height={boardSize}
      className="absolute top-0 left-0 pointer-events-none z-10"
    >
      {arrowData.map((arrow) => {
        if (!arrow) return null
        return (
          <g key={arrow.id} opacity={arrow.opacity}>
            <path
              d={arrow.shape.shaftD}
              fill="none"
              stroke={arrow.stroke}
              strokeWidth={arrow.strokeWidth}
              strokeLinecap="butt"
              strokeLinejoin="round"
            />
            <polygon points={arrow.shape.headPoints} fill={arrow.stroke} />
          </g>
        )
      })}

      {drawingArrow && (
        <g opacity={liveArrowOpacity}>
          <path
            ref={liveArrowPathRef}
            d=""
            fill="none"
            stroke={liveArrowColor}
            strokeWidth={squareSize * defaultWidthScale}
            strokeLinecap="butt"
            strokeLinejoin="round"
          />
          <polygon ref={liveArrowHeadRef} points="" fill={liveArrowColor} />
        </g>
      )}
    </svg>
  )
})

ArrowLayer.displayName = 'ArrowLayer'
