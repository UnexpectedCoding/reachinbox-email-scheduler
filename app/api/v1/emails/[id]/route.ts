import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const email = backendStore.getEmailById(id)
  if (!email) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }
  return NextResponse.json(email)
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  backendStore.deleteEmail(id)
  return NextResponse.json({ success: true, message: 'Email cancelled' })
}
