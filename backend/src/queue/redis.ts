import Redis from 'ioredis'
import { config } from '../config/env'

let redisClient: Redis | null = null
let redisAvailable = false
let loggedRedisWarning = false

export function getRedisConnection(): Redis {
  if (!redisClient) {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: null, // Required by BullMQ
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times > 3) {
          return null // Stop retrying after 3 attempts
        }
        return Math.min(times * 1000, 2000)
      },
    })

    redisClient.on('connect', () => {
      redisAvailable = true
      loggedRedisWarning = false
      console.log('✅ Connected to Redis.')
    })

    redisClient.on('error', (err) => {
      redisAvailable = false
      if (!loggedRedisWarning) {
        loggedRedisWarning = true
        console.warn(`⚠️ Redis is offline (${err.message}). Using built-in resilient delayed scheduler fallback.`)
      }
    })

    // Initiate connection attempt safely
    redisClient.connect().catch(() => {
      redisAvailable = false
      if (!loggedRedisWarning) {
        loggedRedisWarning = true
        console.warn(`⚠️ Redis not reachable at ${config.redis.host}:${config.redis.port}. Fallback delayed scheduler active.`)
      }
    })
  }

  return redisClient
}

export function isRedisAvailable(): boolean {
  return redisAvailable
}
