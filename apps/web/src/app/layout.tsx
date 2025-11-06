import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { VersionLogger } from '@/components/VersionLogger'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'OKR Nexus',
  description: 'AI-first OKR platform with visual builder and intelligent assistance',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          <VersionLogger />
          {children}
        </Providers>
      </body>
    </html>
  )
}






