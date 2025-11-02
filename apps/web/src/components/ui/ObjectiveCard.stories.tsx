// Storybook types - uncomment when @storybook/react is installed
// import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { ObjectiveCard } from './ObjectiveCard'

// Placeholder types for Storybook readiness (install @storybook/react to enable)
type Meta<T> = { title: string; component: T; parameters?: Record<string, unknown>; tags?: string[] }
type StoryObj<T extends keyof React.JSX.IntrinsicElements | React.JSXElementConstructor<any>> = { args?: Partial<React.ComponentProps<T>> }

const meta: Meta<typeof ObjectiveCard> = {
  title: 'UI/ObjectiveCard',
  component: ObjectiveCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof ObjectiveCard>

export const OnTrack: Story = {
  args: {
    title: 'Increase Customer Satisfaction',
    ownerName: 'John Doe',
    status: 'ON_TRACK',
    progressPct: 75,
    isPublished: false,
    canEdit: true,
    canDelete: true,
  },
}

export const AtRisk: Story = {
  args: {
    title: 'Launch New Product Feature',
    ownerName: 'Jane Smith',
    status: 'AT_RISK',
    progressPct: 45,
    isPublished: true,
    nextCheckInDue: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    canEdit: false,
    canDelete: false,
  },
}

export const OffTrack: Story = {
  args: {
    title: 'Reduce Technical Debt',
    ownerName: 'Alex Johnson',
    status: 'OFF_TRACK',
    progressPct: 25,
    isPublished: false,
    canEdit: true,
    canDelete: true,
  },
}

export const Completed: Story = {
  args: {
    title: 'Improve Team Velocity',
    ownerName: 'Sam Wilson',
    status: 'COMPLETED',
    progressPct: 100,
    isPublished: true,
    canEdit: false,
    canDelete: false,
  },
}

export const WithAvatar: Story = {
  args: {
    title: 'Increase Revenue by 20%',
    ownerName: 'Chris Lee',
    ownerAvatarUrl: 'https://i.pravatar.cc/150?img=12',
    status: 'ON_TRACK',
    progressPct: 80,
    isPublished: false,
    canEdit: true,
    canDelete: true,
  },
}

