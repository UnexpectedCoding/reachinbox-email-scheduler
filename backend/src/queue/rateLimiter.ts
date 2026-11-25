import { getRedisConnection, isRedisAvailable } from './redis'
import { sendSlackRateLimitAlert } from '../services/slack.service'
import { config } from '../config/env'

// In-memory fallback counters if Redis is not running
const memoryRateLimits = new Map<string, number>()
const memoryAlertsSent = new Set<string>()

export function getCurrentHourWindow(date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}-${pad(date.getUTCHours())}`
}

export function calculateMsUntilNextHourWindow(date = new Date()): number {
  const nextHour = new Date(date)
  nextHour.setUTCMinutes(0, 0, 0)
  nextHour.setUTCHours(nextHour.getUTCHours() + 1)
  // Add 1500ms safety buffer into next hour
  return Math.max(1000, nextHour.getTime() - date.getTime() + 1500)
}

export interface RateLimitResult {
  allowed: boolean
  currentCount: number
  hourlyLimit: number
  hourWindow: string
  nextWindowDelayMs: number
  rescheduledTo: Date
}

export async function checkAndIncrementRateLimit(
  senderEmail: string,
  configuredLimit?: number
): Promise<RateLimitResult> {
  const limit = configuredLimit && configuredLimit > 0 ? configuredLimit : config.maxEmailsPerHourPerSender
  const now = new Date()
  const window = getCurrentHourWindow(now)
  const nextWindowDelayMs = calculateMsUntilNextHourWindow(now)
  const rescheduledTo = new Date(now.getTime() + nextWindowDelayMs)

  const redisKey = `ratelimit:${senderEmail.toLowerCase()}:${window}`
  const alertKey = `slack_alert_sent:${senderEmail.toLowerCase()}:${window}`

  let currentCount = 1

  if (isRedisAvailable()) {
    try {
      const redis = getRedisConnection()
      currentCount = await redis.incr(redisKey)
      if (currentCount === 1) {
        // Expire after 1 hour + 5 minutes
        await redis.expire(redisKey, 3900)
      }
    } catch {
      // Fallback to in-memory counter
      const cur = (memoryRateLimits.get(redisKey) || 0) + 1
      memoryRateLimits.set(redisKey, cur)
      currentCount = cur
    }
  } else {
    const cur = (memoryRateLimits.get(redisKey) || 0) + 1
    memoryRateLimits.set(redisKey, cur)
    currentCount = cur
  }

  const allowed = currentCount <= limit

  // If rate limit exceeded, trigger Slack alert if not yet sent in this window
  if (!allowed) {
    let shouldAlert = false

    if (isRedisAvailable()) {
      try {
        const redis = getRedisConnection()
        const alertSet = await redis.set(alertKey, '1', 'EX', 3600, 'NX')
        shouldAlert = alertSet === 'OK'
      } catch {
        if (!memoryAlertsSent.has(alertKey)) {
          memoryAlertsSent.add(alertKey)
          shouldAlert = true
        }
      }
    } else {
      if (!memoryAlertsSent.has(alertKey)) {
        memoryAlertsSent.add(alertKey)
        shouldAlert = true
      }
    }

    if (shouldAlert) {
      console.warn(`🚨 Rate limit REACHED for ${senderEmail} (${currentCount}/${limit}). Dispatching live Slack alert...`)
      void sendSlackRateLimitAlert({
        senderEmail,
        hourlyLimit: limit,
        currentCount,
        hourWindow: window,
        rescheduledTo,
      })
    }
  }

  return {
    allowed,
    currentCount,
    hourlyLimit: limit,
    hourWindow: window,
    nextWindowDelayMs,
    rescheduledTo,
  }
}
