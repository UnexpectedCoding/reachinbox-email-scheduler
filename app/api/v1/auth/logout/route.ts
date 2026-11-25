import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function POST() {
  backendStore.setUser(null)
  return NextResponse.json({ success: true, message: 'Logged out' })
}
