'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Search, Book, Target, Network, BarChart3, Settings, MessageSquare, CheckCircle, LayoutDashboard, User, HelpCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'

const navigation = [
  { name: 'Home', href: '/docs', icon: Book },
  { name: 'Getting Started', href: '/docs/getting-started', icon: HelpCircle },
  { name: 'Dashboard', href: '/docs/dashboard', icon: LayoutDashboard },
  { name: 'OKR Management', href: '/docs/okr-management', icon: Target },
  { name: 'Visual Builder', href: '/docs/visual-builder', icon: Network },
  { name: 'AI Assistant', href: '/docs/ai-assistant', icon: MessageSquare },
  { name: 'Check-ins', href: '/docs/check-ins', icon: CheckCircle },
  { name: 'Analytics', href: '/docs/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/docs/settings', icon: Settings },
]

const documentationPages = [
  { title: 'Getting Started', href: '/docs/getting-started', keywords: 'setup, registration, login, first steps' },
  { title: 'Dashboard', href: '/docs/dashboard', keywords: 'overview, metrics, health, organization' },
  { title: 'OKR Management', href: '/docs/okr-management', keywords: 'objectives, key results, initiatives, create, edit, delete' },
  { title: 'Visual Builder', href: '/docs/visual-builder', keywords: 'graph, flow, nodes, connections, alignment' },
  { title: 'AI Assistant', href: '/docs/ai-assistant', keywords: 'coach, cascade, analyst, chat, insights' },
  { title: 'Check-ins', href: '/docs/check-ins', keywords: 'updates, progress, cadence, team' },
  { title: 'Analytics', href: '/docs/analytics', keywords: 'reports, metrics, export, pillars, risk' },
  { title: 'Settings', href: '/docs/settings', keywords: 'organization, workspace, team, people, permissions' },
]

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<typeof documentationPages>([])
  const [showSearch, setShowSearch] = useState(false)

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setSearchResults([])
      return
    }

    const query = searchQuery.toLowerCase()
    const results = documentationPages.filter(
      page =>
        page.title.toLowerCase().includes(query) ||
        page.keywords.toLowerCase().includes(query)
    )
    setSearchResults(results)
  }, [searchQuery])

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Simple Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container flex h-16 items-center justify-between px-4">
          <Link href="/docs" className="flex items-center gap-2 font-semibold">
            <Book className="h-5 w-5 text-violet-600" />
            <span>OKR Nexus Docs</span>
          </Link>
          
          {/* Search */}
          <div className="relative flex-1 max-w-md ml-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <Input
                type="search"
                placeholder="Search documentation..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setShowSearch(true)}
                onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                className="pl-10 w-full"
              />
              {showSearch && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto">
                  {searchResults.map((result) => (
                    <Link
                      key={result.href}
                      href={result.href}
                      className="block px-4 py-3 hover:bg-neutral-50 border-b border-neutral-100 last:border-0"
                      onClick={() => {
                        setSearchQuery('')
                        setShowSearch(false)
                      }}
                    >
                      <div className="font-medium text-neutral-900">{result.title}</div>
                      <div className="text-xs text-neutral-500 mt-1">{result.keywords}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Link href="/dashboard" className="ml-4 text-sm text-neutral-600 hover:text-neutral-900">
            Back to App
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="sticky top-20 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      pathname === item.href
                        ? 'bg-violet-100 text-violet-900'
                        : 'text-neutral-700 hover:bg-neutral-100'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main Content */}
          <main className="flex-1 min-w-0">
            <div className="prose prose-neutral max-w-none">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}
