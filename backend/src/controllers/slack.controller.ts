import { Request, Response } from 'express'
import { config } from '../config/env'
import { db } from '../db'
import { exchangeSlackCode, generateSlackOAuthUrl } from '../services/slack.service'

export async function getSlackStatus(req: Request, res: Response) {
  try {
    const integration = await db.getSlackIntegration()
    const connected = Boolean(integration?.webhookUrl || integration?.accessToken || config.slack.webhookUrl)
    return res.json({
      connected,
      channel: integration?.channelName,
      team: integration?.teamName,
    })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get Slack status' })
  }
}

export async function disconnectSlack(req: Request, res: Response) {
  try {
    await db.deleteSlackIntegration()
    return res.json({ success: true, message: 'Slack disconnected successfully' })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to disconnect Slack' })
  }
}

export function slackOAuthRedirect(req: Request, res: Response) {
  const url = generateSlackOAuthUrl()
  return res.redirect(url)
}

export async function slackOAuthCallback(req: Request, res: Response) {
  const code = req.query.code as string
  if (!code) {
    return res.redirect(`${config.frontendUrl}/settings?slack=error&msg=no_code`)
  }

  try {
    const integrationData = await exchangeSlackCode(code)
    await db.saveSlackIntegration(integrationData)
    console.log(`✅ Slack connected for team: ${integrationData.teamName} (channel: ${integrationData.channelName})`)
    return res.redirect(`${config.frontendUrl}/settings?slack=connected`)
  } catch (err: any) {
    console.error(`Slack OAuth error: ${err.message}`)
    return res.redirect(`${config.frontendUrl}/settings?slack=error`)
  }
}

export async function slackDemoConnect(req: Request, res: Response) {
  // Test route to connect a demo webhook when testing without Slack app keys
  await db.saveSlackIntegration({
    id: 'slack_demo',
    teamName: 'Demo Workspace',
    channelName: '#reachinbox-alerts',
    webhookUrl: config.slack.webhookUrl || 'https://hooks.slack.com/services/DEMO/WEBHOOK/URL',
  })
  return res.redirect(`${config.frontendUrl}/settings?slack=connected`)
}
