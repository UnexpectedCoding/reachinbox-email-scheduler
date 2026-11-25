import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { backendStore, StoredEmail } from '@/lib/backendStore'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      senderId,
      recipients,
      subject,
      body: emailBody,
      scheduledAt,
      delayBetweenEmails = 0,
      hourlyLimit = 100,
    } = body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'Recipients list is required.' }, { status: 400 })
    }

    if (!subject || !emailBody) {
      return NextResponse.json({ error: 'Subject and body are required.' }, { status: 400 })
    }

    const startDate = scheduledAt ? new Date(scheduledAt) : new Date(Date.now() + 5000)
    const senderEmail = senderId || 'oliver.brown@domain.io'
    const bodyPreview = emailBody.replace(/<[^>]*>?/gm, '').slice(0, 120).trim()
    const delayBetweenSeconds = Number(delayBetweenEmails) || 0
    const limit = Number(hourlyLimit) || 100

    const scheduledRecords: StoredEmail[] = []

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim()
      if (!recipient) continue

      const recipientScheduledAt = new Date(startDate.getTime() + i * delayBetweenSeconds * 1000)
      const emailId = `email_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`

      // Check hourly rate limit
      const rateCheck = backendStore.incrementRateLimit(senderEmail, limit)

      let effectiveScheduledAt = recipientScheduledAt
      if (!rateCheck.allowed) {
        effectiveScheduledAt = rateCheck.nextWindow
        // If Slack is connected, notify
        const slack = backendStore.getSlack()
        if (slack.connected && slack.webhookUrl) {
          try {
            await fetch(slack.webhookUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: `⚠️ Rate limit reached for ${senderEmail} (${rateCheck.current}/${limit} emails/hr). Postponed to next window.`,
              }),
            })
          } catch {}
        }
      }

      const record: StoredEmail = {
        id: emailId,
        recipient,
        recipientName: recipient.split('@')[0],
        sender: senderEmail,
        subject,
        body: emailBody,
        bodyPreview,
        status: 'scheduled',
        scheduledAt: effectiveScheduledAt.toISOString(),
        sentAt: null,
        delayBetweenEmails: delayBetweenSeconds,
        hourlyLimit: limit,
      }

      backendStore.addEmail(record)
      scheduledRecords.push(record)
    }

    return NextResponse.json({
      success: true,
      message: `Scheduled ${scheduledRecords.length} emails successfully.`,
      count: scheduledRecords.length,
      data: scheduledRecords,
    }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Failed to schedule emails' }, { status: 500 })
  }
}
