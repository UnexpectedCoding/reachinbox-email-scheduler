import { api } from '@/lib/api'

export function getSlackStatus() {
  return api<{ connected: boolean; channel?: string; team?: string }>('/slack/status')
}

export function disconnectSlack() {
  return api('/slack/disconnect', { method: 'DELETE' })
}

export function slackOAuthUrl() {
  return `${process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'}/slack/demo-connect`
}
