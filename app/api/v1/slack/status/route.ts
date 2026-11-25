import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET() {
  const slack = backendStore.getSlack()
  return NextResponse.json({
    connected: slack.connected,
    channel: slack.channel,
    team: slack.team,
  })
}
