import { Queue } from 'bullmq'
import { config } from '../config/env'
import { EmailJobData } from '../types'
import { getRedisConnection, isRedisAvailable } from './redis'

export const EMAIL_QUEUE_NAME = 'email-queue'

let emailQueueInstance: Queue<EmailJobData> | null = null

// Fallback in-memory delayed timers when Redis is not running
const fallbackTimers = new Map<string, NodeJS.Timeout>()

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueueInstance) {
    const redis = getRedisConnection()
    emailQueueInstance = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    })
    console.log(`✅ BullMQ Queue "${EMAIL_QUEUE_NAME}" initialized.`)
  }
  return emailQueueInstance
}

export async function addEmailToQueue(
  data: EmailJobData,
  delayMs: number
): Promise<string> {
  const delay = Math.max(0, delayMs)

  if (isRedisAvailable()) {
    try {
      const queue = getEmailQueue()
      // Use emailId as BullMQ jobId for idempotency
      const job = await queue.add('send-email', data, {
        delay,
        jobId: data.emailId,
      })
      return job.id || data.emailId
    } catch (err: any) {
      console.warn(`[Queue] Redis enqueue error (${err.message}). Using resilient fallback scheduler.`)
    }
  }

  // Fallback delayed scheduler (Strictly no cron, event-driven delayed execution)
  console.log(`⏰ [Fallback Scheduler] Enqueued delayed job for email ${data.emailId} (Execution in ${Math.round(delay / 1000)}s)`)

  // Clear existing timer if any (idempotency)
  if (fallbackTimers.has(data.emailId)) {
    clearTimeout(fallbackTimers.get(data.emailId)!)
    fallbackTimers.delete(data.emailId)
  }

  // If immediate, trigger execution right away so serverless functions don't freeze before delivery
  if (delay <= 1000) {
    import('./emailWorker')
      .then(({ processEmailJobExecution }) => {
        void processEmailJobExecution(data, data.emailId)
      })
      .catch(() => {})
  }

  const timer = setTimeout(async () => {
    fallbackTimers.delete(data.emailId)
    const { processEmailJobExecution } = await import('./emailWorker')
    try {
      await processEmailJobExecution(data, data.emailId)
    } catch (execErr: any) {
      console.error(`[Fallback Scheduler] Execution error for ${data.emailId}: ${execErr.message}`)
    }
  }, delay)

  fallbackTimers.set(data.emailId, timer)
  return data.emailId
}

export async function cancelQueueJob(jobId: string): Promise<boolean> {
  if (fallbackTimers.has(jobId)) {
    clearTimeout(fallbackTimers.get(jobId)!)
    fallbackTimers.delete(jobId)
    return true
  }

  if (isRedisAvailable()) {
    try {
      const queue = getEmailQueue()
      const job = await queue.getJob(jobId)
      if (job) {
        await job.remove()
        return true
      }
    } catch (err: any) {
      console.warn(`Could not remove BullMQ job ${jobId}: ${err.message}`)
    }
  }

  return false
}

export async function rescheduleQueueJob(
  jobId: string,
  newDelayMs: number,
  data: EmailJobData
): Promise<string> {
  await cancelQueueJob(jobId)
  return addEmailToQueue(data, newDelayMs)
}
