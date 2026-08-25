import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { App } from '../../src/App.js'

describe('UI-01: TokTickIT heading', () => {
  it('renders the TokTickIT heading', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument()
  })
})
