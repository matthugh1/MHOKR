/**
 * W4.M1: Creation Drawer Tests
 * 
 * Tests for OKRCreationDrawer STEP A skeleton:
 * - Drawer opens/closes correctly
 * - STEP A form fields render
 * - Submit disabled with helper text
 */

import { render, screen, fireEvent } from '@testing-library/react'
import { OKRCreationDrawer } from './OKRCreationDrawer'

describe('OKRCreationDrawer - W4.M1 STEP A Skeleton', () => {
  const mockProps = {
    isOpen: true,
    onClose: jest.fn(),
    availableUsers: [
      { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    ],
    activeCycles: [
      { id: 'cycle-1', name: 'Q4 2025', status: 'ACTIVE' },
    ],
    currentOrganization: { id: 'org-1' },
    onSuccess: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders drawer when open', () => {
    render(<OKRCreationDrawer {...mockProps} />)
    
    expect(screen.getByText('Create New Objective')).toBeInTheDocument()
  })

  it('renders STEP A form fields', () => {
    render(<OKRCreationDrawer {...mockProps} />)
    
    // Title field
    expect(screen.getByLabelText(/Objective Title/i)).toBeInTheDocument()
    
    // Owner field
    expect(screen.getByLabelText(/Owner/i)).toBeInTheDocument()
    
    // Cycle field (not "Cycle / Time Period")
    expect(screen.getByLabelText(/^Cycle$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/Time Period/i)).not.toBeInTheDocument()
  })

  it('shows helper text about publishing arriving in W5.M1', () => {
    render(<OKRCreationDrawer {...mockProps} />)
    
    expect(screen.getByText('Publishing arrives in W5.M1')).toBeInTheDocument()
  })

  it('calls onClose when Cancel is clicked', () => {
    render(<OKRCreationDrawer {...mockProps} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockProps.onClose).toHaveBeenCalledTimes(1)
  })

  it('does not render pillar field (deprecated)', () => {
    render(<OKRCreationDrawer {...mockProps} />)
    
    expect(screen.queryByLabelText(/pillar/i)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/strategic/i)).not.toBeInTheDocument()
  })
})




