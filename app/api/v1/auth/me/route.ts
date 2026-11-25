import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET() {
  const user = backendStore.getUser()
  return NextResponse.json({
    authenticated: Boolean(user),
    user,
  })
}
