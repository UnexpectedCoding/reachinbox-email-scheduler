import axios from 'axios'
import { config } from '../config/env'
import { db } from '../db'

export async function sendSlackRateLimitAlert(params: {
  senderEmail: string
  hourlyLimit: number
  currentCount: number
  hourWindow: string
  rescheduledTo: Date
}): Promise<boolean> {
  const integration = await db.getSlackIntegration()
  const targetWebhook = integration?.webhookUrl || config.slack.webhookUrl

  if (!targetWebhook && !integration?.accessToken) {
    console.log(`ℹ️ Slack alert skipped for ${params.senderEmail} (Slack is not connected).`)
    return false
  }

  const messagePayload = {
    text: `⚠️ *Hourly Rate Limit Reached* for sender \`${params.senderEmail}\``,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '⚠️ ReachInbox: Sender Rate Limit Exceeded',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender:*\n\`${params.senderEmail}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Hourly Limit:*\n${params.hourlyLimit} emails/hour`,
          },
          {
            type: 'mrkdwn',
            text: `*Current Count:*\n${params.currentCount} emails sent`,
          },
          {
            type: 'mrkdwn',
            text: `*Hour Window:*\n${params.hourWindow}`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `⏱️ *Preserving Sender Health:* Subsequent scheduled emails have been automatically postponed to the next window (\`${params.rescheduledTo.toLocaleTimeString()}\`) without dropping or failing any jobs.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `ReachInbox Distributed Scheduler · ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  }

  try {
    if (targetWebhook) {
      await axios.post(targetWebhook, messagePayload, { timeout: 5000 })
      console.log(`📢 Live Slack alert sent via Webhook for ${params.senderEmail}`)
      return true
    } else if (integration?.accessToken && integration.channelId) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: integration.channelId,
          ...messagePayload,
        },
        {
          headers: {
            Authorization: `Bearer ${integration.accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 5000,
        }
      )
      console.log(`📢 Live Slack alert sent via Web API to channel ${integration.channelName || integration.channelId}`)
      return true
    }
  } catch (err: any) {
    console.error(`❌ Failed to send Slack alert: ${err.message}`)
  }

  return false
}

export function generateSlackOAuthUrl(): string {
  if (!config.slack.clientId) {
    return `${config.apiBaseUrl}/slack/demo-connect`
  }
  const scope = encodeURIComponent('incoming-webhook,chat:write')
  const redirectUri = encodeURIComponent(config.slack.redirectUri)
  return `https://slack.com/oauth/v2/authorize?client_id=${config.slack.clientId}&scope=${scope}&redirect_uri=${redirectUri}`
}

export async function exchangeSlackCode(code: string): Promise<any> {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code,
      redirect_uri: config.slack.redirectUri,
    }).toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )

  if (!response.data.ok) {
    throw new Error(response.data.error || 'Failed to exchange Slack OAuth code')
  }

  const data = response.data
  return {
    accessToken: data.access_token,
    teamId: data.team?.id,
    teamName: data.team?.name,
    channelId: data.incoming_webhook?.channel_id,
    channelName: data.incoming_webhook?.channel,
    webhookUrl: data.incoming_webhook?.url,
  }
}
