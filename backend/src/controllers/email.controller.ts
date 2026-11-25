import { Request, Response } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { db } from '../db'
import { addEmailToQueue, cancelQueueJob, rescheduleQueueJob } from '../queue/emailQueue'
import { deleteEmailFromSearch, indexEmail, searchEmailsWithES, updateEmailInSearch } from '../services/search.service'
import { EmailRecord } from '../types'

function formatEmailResponse(e: EmailRecord) {
  return {
    id: e.id,
    recipient: e.recipientEmail,
    recipientName: e.recipientName || e.recipientEmail.split('@')[0],
    sender: e.senderEmail,
    subject: e.subject,
    body: e.body,
    bodyPreview: e.bodyPreview,
    scheduledAt: e.scheduledAt ? new Date(e.scheduledAt).toISOString() : null,
    sentAt: e.sentAt ? new Date(e.sentAt).toISOString() : null,
    status: e.status,
    previewUrl: e.previewUrl || undefined,
  }
}

export async function scheduleEmail(req: Request, res: Response) {
  try {
    const {
      senderId,
      recipients,
      subject,
      body,
      scheduledAt,
      delayBetweenEmails = 0,
      hourlyLimit = 100,
    } = req.body

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients list is required.' })
    }

    if (!subject || !body || !scheduledAt) {
      return res.status(400).json({ error: 'Subject, body, and scheduledAt are required.' })
    }

    const startDate = new Date(scheduledAt)
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ error: 'Invalid scheduledAt ISO date.' })
    }

    const senderEmail = senderId || 'oliver.brown@domain.io'
    const bodyPreview = body.replace(/<[^>]*>?/gm, '').slice(0, 120).trim()
    const scheduledRecords: EmailRecord[] = []

    const delayBetweenSeconds = Number(delayBetweenEmails) || 0

    // Schedule each recipient with configured delay interval
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim()
      if (!recipient) continue

      const recipientScheduledAt = new Date(startDate.getTime() + i * delayBetweenSeconds * 1000)
      const delayMs = Math.max(0, recipientScheduledAt.getTime() - Date.now())

      const emailId = `email_${uuidv4().replace(/-/g, '').slice(0, 12)}`

      const record: EmailRecord = {
        id: emailId,
        senderId: senderEmail,
        senderEmail,
        recipientEmail: recipient,
        recipientName: recipient.split('@')[0],
        subject,
        body,
        bodyPreview,
        status: 'scheduled',
        scheduledAt: recipientScheduledAt,
        sentAt: null,
        delayBetweenEmails: delayBetweenSeconds,
        hourlyLimit: Number(hourlyLimit) || 100,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // 1. Insert into Relational Database
      await db.insertEmail(record)

      // 2. Schedule delayed BullMQ job
      const jobId = await addEmailToQueue(
        {
          emailId: record.id,
          senderEmail: record.senderEmail,
          recipientEmail: record.recipientEmail,
          recipientName: record.recipientName,
          subject: record.subject,
          body: record.body,
          scheduledAt: recipientScheduledAt.toISOString(),
          delayBetweenEmails: record.delayBetweenEmails,
          hourlyLimit: record.hourlyLimit,
        },
        delayMs
      )

      record.bullmqJobId = jobId

      // 3. Index into Elasticsearch
      void indexEmail(record)

      scheduledRecords.push(record)
    }

    console.log(`📅 Successfully scheduled ${scheduledRecords.length} emails starting at ${startDate.toISOString()}`)

    return res.status(201).json({
      success: true,
      message: `Scheduled ${scheduledRecords.length} emails successfully`,
      count: scheduledRecords.length,
      data: scheduledRecords.map(formatEmailResponse),
    })
  } catch (err: any) {
    console.error(`Error scheduling email: ${err.message}`)
    return res.status(500).json({ error: err.message || 'Failed to schedule emails' })
  }
}

export async function getEmails(req: Request, res: Response) {
  try {
    const status = req.query.status as string | undefined
    const search = req.query.search as string | undefined
    const page = parseInt(req.query.page as string || '1', 10)
    const limit = parseInt(req.query.limit as string || '20', 10)

    // Try Elasticsearch full-text search first if a search query is provided
    if (search && search.trim()) {
      const esResult = await searchEmailsWithES({
        query: search.trim(),
        status,
        page,
        limit,
      })

      if (esResult) {
        const emailDocs: EmailRecord[] = []
        for (const id of esResult.ids) {
          const doc = await db.getEmailById(id)
          if (doc) emailDocs.push(doc)
        }

        const totalPages = Math.ceil(esResult.total / limit)
        return res.json({
          data: emailDocs.map(formatEmailResponse),
          pagination: {
            page,
            limit,
            total: esResult.total,
            totalPages,
          },
        })
      }
    }

    // Fallback or standard query via SQL / DB
    const { emails, total } = await db.queryEmails({
      status,
      search,
      page,
      limit,
    })

    const totalPages = Math.ceil(total / limit)

    return res.json({
      data: emails.map(formatEmailResponse),
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    })
  } catch (err: any) {
    console.error(`Error fetching emails: ${err.message}`)
    return res.status(500).json({ error: 'Failed to fetch emails' })
  }
}

export async function getEmailById(req: Request, res: Response) {
  try {
    const { id } = req.params
    const email = await db.getEmailById(id)
    if (!email) {
      return res.status(404).json({ error: 'Email not found' })
    }
    return res.json(formatEmailResponse(email))
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to get email' })
  }
}

export async function rescheduleEmail(req: Request, res: Response) {
  try {
    const { id } = req.params
    const { scheduledAt } = req.body

    if (!scheduledAt) {
      return res.status(400).json({ error: 'scheduledAt is required' })
    }

    const email = await db.getEmailById(id)
    if (!email) {
      return res.status(404).json({ error: 'Email not found' })
    }

    const newDate = new Date(scheduledAt)
    const newDelayMs = Math.max(0, newDate.getTime() - Date.now())

    // Update BullMQ Job
    const newJobId = await rescheduleQueueJob(email.bullmqJobId || email.id, newDelayMs, {
      emailId: email.id,
      senderEmail: email.senderEmail,
      recipientEmail: email.recipientEmail,
      recipientName: email.recipientName,
      subject: email.subject,
      body: email.body,
      scheduledAt: newDate.toISOString(),
      delayBetweenEmails: email.delayBetweenEmails,
      hourlyLimit: email.hourlyLimit,
    })

    // Update Database
    const updated = await db.updateEmailStatus(email.id, 'scheduled', {
      scheduledAt: newDate,
      bullmqJobId: newJobId,
    })

    // Update Elasticsearch
    void updateEmailInSearch(email.id, {
      scheduledAt: newDate.toISOString(),
      status: 'scheduled',
    })

    return res.json({ success: true, email: updated ? formatEmailResponse(updated) : null })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to reschedule email' })
  }
}

export async function cancelEmail(req: Request, res: Response) {
  try {
    const { id } = req.params
    const email = await db.getEmailById(id)
    if (!email) {
      return res.status(404).json({ error: 'Email not found' })
    }

    // Cancel BullMQ Job
    await cancelQueueJob(email.bullmqJobId || email.id)

    // Mark as cancelled in DB
    await db.updateEmailStatus(email.id, 'cancelled')

    // Remove from Elasticsearch
    void deleteEmailFromSearch(email.id)

    return res.json({ success: true, message: 'Email scheduled job cancelled successfully' })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to cancel email' })
  }
}
