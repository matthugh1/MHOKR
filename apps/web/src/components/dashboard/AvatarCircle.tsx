'use client'

/**
 * AvatarCircle - Simple avatar component showing user initials
 * Used in Execution Health and Operating Rhythm sections
 */
export interface AvatarCircleProps {
  name: string
  size?: 'sm' | 'md'
}

const colours = [
  'bg-violet-500',
  'bg-fuchsia-500',
  'bg-purple-500',
  'bg-indigo-500',
  'bg-pink-500',
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

function getColourForName(name: string): string {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colours[hash % colours.length]
}

export function AvatarCircle({ name, size = 'sm' }: AvatarCircleProps) {
  const initials = getInitials(name)
  const sizeClasses = size === 'sm' ? 'w-6 h-6 text-[10px]' : 'w-8 h-8 text-xs'
  const colour = getColourForName(name)

  return (
    <div
      className={`${sizeClasses} ${colour} rounded-full flex items-center justify-center text-white font-medium flex-shrink-0`}
    >
      {initials}
    </div>
  )
}

