import { createRef } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { Chess } from 'chess.js'
import { describe, expect, it, vi } from 'vitest'
import ChessBoard from './ChessBoard'
import type { ChessBoardHandle } from './ChessBoard'

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

function boardRect(size: number, left = 0, top = 0): DOMRect {
  return {
    x: left,
    y: top,
    top,
    right: left + size,
    bottom: top + size,
    left,
    width: size,
    height: size,
    toJSON: () => ({}),
  }
}

async function flushAnimationFrame() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('ChessBoard interaction performance regressions', () => {
  it('uses the latest size and callback after a mid-gesture rerender', async () => {
    const chess = new Chess()
    const firstLiveArrowCallback = vi.fn()
    const latestLiveArrowCallback = vi.fn()

    const view = render(
      <ChessBoard
        chess={chess}
        position={chess.fen()}
        boardSize={320}
        onLiveArrowChange={firstLiveArrowCallback}
        enableSounds={false}
      />,
    )

    const fromSquare = view.container.querySelector<HTMLElement>('[data-square="e4"]')
    expect(fromSquare).not.toBeNull()
    const board = fromSquare!.parentElement
    expect(board).not.toBeNull()
    const boardRectSpy = vi.spyOn(board!, 'getBoundingClientRect').mockReturnValue(boardRect(320))

    fireEvent(fromSquare!, createPointerEvent('pointerdown', {
      button: 2,
      clientX: 20,
      clientY: 20,
    }))
    await flushAnimationFrame()

    view.rerender(
      <ChessBoard
        chess={chess}
        position={chess.fen()}
        boardSize={640}
        onLiveArrowChange={latestLiveArrowCallback}
        enableSounds={false}
      />,
    )
    boardRectSpy.mockReturnValue(boardRect(640, 100, 100))
    await flushAnimationFrame()

    firstLiveArrowCallback.mockClear()
    latestLiveArrowCallback.mockClear()

    fireEvent(window, createPointerEvent('pointermove', {
      clientX: 220,
      clientY: 220,
    }))
    await flushAnimationFrame()

    // At 640px with a 100px layout shift, (220, 220) is b7. Reusing either
    // the initial size or the pointerdown rectangle resolves a different square.
    expect(firstLiveArrowCallback).not.toHaveBeenCalled()
    expect(latestLiveArrowCallback).toHaveBeenLastCalledWith({ from: 'e4', to: 'b7' })
  })

  it('cancels an active live arrow when orientation changes imperatively', async () => {
    const chess = new Chess()
    const boardRef = createRef<ChessBoardHandle>()
    const onLiveArrowChange = vi.fn()
    const onArrowCommit = vi.fn()

    const view = render(
      <ChessBoard
        ref={boardRef}
        chess={chess}
        position={chess.fen()}
        boardSize={320}
        onLiveArrowChange={onLiveArrowChange}
        onArrowCommit={onArrowCommit}
        enableSounds={false}
      />,
    )

    const fromSquare = view.container.querySelector<HTMLElement>('[data-square="e4"]')
    expect(fromSquare).not.toBeNull()
    const board = fromSquare!.parentElement
    expect(board).not.toBeNull()
    vi.spyOn(board!, 'getBoundingClientRect').mockReturnValue(boardRect(320))

    fireEvent(fromSquare!, createPointerEvent('pointerdown', {
      button: 2,
      clientX: 20,
      clientY: 20,
    }))
    await flushAnimationFrame()

    act(() => boardRef.current?.flipBoard())
    await flushAnimationFrame()

    expect(boardRef.current?.isFlipped()).toBe(true)
    expect(onLiveArrowChange).toHaveBeenLastCalledWith(null)

    onLiveArrowChange.mockClear()
    fireEvent(window, createPointerEvent('pointermove', {
      clientX: 120,
      clientY: 120,
    }))
    await flushAnimationFrame()
    fireEvent(window, createPointerEvent('pointerup', {
      button: 2,
      clientX: 120,
      clientY: 120,
    }))

    expect(onLiveArrowChange).not.toHaveBeenCalled()
    expect(onArrowCommit).not.toHaveBeenCalled()
  })

  it('invokes the latest move callback after a callback-only parent rerender', () => {
    const chess = new Chess()
    const position = chess.fen()
    const firstMoveCallback = vi.fn()
    const latestMoveCallback = vi.fn()

    const view = render(
      <ChessBoard
        chess={chess}
        position={position}
        onMove={firstMoveCallback}
        enableSounds={false}
      />,
    )

    view.rerender(
      <ChessBoard
        chess={chess}
        position={position}
        onMove={latestMoveCallback}
        enableSounds={false}
      />,
    )

    fireEvent.click(view.container.querySelector('[data-square="e2"]')!)
    fireEvent.click(view.container.querySelector('[data-square="e4"]')!)

    expect(firstMoveCallback).not.toHaveBeenCalled()
    expect(latestMoveCallback).toHaveBeenCalledTimes(1)
    expect(latestMoveCallback.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ from: 'e2', to: 'e4' }),
    )
  })

  it('does not create a ResizeObserver when board size is controlled', () => {
    const originalResizeObserver = globalThis.ResizeObserver
    const resizeObserverConstructor = vi.fn()

    class ResizeObserverProbe {
      constructor(_callback: ResizeObserverCallback) {
        resizeObserverConstructor()
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal('ResizeObserver', ResizeObserverProbe)
    let view: ReturnType<typeof render> | undefined

    try {
      const chess = new Chess()
      view = render(
        <ChessBoard
          chess={chess}
          position={chess.fen()}
          boardSize={320}
          fillContainer
          enableSounds={false}
        />,
      )

      expect(resizeObserverConstructor).not.toHaveBeenCalled()
    } finally {
      view?.unmount()
      vi.stubGlobal('ResizeObserver', originalResizeObserver)
    }
  })
})
