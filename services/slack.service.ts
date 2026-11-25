import { api } from '@/lib/api'
export function getSlackStatus() { return api<{connected:boolean}>('/slack/status') }
export function disconnectSlack() { return api('/slack/disconnect',{method:'DELETE'}) }
export function slackOAuthUrl() { return `${process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1'}/slack/oauth` }
