import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET() {
  const senders = backendStore.getSenders()
  return NextResponse.json({ data: senders })
}
