// Storybook types - uncomment when @storybook/react is installed
// import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { StatCard } from './StatCard'

// Placeholder types for Storybook readiness (install @storybook/react to enable)
type Meta<T> = { title: string; component: T; parameters?: Record<string, unknown>; tags?: string[] }
type StoryObj<T> = { args?: Partial<React.ComponentProps<T>> }

const meta: Meta<typeof StatCard> = {
  title: 'UI/StatCard',
  component: StatCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof StatCard>

export const Default: Story = {
  args: {
    title: 'Total Objectives',
    value: 42,
    subtitle: '12 on track',
  },
}

export const WithPercentage: Story = {
  args: {
    title: '% On Track',
    value: '75%',
    subtitle: '30 of 40 objectives',
  },
}

export const WithEmDash: Story = {
  args: {
    title: 'Overdue Check-ins',
    value: '—',
    subtitle: undefined,
  },
}

export const WithReactNode: Story = {
  args: {
    title: 'Status Breakdown',
    value: '30 / 8 / 2',
    subtitle: 'On Track / At Risk / Off Track',
  },
}

