import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { scheduledAt } = await request.json()

  if (!scheduledAt) {
    return NextResponse.json({ error: 'scheduledAt is required' }, { status: 400 })
  }

  const updated = backendStore.updateEmail(id, {
    scheduledAt: new Date(scheduledAt).toISOString(),
    status: 'scheduled',
  })

  if (!updated) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, email: updated })
}
