/**
 * W4.M1: Taxonomy Alignment Tests
 * 
 * Tests for ObjectiveRow component focusing on:
 * - Status vs Publish State chip separation
 * - Visibility chip handling (not displayed per taxonomy)
 * - Removal of pillar UI
 */

import { render, screen } from '@testing-library/react'
import { ObjectiveRow } from './ObjectiveRow'

describe('ObjectiveRow - W4.M1 Taxonomy Alignment', () => {
  const mockObjective = {
    id: 'obj-1',
    title: 'Test Objective',
    status: 'ON_TRACK' as const,
    publishState: 'PUBLISHED' as const,
    isPublished: true,
    progress: 75,
    cycleName: 'Q4 2025',
    cycleLabel: 'Q4 2025',
    cycleStatus: 'ACTIVE',
    visibilityLevel: 'PUBLIC_TENANT',
    owner: {
      id: 'user-1',
      name: 'Test User',
      email: 'test@example.com',
    },
    keyResults: [],
    initiatives: [],
  }

  it('renders Status chip separately from Publish State chip', () => {
    render(
      <ObjectiveRow
        objective={mockObjective}
        isExpanded={false}
        onToggle={() => {}}
        onAddKeyResult={() => {}}
        onAddInitiative={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        canEdit={true}
        canDelete={true}
      />
    )

    // Status chip should be present
    expect(screen.getByText('On track')).toBeInTheDocument()
    
    // Publish State chip should be present and separate
    expect(screen.getByText('Published')).toBeInTheDocument()
  })

  it('derives publishState from isPublished when publishState not provided', () => {
    const draftObjective = {
      ...mockObjective,
      publishState: undefined,
      isPublished: false,
    }

    render(
      <ObjectiveRow
        objective={draftObjective}
        isExpanded={false}
        onToggle={() => {}}
        onAddKeyResult={() => {}}
        onAddInitiative={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        canEdit={true}
        canDelete={true}
      />
    )

    // Should show Draft chip
    expect(screen.getByText('Draft')).toBeInTheDocument()
  })

  it('does not display visibility chip (server-enforced)', () => {
    const privateObjective = {
      ...mockObjective,
      visibilityLevel: 'PRIVATE',
    }

    render(
      <ObjectiveRow
        objective={privateObjective}
        isExpanded={false}
        onToggle={() => {}}
        onAddKeyResult={() => {}}
        onAddInitiative={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        canEdit={true}
        canDelete={true}
      />
    )

    // Visibility should NOT be displayed as badge (per taxonomy decisions)
    expect(screen.queryByText('Private')).not.toBeInTheDocument()
    expect(screen.queryByText('PUBLIC_TENANT')).not.toBeInTheDocument()
  })

  it('does not display pillar badge (deprecated)', () => {
    render(
      <ObjectiveRow
        objective={mockObjective}
        isExpanded={false}
        onToggle={() => {}}
        onAddKeyResult={() => {}}
        onAddInitiative={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        canEdit={true}
        canDelete={true}
      />
    )

    // Pillar should not be displayed
    expect(screen.queryByText(/pillar/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/strategic/i)).not.toBeInTheDocument()
  })
})

