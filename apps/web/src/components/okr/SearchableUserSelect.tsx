'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface User {
  id: string
  name: string
  email?: string | null
}

interface SearchableUserSelectProps {
  value: string
  onValueChange: (value: string) => void
  availableUsers: User[]
  placeholder?: string
  disabled?: boolean
  id?: string
  required?: boolean
}

export function SearchableUserSelect({
  value,
  onValueChange,
  availableUsers,
  placeholder = 'Select owner',
  disabled = false,
  id,
  required = false,
}: SearchableUserSelectProps) {
  const [open, setOpen] = React.useState(false)

  const selectedUser = availableUsers.find((user) => user.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !selectedUser && 'text-muted-foreground'
          )}
          disabled={disabled}
          id={id}
          type="button"
        >
          {selectedUser
            ? selectedUser.name || selectedUser.email || selectedUser.id
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search users..." />
          <CommandList>
            <CommandEmpty>No users found.</CommandEmpty>
            <CommandGroup>
              {availableUsers.map((user) => (
                <CommandItem
                  key={user.id}
                  value={`${user.name} ${user.email || ''}`}
                  onSelect={() => {
                    onValueChange(user.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === user.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex flex-col">
                    <span>{user.name || user.email || user.id}</span>
                    {user.email && user.name && (
                      <span className="text-xs text-muted-foreground">
                        {user.email}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

