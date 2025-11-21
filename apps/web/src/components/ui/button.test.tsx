import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import { Button } from './button'

describe('Button', () => {
    it('renders correctly', () => {
        render(<Button>Click me</Button>)
        expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
    })

    it('handles click events', () => {
        const handleClick = jest.fn()
        render(<Button onClick={handleClick}>Click me</Button>)
        fireEvent.click(screen.getByRole('button', { name: /click me/i }))
        expect(handleClick).toHaveBeenCalledTimes(1)
    })

    it('renders as disabled when disabled prop is passed', () => {
        render(<Button disabled>Click me</Button>)
        expect(screen.getByRole('button', { name: /click me/i })).toBeDisabled()
    })
})
