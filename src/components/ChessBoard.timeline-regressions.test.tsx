import React, { createRef, useLayoutEffect, useState } from 'react'
import { Chess } from 'chess.js'
import { act, fireEvent, render, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import ChessBoard, { getChessBoardHistory } from './ChessBoard'
import type { ChessBoardHandle } from './ChessBoard'

const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'

function GodBoardHarness({
  chess,
  initialPosition,
  boardRef,
}: {
  chess: Chess
  initialPosition: string
  boardRef: React.RefObject<ChessBoardHandle | null>
}) {
  const [position, setPosition] = useState(initialPosition)

  return (
    <ChessBoard
      ref={boardRef}
      chess={chess}
      position={position}
      explorerMode="god"
      onPositionChange={setPosition}
      enableSounds={false}
    />
  )
}

async function playOffTurnKnightMove(container: HTMLElement, chess: Chess, before: string) {
  fireEvent.click(container.querySelector('[data-square="g1"]')!)
  fireEvent.click(container.querySelector('[data-square="f3"]')!)
  await waitFor(() => expect(chess.fen()).not.toBe(before))
}

describe('ChessBoard timeline and premove edge regressions', () => {
  it('keeps native chess.js history intact for standard previous/next navigation', async () => {
    const chess = new Chess()
    chess.move('e4')
    chess.move('e5')
    const boardRef = createRef<ChessBoardHandle>()

    function Harness() {
      const [position, setPosition] = useState(chess.fen())
      return (
        <ChessBoard
          ref={boardRef}
          chess={chess}
          position={position}
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    render(<Harness />)
    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.history()).toEqual(['e4']))
    expect(boardRef.current?.getCurrentPly()).toBe(1)

    expect(boardRef.current?.goToNextMove()).toBe(true)
    await waitFor(() => expect(chess.history()).toEqual(['e4', 'e5']))
    expect(boardRef.current?.getCurrentPly()).toBe(2)
  })

  it('preserves a god-mode timeline across unmount and remount with the same Chess instance', async () => {
    const chess = new Chess()
    chess.move('e4')
    const beforeSandboxMove = chess.fen()
    const firstRef = createRef<ChessBoardHandle>()

    const firstView = render(
      <GodBoardHarness
        chess={chess}
        initialPosition={beforeSandboxMove}
        boardRef={firstRef}
      />,
    )
    await playOffTurnKnightMove(firstView.container, chess, beforeSandboxMove)
    const afterSandboxMove = chess.fen()
    expect(firstRef.current?.canGoToPreviousMove()).toBe(true)

    firstView.unmount()

    const secondRef = createRef<ChessBoardHandle>()
    render(
      <GodBoardHarness
        chess={chess}
        initialPosition={afterSandboxMove}
        boardRef={secondRef}
      />,
    )

    expect(secondRef.current?.canGoToPreviousMove()).toBe(true)
    expect(secondRef.current?.getCurrentPly()).toBe(2)
    expect(secondRef.current?.getHistory().map((move) => move.san)).toEqual(['e4', 'Nf3'])
    expect(secondRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(beforeSandboxMove))
  })

  it('supplies synthetic god-mode history to host callbacks and the public helper', async () => {
    const chess = new Chess()
    chess.move('e4')
    const beforeSandboxMove = chess.fen()
    const onMove = vi.fn()
    const onHistoryChange = vi.fn()
    const onPositionChange = vi.fn()

    function Harness() {
      const [position, setPosition] = useState(beforeSandboxMove)
      return (
        <ChessBoard
          chess={chess}
          position={position}
          explorerMode="god"
          onMove={onMove}
          onHistoryChange={onHistoryChange}
          onPositionChange={(fen, move, history) => {
            onPositionChange(fen, move, history)
            setPosition(fen)
          }}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    await playOffTurnKnightMove(view.container, chess, beforeSandboxMove)

    expect(chess.history()).toEqual([])
    expect(getChessBoardHistory(chess).map((move) => move.san)).toEqual(['e4', 'Nf3'])
    expect(onMove.mock.calls[0]?.[1]).toHaveLength(2)
    expect(onHistoryChange).toHaveBeenLastCalledWith(expect.arrayContaining([
      expect.objectContaining({ san: 'e4' }),
      expect.objectContaining({ san: 'Nf3' }),
    ]))
    expect(onPositionChange.mock.calls[0]?.[2]).toHaveLength(2)
  })

  it('appends two externally applied moves delivered in one position rerender', async () => {
    const chess = new Chess()
    chess.move('e4')
    const beforeSandboxMove = chess.fen()
    const boardRef = createRef<ChessBoardHandle>()
    let setHostPosition: React.Dispatch<React.SetStateAction<string>> = () => undefined

    function Harness() {
      const [position, setPosition] = useState(beforeSandboxMove)
      setHostPosition = setPosition
      return (
        <ChessBoard
          ref={boardRef}
          chess={chess}
          position={position}
          explorerMode="god"
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    await playOffTurnKnightMove(view.container, chess, beforeSandboxMove)
    const afterSandboxMove = chess.fen()

    let afterFirstExternalMove = ''
    act(() => {
      chess.move('e5')
      afterFirstExternalMove = chess.fen()
      chess.move('Bb5')
      setHostPosition(chess.fen())
    })

    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(afterFirstExternalMove))

    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(afterSandboxMove))

    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(beforeSandboxMove))
  })

  it('drops a synthetic timeline when the host starts a new game on the same Chess instance', async () => {
    const chess = new Chess()
    chess.move('e4')
    const beforeSandboxMove = chess.fen()
    const boardRef = createRef<ChessBoardHandle>()
    let setHostPosition: React.Dispatch<React.SetStateAction<string>> = () => undefined

    function Harness() {
      const [position, setPosition] = useState(beforeSandboxMove)
      setHostPosition = setPosition
      return (
        <ChessBoard
          ref={boardRef}
          chess={chess}
          position={position}
          explorerMode="god"
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    await playOffTurnKnightMove(view.container, chess, beforeSandboxMove)
    expect(boardRef.current?.getCurrentPly()).toBe(2)

    act(() => {
      chess.reset()
      setHostPosition(chess.fen())
    })

    expect(boardRef.current?.getHistory()).toEqual([])
    expect(boardRef.current?.canGoToNextMove()).toBe(false)
    expect(getChessBoardHistory(chess)).toEqual([])
  })

  it('preserves the synthetic prefix when the host undoes an external continuation', async () => {
    const chess = new Chess()
    chess.move('e4')
    const beforeSandboxMove = chess.fen()
    const boardRef = createRef<ChessBoardHandle>()
    let setHostPosition: React.Dispatch<React.SetStateAction<string>> = () => undefined

    function Harness() {
      const [position, setPosition] = useState(beforeSandboxMove)
      setHostPosition = setPosition
      return (
        <ChessBoard
          ref={boardRef}
          chess={chess}
          position={position}
          explorerMode="god"
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    const view = render(<Harness />)
    await playOffTurnKnightMove(view.container, chess, beforeSandboxMove)
    const afterSandboxMove = chess.fen()

    act(() => {
      chess.move('e5')
      chess.move('Bb5')
      setHostPosition(chess.fen())
    })
    expect(boardRef.current?.getCurrentPly()).toBe(4)

    act(() => {
      chess.undo()
      chess.undo()
      setHostPosition(chess.fen())
    })

    expect(chess.fen()).toBe(afterSandboxMove)
    expect(boardRef.current?.getHistory().map((move) => move.san)).toEqual(['e4', 'Nf3'])
    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(beforeSandboxMove))
  })

  it('does not replay a stale redo move after an external load', async () => {
    const chess = new Chess()
    chess.move('e4')
    const positionAfterE4 = chess.fen()
    const externalFen = '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1'
    const boardRef = createRef<ChessBoardHandle>()
    const redoAttempt = vi.fn()
    let setHostPosition: React.Dispatch<React.SetStateAction<string>> = () => undefined

    function Harness() {
      const [position, setPosition] = useState(positionAfterE4)
      setHostPosition = setPosition

      useLayoutEffect(() => {
        if (position !== externalFen) return
        redoAttempt(
          boardRef.current?.canGoToNextMove(),
          boardRef.current?.goToNextMove(),
        )
      }, [position])

      return (
        <ChessBoard
          ref={boardRef}
          chess={chess}
          position={position}
          onPositionChange={setPosition}
          enableSounds={false}
        />
      )
    }

    render(<Harness />)
    expect(boardRef.current?.goToPreviousMove()).toBe(true)
    await waitFor(() => expect(chess.fen()).toBe(STARTING_FEN))

    act(() => {
      chess.load(externalFen)
      setHostPosition(externalFen)
    })

    expect(redoAttempt).toHaveBeenCalledWith(false, false)
    expect(chess.fen()).toBe(externalFen)
  })

  it('does not open promotion UI for a premove rejected by the custom validator', () => {
    const fen = 'k7/4P3/8/8/8/8/8/7K b - - 0 1'
    const chess = new Chess(fen)
    const canQueuePremove = vi.fn(() => false)
    const view = render(
      <ChessBoard
        chess={chess}
        position={fen}
        playerColor="w"
        canQueuePremove={canQueuePremove}
        enableSounds={false}
      />,
    )

    fireEvent.click(view.container.querySelector('[data-square="e7"]')!)
    fireEvent.click(view.container.querySelector('[data-square="e8"]')!)

    expect(view.queryByRole('button', { name: 'Promote to Q' })).toBeNull()
    expect(canQueuePremove).toHaveBeenCalled()
  })
})
