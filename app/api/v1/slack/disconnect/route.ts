import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function DELETE() {
  backendStore.updateSlack({
    connected: false,
    webhookUrl: undefined,
  })
  return NextResponse.json({ success: true, message: 'Slack disconnected' })
}
