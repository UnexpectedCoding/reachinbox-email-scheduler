import { Job, Worker } from 'bullmq'
import { config } from '../config/env'
import { db } from '../db'
import { sendEmail } from '../services/email.service'
import { updateEmailInSearch } from '../services/search.service'
import { EmailJobData } from '../types'
import { EMAIL_QUEUE_NAME, getEmailQueue } from './emailQueue'
import { checkAndIncrementRateLimit } from './rateLimiter'
import { getRedisConnection, isRedisAvailable } from './redis'

let workerInstance: Worker<EmailJobData> | null = null

// Core execution engine shared by BullMQ worker and fallback scheduler
export async function processEmailJobExecution(data: EmailJobData, jobId: string) {
  const { emailId, senderEmail, recipientEmail, recipientName, subject, body, hourlyLimit } = data

  console.log(`\n⚙️ [Scheduler] Processing job ${jobId} for email ${emailId} to <${recipientEmail}>`)

  // 1. Check idempotency & if email was cancelled in database
  const emailRecord = await db.getEmailById(emailId)
  if (!emailRecord) {
    console.warn(`[Scheduler] Email ${emailId} not found in database. Skipping job.`)
    return { status: 'skipped', reason: 'Email not found in DB' }
  }

  if (emailRecord.status === 'cancelled') {
    console.log(`[Scheduler] Email ${emailId} was cancelled by user. Skipping send.`)
    return { status: 'cancelled' }
  }

  if (emailRecord.status === 'sent') {
    console.log(`[Scheduler] Email ${emailId} already marked as sent. Maintaining idempotency.`)
    return { status: 'already_sent' }
  }

  // 2. Check and Increment Hourly Rate Limit for sender
  const rateLimitCheck = await checkAndIncrementRateLimit(senderEmail, hourlyLimit || emailRecord.hourlyLimit)

  if (!rateLimitCheck.allowed) {
    console.warn(
      `⏱️ [Rate Limit Exceeded] Sender ${senderEmail} has reached the limit (${rateLimitCheck.currentCount}/${rateLimitCheck.hourlyLimit} emails/hr).`
    )
    console.warn(
      `🔄 Rescheduling email ${emailId} to next window in ${Math.round(rateLimitCheck.nextWindowDelayMs / 1000)}s (${rateLimitCheck.rescheduledTo.toISOString()})`
    )

    // Reschedule into next window without dropping
    const queue = getEmailQueue()
    const postponedJobId = `${emailId}_postponed_${Date.now()}`
    
    // Add to queue or fallback scheduler
    const { addEmailToQueue } = await import('./emailQueue')
    await addEmailToQueue(
      {
        ...data,
        rescheduledCount: (data.rescheduledCount || 0) + 1,
      },
      rateLimitCheck.nextWindowDelayMs
    )

    // Update DB with new scheduled time
    await db.updateEmailStatus(emailId, 'scheduled', {
      scheduledAt: rateLimitCheck.rescheduledTo,
      bullmqJobId: postponedJobId,
    })

    // Update Elasticsearch
    void updateEmailInSearch(emailId, {
      scheduledAt: rateLimitCheck.rescheduledTo.toISOString(),
      status: 'scheduled',
    })

    return {
      status: 'postponed_rate_limit',
      rescheduledTo: rateLimitCheck.rescheduledTo,
      window: rateLimitCheck.hourWindow,
    }
  }

  // 3. Minimum delay between individual email sends (Provider throttling)
  const minDelay = config.minDelayBetweenEmailsMs
  if (minDelay > 0) {
    console.log(`⏳ Applying provider throttling delay (${minDelay}ms) before send...`)
    await new Promise((resolve) => setTimeout(resolve, minDelay))
  }

  // 4. Send email via Ethereal SMTP
  try {
    const sendResult = await sendEmail({
      from: senderEmail,
      to: recipientEmail,
      toName: recipientName,
      subject,
      html: body,
    })

    const previewUrl = typeof sendResult.previewUrl === 'string' ? sendResult.previewUrl : undefined
    const sentAt = new Date()

    // 5. Update DB to 'sent'
    await db.updateEmailStatus(emailId, 'sent', {
      sentAt,
      previewUrl,
    })

    // 6. Update Elasticsearch
    void updateEmailInSearch(emailId, {
      status: 'sent',
      sentAt: sentAt.toISOString(),
      previewUrl,
    })

    console.log(`✅ [Scheduler] Email ${emailId} successfully sent! Status updated to 'sent'.`)
    return { status: 'sent', previewUrl, messageId: sendResult.messageId }
  } catch (sendErr: any) {
    console.error(`❌ [Scheduler] Failed to send email ${emailId}: ${sendErr.message}`)

    await db.updateEmailStatus(emailId, 'failed', {
      errorMessage: sendErr.message,
    })

    void updateEmailInSearch(emailId, {
      status: 'failed',
      errorMessage: sendErr.message,
    })

    throw sendErr
  }
}

export function initEmailWorker(): Worker<EmailJobData> | null {
  if (workerInstance) return workerInstance

  try {
    const redis = getRedisConnection()

    workerInstance = new Worker<EmailJobData>(
      EMAIL_QUEUE_NAME,
      async (job: Job<EmailJobData>) => {
        return processEmailJobExecution(job.data, job.id || job.data.emailId)
      },
      {
        connection: redis,
        concurrency: config.workerConcurrency, // Configurable worker concurrency
      }
    )

    workerInstance.on('completed', (job) => {
      console.log(`🎉 [Worker] Job ${job.id} completed successfully.`)
    })

    workerInstance.on('failed', (job, err) => {
      console.error(`💥 [Worker] Job ${job?.id} failed: ${err.message}`)
    })

    console.log(`✅ BullMQ Worker initialized with concurrency = ${config.workerConcurrency}`)
    return workerInstance
  } catch (err: any) {
    console.warn(`ℹ️ Redis not ready yet. Standalone delayed scheduler fallback is active.`)
    return null
  }
}
