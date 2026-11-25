import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET(request: Request) {
  backendStore.updateSlack({
    connected: true,
    channel: '#reachinbox-alerts',
    team: 'ReachInbox Workspace',
    webhookUrl: 'https://hooks.slack.com/services/DEMO/WEBHOOK/URL',
  })
  const url = new URL('/settings?slack=connected', request.url)
  return NextResponse.redirect(url)
}
