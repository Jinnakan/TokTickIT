import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SystemStatusCheck } from '../../src/components/SystemStatusCheck.js'

describe('UI-01: TokTickIT heading', () => {
  it('renders the TokTickIT heading', () => {
    render(<SystemStatusCheck />)

    expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument()
  })
})
