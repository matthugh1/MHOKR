'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Check, ChevronsUpDown, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import api from '@/lib/api'

interface Organization {
  id: string
  name: string
  slug: string
}

interface TenantSelectorProps {
  value: string
  onChange: (tenantId: string) => void
}

export function TenantSelector({ value, onChange }: TenantSelectorProps) {
  const [open, setOpen] = useState(false)
  const [organizations, setOrganizations] = useState<Organization[]>([])
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      loadOrganizations()
    }
  }, [open])

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

  const loadOrganizations = async () => {
    setLoading(true)
    try {
      const response = await api.get('/organizations')
      setOrganizations(response.data || [])
    } catch (error) {
      console.error('Failed to load organizations:', error)
    } finally {
      setLoading(false)
    }
  }

  const selectedOrg = organizations.find(o => o.id === value)

  const filteredOrgs = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.slug.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-2 relative" ref={dropdownRef}>
      <Label htmlFor="tenant-selector">Filter by Tenant (Optional)</Label>
      <Button
        variant="outline"
        role="combobox"
        aria-expanded={open}
        className="w-full justify-between"
        onClick={() => setOpen(!open)}
      >
        {selectedOrg
          ? (
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span>{selectedOrg.name}</span>
            </div>
          )
          : (
            <span className="text-muted-foreground">All tenants</span>
          )}
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
      
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-input rounded-md shadow-lg">
          <div className="p-2 border-b">
            <Input
              placeholder="Search tenants..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto">
            <button
              onClick={() => {
                onChange('')
                setOpen(false)
                setSearchQuery('')
              }}
              className={cn(
                'w-full px-3 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2',
                !value && 'bg-slate-50'
              )}
            >
              <Check
                className={cn(
                  'h-4 w-4 shrink-0',
                  !value ? 'opacity-100' : 'opacity-0'
                )}
              />
              <span className="text-muted-foreground">All tenants</span>
            </button>
            {loading ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                Loading tenants...
              </div>
            ) : filteredOrgs.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground text-center">
                No tenants found.
              </div>
            ) : (
              filteredOrgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => {
                    onChange(org.id)
                    setOpen(false)
                    setSearchQuery('')
                  }}
                  className={cn(
                    'w-full px-3 py-2 text-left text-sm hover:bg-slate-100 flex items-center gap-2',
                    value === org.id && 'bg-slate-50'
                  )}
                >
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      value === org.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <Building2 className="h-4 w-4 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate font-medium">{org.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{org.slug}</div>
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

