import React, { createRef, useState } from 'react'
import { Chess } from 'chess.js'
import { fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ChessBoard from './ChessBoard'
import type { ChessBoardHandle } from './ChessBoard'
import type { PremoveState } from './chessboard/types'

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function createPointerEvent(
  type: string,
  init: MouseEventInit & { pointerId?: number; pointerType?: string } = {},
) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init })
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId ?? 1 },
    pointerType: { value: init.pointerType ?? 'mouse' },
  })
  return event
}

function boardRect(size: number): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    right: size,
    bottom: size,
    left: 0,
    width: size,
    height: size,
    toJSON: () => ({}),
  }
}

describe('ChessBoard regressions', () => {
  it('commits a legal mouse drag exactly once', async () => {
    const chess = new Chess()
    const onMove = vi.fn()
    const onPositionChange = vi.fn()

    function Harness() {
      const [position, setPosition] = useState(chess.fen())
      return (
        <ChessBoard
          chess={chess}
          position={position}
          boardSize={320}
          onMove={onMove}
          onPositionChange={(fen) => {
            onPositionChange(fen)
            setPosition(fen)
          }}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    const source = view.container.querySelector<HTMLElement>('[data-square="e2"]')!
    vi.spyOn(source.parentElement!, 'getBoundingClientRect').mockReturnValue(boardRect(320))

    fireEvent(source, createPointerEvent('pointerdown', {
      button: 0,
      clientX: 180,
      clientY: 260,
    }))
    fireEvent(window, createPointerEvent('pointerup', {
      button: 0,
      clientX: 180,
      clientY: 180,
    }))

    await waitFor(() => expect(chess.get('e4')?.type).toBe('p'))
    expect(onMove).toHaveBeenCalledTimes(1)
    expect(onMove.mock.calls[0]?.[0]).toEqual(expect.objectContaining({ from: 'e2', to: 'e4' }))
    expect(onPositionChange).toHaveBeenCalledTimes(1)
  })

  it('does not traverse chess history again for a same-position rerender', () => {
    const chess = new Chess()
    for (const move of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']) chess.move(move)
    const position = chess.fen()
    const historySpy = vi.spyOn(chess, 'history')

    const view = render(
      <ChessBoard chess={chess} position={position} enableSounds={false} className="first" />,
    )
    const callsAfterMount = historySpy.mock.calls.length

    view.rerender(
      <ChessBoard chess={chess} position={position} enableSounds={false} className="second" />,
    )

    expect(historySpy).toHaveBeenCalledTimes(callsAfterMount)
  })

  it('updates board-owned moves without replaying the full native history', async () => {
    const chess = new Chess()
    for (const move of ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']) chess.move(move)
    const historySpy = vi.spyOn(chess, 'history')

    function Harness() {
      const [position, setPosition] = useState(chess.fen())
      return (
        <ChessBoard
          chess={chess}
          position={position}
          explorerMode="normal"
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    const callsAfterMount = historySpy.mock.calls.length

    fireEvent.click(view.container.querySelector('[data-square="b5"]')!)
    fireEvent.click(view.container.querySelector('[data-square="c6"]')!)
    await waitFor(() => expect(chess.get('c6')).toEqual(expect.objectContaining({ color: 'w', type: 'b' })))

    fireEvent.click(view.container.querySelector('[data-square="b7"]')!)
    fireEvent.click(view.container.querySelector('[data-square="c6"]')!)
    await waitFor(() => expect(chess.get('c6')?.color).toBe('b'))

    expect(historySpy).toHaveBeenCalledTimes(callsAfterMount)
  })

  it('does not allocate or preload Audio objects when sounds are disabled', () => {
    const pause = vi.fn()
    class AudioMock {
      currentTime = 0
      pause = pause
      play = vi.fn().mockResolvedValue(undefined)
      preload = ''
    }
    const audioConstructor = vi.spyOn(window, 'Audio').mockImplementation(
      AudioMock as unknown as typeof Audio,
    )
    const chess = new Chess()

    const view = render(
      <ChessBoard chess={chess} position={chess.fen()} enableSounds={false} />,
    )
    expect(audioConstructor).not.toHaveBeenCalled()

    view.rerender(<ChessBoard chess={chess} position={chess.fen()} enableSounds />)
    expect(audioConstructor).toHaveBeenCalledTimes(5)

    view.unmount()
    expect(pause).toHaveBeenCalledTimes(5)
  })

  it('renders strict premove mode for a legal en-passant FEN when planning the other side', () => {
    const fen = 'rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3'
    const chess = new Chess(fen)

    expect(() => render(
      <ChessBoard
        chess={chess}
        position={fen}
        playerColor="b"
        relaxedPremoveMode={false}
        enableSounds={false}
      />,
    )).not.toThrow()
  })

  it('clears the dependent premove queue when its first move is rejected', async () => {
    const chess = new Chess()
    const onPremoveReject = vi.fn()
    const onPremovesChange = vi.fn()

    function Harness() {
      const [position, setPosition] = useState(STARTING_FEN)
      const [premoves, setPremoves] = useState<PremoveState[]>([
        { from: 'a3', to: 'a4' },
        { from: 'e2', to: 'e4' },
      ])

      return (
        <ChessBoard
          chess={chess}
          position={position}
          premoves={premoves}
          onPremovesChange={(next) => {
            onPremovesChange(next)
            setPremoves(next)
          }}
          onPremoveReject={onPremoveReject}
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    render(<Harness />)

    await waitFor(() => expect(onPremoveReject).toHaveBeenCalledTimes(1))
    expect(onPremovesChange).toHaveBeenLastCalledWith([])
    expect(chess.history()).toEqual([])
  })

  it('cancels a right-drag without committing or leaving a live arrow active', () => {
    const chess = new Chess()
    const onLiveArrowChange = vi.fn()
    const onArrowCommit = vi.fn()
    const view = render(
      <ChessBoard
        chess={chess}
        position={chess.fen()}
        onLiveArrowChange={onLiveArrowChange}
        onArrowCommit={onArrowCommit}
        enableSounds={false}
      />,
    )
    const square = view.container.querySelector('[data-square="e4"]')
    expect(square).not.toBeNull()

    fireEvent(square!, createPointerEvent('pointerdown', {
      button: 2,
      clientX: 100,
      clientY: 100,
    }))
    fireEvent(window, createPointerEvent('pointercancel', {
      button: -1,
      clientX: 120,
      clientY: 120,
    }))

    expect(onLiveArrowChange).toHaveBeenNthCalledWith(1, { from: 'e4' })
    expect(onLiveArrowChange).toHaveBeenLastCalledWith(null)
    expect(onArrowCommit).not.toHaveBeenCalled()
  })

  it('keeps a navigable board timeline for off-turn god-mode moves', async () => {
    const chess = new Chess()
    chess.move('e4')
    const beforeSandboxMove = chess.fen()
    const boardRef = createRef<ChessBoardHandle>()

    function Harness() {
      const [position, setPosition] = useState(beforeSandboxMove)
      return (
        <ChessBoard
          ref={boardRef}
          chess={chess}
          position={position}
          explorerMode="god"
          moveBadges={[{ ply: 2, badge: { kind: 'best' } }]}
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    fireEvent.click(view.container.querySelector('[data-square="g1"]')!)
    fireEvent.click(view.container.querySelector('[data-square="f3"]')!)

    await waitFor(() => expect(view.getByAltText('Best move')).toBeTruthy())
    const afterSandboxMove = chess.fen()
    expect(afterSandboxMove).not.toBe(beforeSandboxMove)
    expect(boardRef.current?.canGoToPreviousMove()).toBe(true)

    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(beforeSandboxMove))
    expect(boardRef.current?.canGoToNextMove()).toBe(true)

    expect(boardRef.current?.goToNextMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(afterSandboxMove))
  })
})
