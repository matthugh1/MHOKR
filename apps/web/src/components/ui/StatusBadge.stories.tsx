// Storybook types - uncomment when @storybook/react is installed
// import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { StatusBadge } from './StatusBadge'

// Placeholder types for Storybook readiness (install @storybook/react to enable)
type Meta<T> = { title: string; component: T; parameters?: Record<string, unknown>; tags?: string[] }
type StoryObj<T> = { args?: Partial<React.ComponentProps<T>> }

const meta: Meta<typeof StatusBadge> = {
  title: 'UI/StatusBadge',
  component: StatusBadge,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof StatusBadge>

export const OnTrack: Story = {
  args: {
    status: 'ON_TRACK',
  },
}

export const AtRisk: Story = {
  args: {
    status: 'AT_RISK',
  },
}

export const OffTrack: Story = {
  args: {
    status: 'OFF_TRACK',
  },
}

export const Completed: Story = {
  args: {
    status: 'COMPLETED',
  },
}

export const Cancelled: Story = {
  args: {
    status: 'CANCELLED',
  },
}

