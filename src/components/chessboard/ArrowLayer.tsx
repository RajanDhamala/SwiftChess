import React, { useMemo } from 'react'
import { buildArrowShape } from '../../utils/arrowUtils'
import { getSquareCoords } from '../../utils/chessUtils'
import type { Arrow } from './types'

interface ArrowLayerProps {
  arrows: Arrow[]
  overlayArrows: Arrow[]
  circles: string[]
  drawingArrow: boolean
  boardSize: number
  squareSize: number
  isFlipped: boolean
  liveArrowPathRef: React.RefObject<SVGPathElement | null>
  liveArrowHeadRef: React.RefObject<SVGPolygonElement | null>
  defaultColor: string
  defaultOpacity: number
  defaultWidthScale: number
  overlayDefaultColor: string
  overlayDefaultOpacity: number
  overlayDefaultWidthScale: number
  liveArrowColor: string
  liveArrowOpacity: number
  liveArrowWidthScale: number
  circleColor: string
  circleOpacity: number
}

export const ArrowLayer: React.FC<ArrowLayerProps> = React.memo(({
  arrows,
  overlayArrows,
  circles,
  drawingArrow,
  boardSize,
  squareSize,
  isFlipped,
  liveArrowPathRef,
  liveArrowHeadRef,
  defaultColor,
  defaultOpacity,
  defaultWidthScale,
  overlayDefaultColor,
  overlayDefaultOpacity,
  overlayDefaultWidthScale,
  liveArrowColor,
  liveArrowOpacity,
  liveArrowWidthScale,
  circleColor,
  circleOpacity,
}) => {
  const circleData = useMemo(() => (
    circles.map((square) => {
      const { col, row } = getSquareCoords(square, isFlipped)
      const strokeWidth = Math.max(3, Math.min(8, squareSize * 0.07))
      const edgeInset = squareSize * 0.04
      return {
        square,
        cx: col * squareSize + squareSize / 2,
        cy: row * squareSize + squareSize / 2,
        radius: squareSize / 2 - edgeInset - strokeWidth / 2,
        strokeWidth,
      }
    })
  ), [circles, isFlipped, squareSize])

  const arrowData = useMemo(() => {
    const renderEntries = [
      ...overlayArrows.map((arrow, index) => ({
        arrow,
        index,
        layer: 'overlay',
        defaultColor: overlayDefaultColor,
        defaultOpacity: overlayDefaultOpacity,
        defaultWidthScale: overlayDefaultWidthScale,
      })),
      ...arrows.map((arrow, index) => ({
        arrow,
        index,
        layer: 'user',
        defaultColor,
        defaultOpacity,
        defaultWidthScale,
      })),
    ]

    const targetCounts = renderEntries.reduce<Record<string, number>>((acc, entry) => {
      acc[entry.arrow.to] = (acc[entry.arrow.to] ?? 0) + 1
      return acc
    }, {})

    return renderEntries.map((entry) => {
      const { arrow } = entry
      const lengthReducer = targetCounts[arrow.to] > 1 ? squareSize / 2.7 : squareSize / 3.2
      const shape = buildArrowShape(arrow.from, arrow.to, isFlipped, squareSize, lengthReducer)
      if (!shape) return null
      const stroke = arrow.color ?? entry.defaultColor
      const opacity = arrow.opacity ?? entry.defaultOpacity
      const strokeWidth = squareSize * (arrow.widthScale ?? entry.defaultWidthScale)
      const id = arrow.id ?? `${entry.index}-${arrow.from}-${arrow.to}`
      return { ...arrow, id: `${entry.layer}-${id}`, shape, stroke, opacity, strokeWidth }
    })
  }, [
    arrows,
    defaultColor,
    defaultOpacity,
    defaultWidthScale,
    isFlipped,
    overlayArrows,
    overlayDefaultColor,
    overlayDefaultOpacity,
    overlayDefaultWidthScale,
    squareSize,
  ])

  return (
    <svg
      width={boardSize}
      height={boardSize}
      className="absolute top-0 left-0 pointer-events-none z-10"
    >
      {circleData.map((circle) => (
        <circle
          key={circle.square}
          cx={circle.cx}
          cy={circle.cy}
          r={circle.radius}
          fill="none"
          stroke={circleColor}
          strokeWidth={circle.strokeWidth}
          opacity={circleOpacity}
        />
      ))}

      {arrowData.map((arrow) => {
        if (!arrow) return null
        return (
          <g key={arrow.id} opacity={arrow.opacity}>
            <path
              d={arrow.shape.shaftD}
              fill="none"
              stroke={arrow.stroke}
              strokeWidth={arrow.strokeWidth}
              strokeLinecap="round"
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
            strokeWidth={squareSize * liveArrowWidthScale}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polygon ref={liveArrowHeadRef} points="" fill={liveArrowColor} />
        </g>
      )}
    </svg>
  )
})

ArrowLayer.displayName = 'ArrowLayer'
