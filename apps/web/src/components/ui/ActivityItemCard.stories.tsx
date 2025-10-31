// Storybook types - uncomment when @storybook/react is installed
// import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { ActivityItemCard } from './ActivityItemCard'

// Placeholder types for Storybook readiness (install @storybook/react to enable)
type Meta<T> = { title: string; component: T; parameters?: Record<string, unknown>; tags?: string[] }
type StoryObj<T> = { args?: Partial<React.ComponentProps<T>> }

const meta: Meta<typeof ActivityItemCard> = {
  title: 'UI/ActivityItemCard',
  component: ActivityItemCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ActivityItemCard>

export const CheckIn: Story = {
  args: {
    actorName: 'John Doe',
    timestamp: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    action: 'CHECK_IN',
    summary: 'Check-in: value 75, confidence 4/5',
  },
}

export const Updated: Story = {
  args: {
    actorName: 'Jane Smith',
    timestamp: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
    action: 'UPDATED',
    summary: 'Progress 45% → 60%, Status ON_TRACK → AT_RISK',
  },
}

export const Recent: Story = {
  args: {
    actorName: 'Alex Johnson',
    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    action: 'CREATED',
    summary: 'Created new key result',
  },
}

export const OldActivity: Story = {
  args: {
    actorName: 'Sam Wilson',
    timestamp: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    action: 'UPDATED',
    summary: 'Target 80 → 95',
  },
}

