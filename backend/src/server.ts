import cookieParser from 'cookie-parser'
import cors from 'cors'
import express from 'express'
import { config } from './config/env'
import { setupBullBoard } from './dashboard/bullBoard'
import { db, initDb } from './db'
import { addEmailToQueue, getEmailQueue } from './queue/emailQueue'
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

// REST API routes
app.use('/api/v1', apiRoutes)

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: db.isPostgres() ? 'postgresql' : db.isSql() ? 'sqlite' : 'memory-store',
    redis: isRedisAvailable() ? 'connected' : 'offline (fallback-scheduler)',
    uptime: process.uptime(),
  })
})

// Reconciliation & Persistence Check on Startup
async function recoverPendingScheduledJobs(): Promise<void> {
  try {
    const pendingEmails = await db.getScheduledPendingEmails()
    if (pendingEmails.length === 0) return

    console.log(`🔍 [Recovery] Checking ${pendingEmails.length} pending scheduled emails for queue persistence...`)

    for (const email of pendingEmails) {
      const remainingDelay = Math.max(0, new Date(email.scheduledAt).getTime() - Date.now())
      console.log(`🔁 [Recovery] Restoring job for scheduled email ${email.id} (Scheduled at: ${new Date(email.scheduledAt).toISOString()})`)
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
    console.log('✅ [Recovery] All pending scheduled emails reconciled.')
  } catch (err: any) {
    console.warn(`⚠️ [Recovery Warning] Could not reconcile pending jobs: ${err.message}`)
  }
}

async function startServer() {
  console.log('🚀 Initializing ReachInbox Email Scheduler Backend...')

  // 1. Initialize Relational Database (PostgreSQL or SQLite)
  await initDb()

  // 2. Ensure Redis is running (auto-launches local redis-server.exe if available)
  const redisReady = await ensureRedisRunning()

  // 3. Initialize Elasticsearch (Search Engine)
  await initElasticsearch()

  // 4. Initialize Ethereal SMTP Transporter
  await initEmailTransporter()

  // 5. Initialize BullMQ Worker with Concurrency & Throttling
  if (redisReady) {
    try {
      app.use('/admin/queues', setupBullBoard())
      initEmailWorker()
      console.log('✅ BullMQ Live Dashboard mounted at /admin/queues')
    } catch (err: any) {
      console.warn(`⚠️ BullMQ worker initialization issue: ${err.message}`)
    }
  } else {
    // If Redis is offline, mount informational status at /admin/queues
    app.get('/admin/queues', (req, res) => {
      res.send(`
        <html>
          <body style="font-family:sans-serif;padding:40px;background:#f8fafc;color:#1e293b;">
            <h2>📊 BullMQ Queue Dashboard</h2>
            <p style="color:#d97706;font-weight:bold;">⚠️ Redis is not running on port 6379.</p>
            <p>The scheduler is currently running in <b>Resilient Event-Driven Mode</b> with disk SQL persistence.</p>
            <p>To view real-time Redis queues in Bull-Board:</p>
            <ul>
              <li>Double-click <code>backend/start-redis.bat</code> (or run <code>npm run redis</code> in <code>backend/</code>)</li>
              <li>Or start Docker: <code>docker compose up -d</code></li>
            </ul>
          </body>
        </html>
      `)
    })
    console.log('ℹ️ Redis is offline. Running with built-in resilient delayed scheduler & local SQL database.')
  }

  // 6. Run Server Restart Recovery Routine
  await recoverPendingScheduledJobs()

  const server = app.listen(config.port, () => {
    console.log(`\n=============================================================`)
    console.log(`🚀 ReachInbox Backend API running at: http://localhost:${config.port}/api/v1`)
    console.log(`📊 BullMQ Live Queue Dashboard:      http://localhost:${config.port}/admin/queues`)
    console.log(`💾 Database:                         ${db.isPostgres() ? 'PostgreSQL' : 'SQLite Relational Database (email_scheduler.sqlite)'}`)
    console.log(`⚙️ Worker Concurrency:              ${config.workerConcurrency}`)
    console.log(`⏱️ Min Delay Between Emails:         ${config.minDelayBetweenEmailsMs}ms`)
    console.log(`🚦 Hourly Limit Per Sender:          ${config.maxEmailsPerHourPerSender}`)
    console.log(`=============================================================\n`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('\n🛑 Gracefully shutting down ReachInbox Scheduler...')
    server.close(() => {
      console.log('HTTP server closed.')
      process.exit(0)
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

void startServer()

export default app
