// Storybook types - uncomment when @storybook/react is installed
// import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { SectionHeader } from './SectionHeader'

// Placeholder types for Storybook readiness (install @storybook/react to enable)
type Meta<T> = { title: string; component: T; parameters?: Record<string, unknown>; tags?: string[] }
type StoryObj<T extends keyof React.JSX.IntrinsicElements | React.JSXElementConstructor<any>> = { args?: Partial<React.ComponentProps<T>> }

const meta: Meta<typeof SectionHeader> = {
  title: 'UI/SectionHeader',
  component: SectionHeader,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof SectionHeader>

export const Default: Story = {
  args: {
    title: 'Recent Activity',
    subtitle: 'Last 10 check-ins',
  },
}

export const WithoutSubtitle: Story = {
  args: {
    title: 'Strategic Coverage',
  },
}

export const WithLongText: Story = {
  args: {
    title: 'Execution Risk',
    subtitle: 'Key Results overdue for check-in',
  },
}

