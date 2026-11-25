import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config } from './config/env'
import { setupBullBoard } from './dashboard/bullBoard'
import { db, initDb } from './db'
import { addEmailToQueue } from './queue/emailQueue'
import { initEmailWorker } from './queue/emailWorker'
import { isRedisAvailable } from './queue/redis'
import { ensureRedisRunning } from './queue/spawnRedis'
import apiRoutes from './routes'
import { initEmailTransporter } from './services/email.service'
import { initElasticsearch } from './services/search.service'

const app = express()

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true)
      const allowedOrigins = [
        config.frontendUrl,
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:5000',
      ].filter(Boolean)
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true)
      }
      return callback(null, true)
    },
    credentials: true,
  })
)
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(cookieParser())

// Lazy / background initialization
let initialized = false
async function bootstrapBackend() {
  if (initialized) return
  initialized = true

  console.log('🚀 Bootstrapping ReachInbox Email Scheduler Backend...')
  await initDb().catch((err) => console.warn('DB init note:', err?.message))

  if (!process.env.VERCEL) {
    await ensureRedisRunning().catch(() => false)
  }

  await initElasticsearch().catch(() => {})
  await initEmailTransporter().catch(() => {})

  if (isRedisAvailable()) {
    try {
      app.use('/admin/queues', setupBullBoard())
      initEmailWorker()
      console.log('✅ BullMQ Live Dashboard mounted at /admin/queues')
    } catch (err: any) {
      console.warn(`⚠️ BullMQ worker initialization issue: ${err.message}`)
    }
  } else {
    app.get('/admin/queues', (req, res) => {
      res.send(`
        <html>
          <body style="font-family:sans-serif;padding:40px;background:#f8fafc;color:#1e293b;">
            <h2>📊 BullMQ Queue Dashboard</h2>
            <p style="color:#16a34a;font-weight:bold;">⚡ Running in Resilient Event-Driven Mode</p>
            <p>Emails, rate limiting, delays, and persistence are active and monitored.</p>
          </body>
        </html>
      `)
    })
  }

  // Recover pending jobs
  try {
    const pendingEmails = await db.getScheduledPendingEmails()
    for (const email of pendingEmails) {
      const remainingDelay = Math.max(0, new Date(email.scheduledAt).getTime() - Date.now())
      await addEmailToQueue(
        {
          emailId: email.id,
          senderEmail: email.senderEmail,
          recipientEmail: email.recipientEmail,
          recipientName: email.recipientName,
          subject: email.subject,
          body: email.body,
          scheduledAt: new Date(email.scheduledAt).toISOString(),
          delayBetweenEmails: email.delayBetweenEmails,
          hourlyLimit: email.hourlyLimit,
        },
        remainingDelay
      )
    }
  } catch {}
}

// Request middleware to ensure backend is bootstrapped
app.use(async (req, res, next) => {
  if (!initialized) {
    await bootstrapBackend().catch(() => {})
  }
  next()
})

// REST API routes - support all possible path rewrites: /api/v1, /v1, /api, and /
app.use('/api/v1', apiRoutes)
app.use('/v1', apiRoutes)
app.use('/api', apiRoutes)
app.use('/', apiRoutes)

// Health check endpoint
const healthHandler = (req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db.isPostgres() ? 'postgresql' : db.isSql() ? 'sqlite' : 'in-memory-relational-store',
    redis: isRedisAvailable() ? 'connected' : 'resilient-event-driven-scheduler',
    uptime: process.uptime(),
  })
}

app.get('/health', healthHandler)
app.get('/api/health', healthHandler)
app.get('/api/v1/health', healthHandler)

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled backend error:', err)
  res.status(500).json({ error: err?.message || 'Internal Server Error' })
})

// Listen only when not in serverless environment (e.g. local dev, docker)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  void bootstrapBackend().then(() => {
    app.listen(config.port, () => {
      console.log(`\n=============================================================`)
      console.log(`🚀 ReachInbox Backend API running at: http://localhost:${config.port}/api/v1`)
      console.log(`📊 BullMQ Live Queue Dashboard:      http://localhost:${config.port}/admin/queues`)
      console.log(`💾 Database:                         ${db.isPostgres() ? 'PostgreSQL' : db.isSql() ? 'SQLite' : 'In-Memory Relational Store'}`)
      console.log(`=============================================================\n`)
    })
  })
}

export default app
