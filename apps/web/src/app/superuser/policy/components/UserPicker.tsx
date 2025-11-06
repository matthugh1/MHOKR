'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface User {
  id: string
  name: string
  email: string
}

interface UserPickerProps {
  value: string
  onChange: (userId: string) => void
  tenantId?: string
}

export function UserPicker({ value, onChange, tenantId }: UserPickerProps) {
  const [open, setOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const loadUsers = useCallback(async () => {
    setLoading(true)
    try {
      // For superusers, fetch all users (backend doesn't support organizationId filter)
      const response = await api.get('/users?limit=1000')
      let allUsers = response.data || []
      
      // If tenantId is provided, filter users by checking their role assignments
      if (tenantId) {
        // Fetch role assignments for this tenant
        try {
          const assignmentsResponse = await api.get(`/rbac/assignments?scopeType=TENANT&scopeId=${tenantId}`)
          const userIds = new Set(
            (assignmentsResponse.data || []).map((a: any) => a.userId)
          )
          allUsers = allUsers.filter((u: User) => userIds.has(u.id))
        } catch (error) {
          console.error('Failed to filter users by tenant:', error)
          // If filtering fails, show all users
        }
      }
      
      setUsers(allUsers)
    } catch (error) {
      console.error('Failed to load users:', error)
    } finally {
      setLoading(false)
    }
  }, [tenantId])

  useEffect(() => {
    if (open) {
      loadUsers()
    }
  }, [open, loadUsers])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Reload users when tenantId changes (even if dropdown is closed)
  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  const selectedUser = users.find(u => u.id === value)

  const filteredUsers = users.filter(user =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <Label htmlFor="user-picker">User</Label>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
      >
        {selectedUser
          ? `${selectedUser.name} (${selectedUser.email})`
          : 'Select user...'}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
          <div className="p-2 border-b">
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No users found.
              </div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    onChange(user.id)
                    setOpen(false)
                    setSearchQuery('')
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2',
                    value === user.id && 'bg-slate-50'
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === user.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{user.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{user.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

