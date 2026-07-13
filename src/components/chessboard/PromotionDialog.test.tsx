import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PromotionDialog } from './PromotionDialog'

describe('PromotionDialog', () => {
  it('anchors the queen choice to a bottom-edge promotion square', () => {
    const onSelect = vi.fn()
    const view = render(
      <PromotionDialog
        pending={{ from: 'a2', to: 'a1' }}
        playerColor="b"
        squareSize={64}
        boardSize={512}
        isFlipped={false}
        onSelect={onSelect}
      />,
    )

    const choices = view.getAllByRole('button')
    expect(choices.map((choice) => choice.getAttribute('aria-label'))).toEqual([
      'Promote to N',
      'Promote to B',
      'Promote to R',
      'Promote to Q',
    ])

    fireEvent.click(choices[3])
    expect(onSelect).toHaveBeenCalledWith('q')
  })
})
