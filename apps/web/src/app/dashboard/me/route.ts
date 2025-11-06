import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const url = new URL('/dashboard', request.url)
  return NextResponse.redirect(url, 308)
}

export async function HEAD(request: NextRequest) {
  const url = new URL('/dashboard', request.url)
  return NextResponse.redirect(url, 308)
}

