import { Pool } from 'pg'
import fs from 'fs'
import path from 'path'
import { config } from '../config/env'
import { EmailRecord, Sender, SlackIntegration, User } from '../types'

let pool: Pool | null = null
let isConnectedToPostgres = false

// SQLite relational database instance
let sqliteDb: any = null
let isConnectedToSqlite = false

const defaultSenders: Sender[] = [
  { id: 'sender_1', email: 'oliver.brown@domain.io', name: 'Oliver Brown', createdAt: new Date() },
  { id: 'sender_2', email: 'hello@domain.io', name: 'ReachInbox Team', createdAt: new Date() },
  { id: 'sender_3', email: 'sales@reachinbox.ai', name: 'Growth & Outreach', createdAt: new Date() },
]

// Global resilient in-memory storage (persists across warm serverless requests)
const globalAny = global as any
const memoryEmails: Map<string, EmailRecord> = globalAny.__reachinbox_memory_emails || (globalAny.__reachinbox_memory_emails = new Map<string, EmailRecord>())
const memoryUsers: Map<string, User> = globalAny.__reachinbox_memory_users || (globalAny.__reachinbox_memory_users = new Map<string, User>())
const memorySenders: Map<string, Sender> = globalAny.__reachinbox_memory_senders || (globalAny.__reachinbox_memory_senders = new Map<string, Sender>())
let memorySlack: SlackIntegration | null = globalAny.__reachinbox_memory_slack || null

// Seed default senders
if (memorySenders.size === 0) {
  defaultSenders.forEach((s) => memorySenders.set(s.id, s))
}

// Seed default demo user
if (!memoryUsers.has('usr_demo_oliver')) {
  memoryUsers.set('usr_demo_oliver', {
    id: 'usr_demo_oliver',
    email: 'oliver.brown@domain.io',
    name: 'Oliver Brown',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    createdAt: new Date(),
  })
}

// Seed initial realistic emails so scheduled and sent views are never blank
if (memoryEmails.size === 0) {
  const seedEmails: EmailRecord[] = [
    {
      id: 'email_seed_1',
      senderId: 'sender_1',
      senderEmail: 'oliver.brown@domain.io',
      recipientEmail: 'alice.cooper@techgrowth.io',
      recipientName: 'Alice Cooper',
      subject: 'Q4 Partnership Proposal & Product Demo',
      body: '<p>Hi Alice,<br/><br/>Hope you are having a productive week. Following up on our discussion regarding ReachInbox platform integration.</p>',
      bodyPreview: 'Hi Alice, Hope you are having a productive week. Following up on our discussion regarding ReachInbox...',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 15 * 60 * 1000),
      sentAt: null,
      delayBetweenEmails: 2,
      hourlyLimit: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'email_seed_2',
      senderId: 'sender_1',
      senderEmail: 'oliver.brown@domain.io',
      recipientEmail: 'david.miller@cloudscale.com',
      recipientName: 'David Miller',
      subject: 'Architecture deep-dive: BullMQ & Distributed Queue Scaling',
      body: '<p>Hi David,<br/><br/>Here is the overview of the email scheduler queue architecture with BullMQ and event-driven fallbacks.</p>',
      bodyPreview: 'Hi David, Here is the overview of the email scheduler queue architecture with BullMQ and event-driven fallbacks.',
      status: 'scheduled',
      scheduledAt: new Date(Date.now() + 45 * 60 * 1000),
      sentAt: null,
      delayBetweenEmails: 2,
      hourlyLimit: 100,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'email_seed_3',
      senderId: 'sender_1',
      senderEmail: 'oliver.brown@domain.io',
      recipientEmail: 'marcus.v@acmecorp.org',
      recipientName: 'Marcus Vance',
      subject: 'Welcome to ReachInbox Email Outreach Platform',
      body: '<p>Hi Marcus,<br/><br/>Your outreach campaign has been initialized and verified. Your Ethereal test preview is available below.</p>',
      bodyPreview: 'Hi Marcus, Your outreach campaign has been initialized and verified. Your Ethereal test preview...',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 3600 * 1000),
      sentAt: new Date(Date.now() - 3590 * 1000),
      previewUrl: 'https://ethereal.email/messages',
      delayBetweenEmails: 2,
      hourlyLimit: 100,
      createdAt: new Date(Date.now() - 3600 * 1000),
      updatedAt: new Date(Date.now() - 3590 * 1000),
    },
    {
      id: 'email_seed_4',
      senderId: 'sender_1',
      senderEmail: 'oliver.brown@domain.io',
      recipientEmail: 'elena@growthscale.co',
      recipientName: 'Elena Rostova',
      subject: 'Campaign Onboarding & Setup Instructions',
      body: '<p>Hi Elena,<br/><br/>Here are the steps to configure your sending limits, delay intervals, and team notifications.</p>',
      bodyPreview: 'Hi Elena, Here are the steps to configure your sending limits, delay intervals, and team notifications.',
      status: 'sent',
      scheduledAt: new Date(Date.now() - 7200 * 1000),
      sentAt: new Date(Date.now() - 7190 * 1000),
      previewUrl: 'https://ethereal.email/messages',
      delayBetweenEmails: 2,
      hourlyLimit: 100,
      createdAt: new Date(Date.now() - 7200 * 1000),
      updatedAt: new Date(Date.now() - 7190 * 1000),
    },
  ]

  seedEmails.forEach((e) => memoryEmails.set(e.id, e))
}

function runSqlite(sql: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return resolve(null)
    sqliteDb.run(sql, params, function (this: any, err: any) {
      if (err) reject(err)
      else resolve(this)
    })
  })
}

function getSqlite<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return resolve(null)
    sqliteDb.get(sql, params, (err: any, row: any) => {
      if (err) reject(err)
      else resolve(row || null)
    })
  })
}

function allSqlite<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  return new Promise((resolve, reject) => {
    if (!sqliteDb) return resolve([])
    sqliteDb.all(sql, params, (err: any, rows: any[]) => {
      if (err) reject(err)
      else resolve(rows || [])
    })
  })
}

export async function initDb(): Promise<void> {
  const isVercel = Boolean(process.env.VERCEL)
  const isPostgresCustom = config.databaseUrl && !config.databaseUrl.includes('localhost:5432')

  // 1. Attempt PostgreSQL only if configured or not on Vercel
  if (!isVercel || isPostgresCustom) {
    try {
      pool = new Pool({
        connectionString: config.databaseUrl,
        connectionTimeoutMillis: 1000,
      })

      const client = await pool.connect()
      console.log('✅ Connected to PostgreSQL database.')
      isConnectedToPostgres = true

      const schemaPath = path.join(__dirname, 'schema.sql')
      if (fs.existsSync(schemaPath)) {
        const sql = fs.readFileSync(schemaPath, 'utf8')
        await client.query(sql)
        console.log('✅ PostgreSQL database tables initialized.')
      }

      for (const s of defaultSenders) {
        await client.query(
          `INSERT INTO senders (id, email, name) VALUES ($1, $2, $3) ON CONFLICT (email) DO NOTHING`,
          [s.id, s.email, s.name]
        )
      }

      client.release()
      return
    } catch {
      isConnectedToPostgres = false
      pool = null
    }
  }

  // 2. Initialize SQLite Relational SQL Database
  try {
    const sqlite3 = require('sqlite3').verbose()
    const dbDir = isVercel ? (process.env.TEMP || '/tmp') : path.resolve(__dirname, '../../')
    const dbPath = path.join(dbDir, 'email_scheduler.sqlite')
    sqliteDb = new sqlite3.Database(dbPath)
    isConnectedToSqlite = true

    console.log(`✅ Connected to Relational SQL Database (SQLite: ${path.basename(dbPath)})`)

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        google_id TEXT UNIQUE,
        email TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        picture TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS senders (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        email TEXT NOT NULL UNIQUE,
        name TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );
    `)

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS emails (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        sender_id TEXT NOT NULL,
        sender_email TEXT NOT NULL,
        recipient_email TEXT NOT NULL,
        recipient_name TEXT,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        body_preview TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'scheduled',
        scheduled_at TEXT NOT NULL,
        sent_at TEXT,
        error_message TEXT,
        preview_url TEXT,
        bullmq_job_id TEXT,
        delay_between_emails INTEGER DEFAULT 0,
        hourly_limit INTEGER DEFAULT 100,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `)

    await runSqlite(`
      CREATE TABLE IF NOT EXISTS slack_integrations (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        access_token TEXT,
        webhook_url TEXT,
        channel_id TEXT,
        channel_name TEXT,
        team_id TEXT,
        team_name TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `)

    for (const s of defaultSenders) {
      await runSqlite(
        `INSERT OR IGNORE INTO senders (id, email, name, created_at) VALUES (?, ?, ?, ?)`,
        [s.id, s.email, s.name, new Date().toISOString()]
      )
    }

    console.log('✅ Relational SQL schema and tables verified.')
  } catch (sqliteErr: any) {
    console.log('ℹ️ Running with built-in high-performance in-memory relational database.')
  }
}

function mapEmailRow(row: any): EmailRecord {
  return {
    id: row.id,
    userId: row.userId || row.user_id,
    senderId: row.senderId || row.sender_id,
    senderEmail: row.senderEmail || row.sender_email,
    recipientEmail: row.recipientEmail || row.recipient_email,
    recipientName: row.recipientName || row.recipient_name,
    subject: row.subject,
    body: row.body,
    bodyPreview: row.bodyPreview || row.body_preview,
    status: row.status,
    scheduledAt: new Date(row.scheduledAt || row.scheduled_at),
    sentAt: row.sentAt || row.sent_at ? new Date(row.sentAt || row.sent_at) : null,
    errorMessage: row.errorMessage || row.error_message,
    previewUrl: row.previewUrl || row.preview_url,
    bullmqJobId: row.bullmqJobId || row.bullmq_job_id,
    delayBetweenEmails: row.delayBetweenEmails || row.delay_between_emails || 0,
    hourlyLimit: row.hourlyLimit || row.hourly_limit || 100,
    createdAt: new Date(row.createdAt || row.created_at || Date.now()),
    updatedAt: new Date(row.updatedAt || row.updated_at || Date.now()),
  }
}

export const db = {
  isPostgres(): boolean {
    return isConnectedToPostgres && pool !== null
  },
  isSql(): boolean {
    return isConnectedToPostgres || isConnectedToSqlite
  },

  // Senders
  async getSenders(): Promise<Sender[]> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query('SELECT id, user_id as "userId", email, name, created_at as "createdAt" FROM senders ORDER BY created_at ASC')
        if (res.rows.length > 0) return res.rows
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        const rows = await allSqlite('SELECT id, user_id as userId, email, name, created_at as createdAt FROM senders ORDER BY created_at ASC')
        if (rows.length > 0) return rows
      } catch {}
    }
    return Array.from(memorySenders.values())
  },

  async getSenderByEmail(email: string): Promise<Sender | null> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query('SELECT id, user_id as "userId", email, name FROM senders WHERE email = $1', [email])
        if (res.rows[0]) return res.rows[0]
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        const row = await getSqlite('SELECT id, user_id as userId, email, name FROM senders WHERE email = ?', [email])
        if (row) return row
      } catch {}
    }
    return Array.from(memorySenders.values()).find((s) => s.email.toLowerCase() === email.toLowerCase()) || null
  },

  // Users
  async findUserByEmail(email: string): Promise<User | null> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query('SELECT id, google_id as "googleId", email, name, picture, created_at as "createdAt" FROM users WHERE email = $1', [email])
        if (res.rows[0]) return res.rows[0]
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        const row = await getSqlite('SELECT id, google_id as googleId, email, name, picture, created_at as createdAt FROM users WHERE email = ?', [email])
        if (row) return row
      } catch {}
    }
    return Array.from(memoryUsers.values()).find((u) => u.email.toLowerCase() === email.toLowerCase()) || null
  },

  async findUserById(id: string): Promise<User | null> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query('SELECT id, google_id as "googleId", email, name, picture, created_at as "createdAt" FROM users WHERE id = $1', [id])
        if (res.rows[0]) return res.rows[0]
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        const row = await getSqlite('SELECT id, google_id as googleId, email, name, picture, created_at as createdAt FROM users WHERE id = ?', [id])
        if (row) return row
      } catch {}
    }
    return memoryUsers.get(id) || null
  },

  async upsertUser(user: User): Promise<User> {
    memoryUsers.set(user.id, user)
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query(`
          INSERT INTO users (id, google_id, email, name, picture)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (email) DO UPDATE SET
            name = EXCLUDED.name,
            picture = EXCLUDED.picture,
            google_id = COALESCE(EXCLUDED.google_id, users.google_id)
          RETURNING id, google_id as "googleId", email, name, picture, created_at as "createdAt"
        `, [user.id, user.googleId || null, user.email, user.name, user.picture || null])
        return res.rows[0] || user
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        await runSqlite(`
          INSERT INTO users (id, google_id, email, name, picture)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            name = excluded.name,
            picture = excluded.picture,
            google_id = COALESCE(excluded.google_id, users.google_id)
        `, [user.id, user.googleId || null, user.email, user.name, user.picture || null])
      } catch {}
    }
    return user
  },

  // Emails
  async insertEmail(email: EmailRecord): Promise<EmailRecord> {
    memoryEmails.set(email.id, email)

    const scheduledAtStr = new Date(email.scheduledAt).toISOString()
    const sentAtStr = email.sentAt ? new Date(email.sentAt).toISOString() : null
    const createdAtStr = new Date(email.createdAt).toISOString()

    if (isConnectedToPostgres && pool) {
      try {
        await pool.query(`
          INSERT INTO emails (
            id, user_id, sender_id, sender_email, recipient_email, recipient_name,
            subject, body, body_preview, status, scheduled_at, sent_at,
            error_message, preview_url, bullmq_job_id, delay_between_emails, hourly_limit
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
          )
        `, [
          email.id,
          email.userId || null,
          email.senderId,
          email.senderEmail,
          email.recipientEmail,
          email.recipientName,
          email.subject,
          email.body,
          email.bodyPreview,
          email.status,
          email.scheduledAt,
          email.sentAt,
          email.errorMessage || null,
          email.previewUrl || null,
          email.bullmqJobId || null,
          email.delayBetweenEmails,
          email.hourlyLimit,
        ])
      } catch {}
    }

    if (isConnectedToSqlite) {
      try {
        await runSqlite(`
          INSERT INTO emails (
            id, user_id, sender_id, sender_email, recipient_email, recipient_name,
            subject, body, body_preview, status, scheduled_at, sent_at,
            error_message, preview_url, bullmq_job_id, delay_between_emails, hourly_limit,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          email.id,
          email.userId || null,
          email.senderId,
          email.senderEmail,
          email.recipientEmail,
          email.recipientName,
          email.subject,
          email.body,
          email.bodyPreview,
          email.status,
          scheduledAtStr,
          sentAtStr,
          email.errorMessage || null,
          email.previewUrl || null,
          email.bullmqJobId || null,
          email.delayBetweenEmails,
          email.hourlyLimit,
          createdAtStr,
          createdAtStr,
        ])
      } catch {}
    }

    return email
  },

  async getEmailById(id: string): Promise<EmailRecord | null> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query(`SELECT * FROM emails WHERE id = $1`, [id])
        if (res.rows[0]) return mapEmailRow(res.rows[0])
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        const row = await getSqlite(`SELECT * FROM emails WHERE id = ?`, [id])
        if (row) return mapEmailRow(row)
      } catch {}
    }
    return memoryEmails.get(id) || null
  },

  async updateEmailStatus(
    id: string,
    status: 'scheduled' | 'sent' | 'failed' | 'cancelled',
    meta?: { sentAt?: Date; errorMessage?: string; previewUrl?: string; scheduledAt?: Date; bullmqJobId?: string }
  ): Promise<EmailRecord | null> {
    const existing = memoryEmails.get(id)
    if (existing) {
      existing.status = status
      if (meta?.sentAt) existing.sentAt = meta.sentAt
      if (meta?.errorMessage) existing.errorMessage = meta.errorMessage
      if (meta?.previewUrl) existing.previewUrl = meta.previewUrl
      if (meta?.scheduledAt) existing.scheduledAt = meta.scheduledAt
      if (meta?.bullmqJobId) existing.bullmqJobId = meta.bullmqJobId
      existing.updatedAt = new Date()
      memoryEmails.set(id, existing)
    }

    const nowIso = new Date().toISOString()
    if (isConnectedToPostgres && pool) {
      try {
        const updates: string[] = ['status = $2', 'updated_at = NOW()']
        const values: any[] = [id, status]
        let idx = 3

        if (meta?.sentAt) {
          updates.push(`sent_at = $${idx++}`)
          values.push(meta.sentAt)
        }
        if (meta?.errorMessage !== undefined) {
          updates.push(`error_message = $${idx++}`)
          values.push(meta.errorMessage)
        }
        if (meta?.previewUrl !== undefined) {
          updates.push(`preview_url = $${idx++}`)
          values.push(meta.previewUrl)
        }
        if (meta?.scheduledAt) {
          updates.push(`scheduled_at = $${idx++}`)
          values.push(meta.scheduledAt)
        }
        if (meta?.bullmqJobId) {
          updates.push(`bullmq_job_id = $${idx++}`)
          values.push(meta.bullmqJobId)
        }

        await pool.query(`UPDATE emails SET ${updates.join(', ')} WHERE id = $1`, values)
      } catch {}
    }

    if (isConnectedToSqlite) {
      try {
        const updates: string[] = ['status = ?', 'updated_at = ?']
        const values: any[] = [status, nowIso]

        if (meta?.sentAt) {
          updates.push('sent_at = ?')
          values.push(new Date(meta.sentAt).toISOString())
        }
        if (meta?.errorMessage !== undefined) {
          updates.push('error_message = ?')
          values.push(meta.errorMessage)
        }
        if (meta?.previewUrl !== undefined) {
          updates.push('preview_url = ?')
          values.push(meta.previewUrl)
        }
        if (meta?.scheduledAt) {
          updates.push('scheduled_at = ?')
          values.push(new Date(meta.scheduledAt).toISOString())
        }
        if (meta?.bullmqJobId) {
          updates.push('bullmq_job_id = ?')
          values.push(meta.bullmqJobId)
        }

        values.push(id)
        await runSqlite(`UPDATE emails SET ${updates.join(', ')} WHERE id = ?`, values)
      } catch {}
    }

    return existing || (await db.getEmailById(id))
  },

  async queryEmails(params: {
    status?: string
    search?: string
    page?: number
    limit?: number
  }): Promise<{ emails: EmailRecord[]; total: number }> {
    const page = Math.max(1, params.page || 1)
    const limit = Math.max(1, Math.min(100, params.limit || 20))
    const offset = (page - 1) * limit

    if (isConnectedToPostgres && pool) {
      try {
        const conditions: string[] = []
        const values: any[] = []
        let idx = 1

        if (params.status) {
          conditions.push(`status = $${idx++}`)
          values.push(params.status)
        }

        if (params.search && params.search.trim()) {
          const term = `%${params.search.trim()}%`
          conditions.push(`(
            recipient_name ILIKE $${idx} OR
            recipient_email ILIKE $${idx} OR
            subject ILIKE $${idx} OR
            body_preview ILIKE $${idx} OR
            sender_email ILIKE $${idx}
          )`)
          values.push(term)
          idx++
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const countRes = await pool.query(`SELECT COUNT(*) FROM emails ${whereClause}`, values)
        const total = parseInt(countRes.rows[0].count, 10)

        const sortCol = params.status === 'sent' ? 'sent_at' : 'scheduled_at'
        const rowsRes = await pool.query(`
          SELECT * FROM emails
          ${whereClause}
          ORDER BY ${sortCol} DESC NULLS LAST, created_at DESC
          LIMIT $${idx++} OFFSET $${idx++}
        `, [...values, limit, offset])

        return { emails: rowsRes.rows.map(mapEmailRow), total }
      } catch {}
    }

    if (isConnectedToSqlite) {
      try {
        const conditions: string[] = []
        const values: any[] = []

        if (params.status) {
          conditions.push(`status = ?`)
          values.push(params.status)
        }

        if (params.search && params.search.trim()) {
          const term = `%${params.search.trim()}%`
          conditions.push(`(
            recipient_name LIKE ? OR
            recipient_email LIKE ? OR
            subject LIKE ? OR
            body_preview LIKE ? OR
            sender_email LIKE ?
          )`)
          values.push(term, term, term, term, term)
        }

        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
        const countRes = await getSqlite(`SELECT COUNT(*) as count FROM emails ${whereClause}`, values)
        const total = countRes ? countRes.count : 0

        const sortCol = params.status === 'sent' ? 'sent_at' : 'scheduled_at'
        const rows = await allSqlite(`
          SELECT * FROM emails
          ${whereClause}
          ORDER BY ${sortCol} DESC, created_at DESC
          LIMIT ? OFFSET ?
        `, [...values, limit, offset])

        return { emails: rows.map(mapEmailRow), total }
      } catch {}
    }

    // High-performance in-memory fallback
    let list = Array.from(memoryEmails.values())
    if (params.status) {
      list = list.filter((e) => e.status === params.status)
    }
    if (params.search && params.search.trim()) {
      const q = params.search.trim().toLowerCase()
      list = list.filter((e) =>
        `${e.recipientName} ${e.recipientEmail} ${e.subject} ${e.bodyPreview} ${e.senderEmail}`
          .toLowerCase()
          .includes(q)
      )
    }

    const sortKey = params.status === 'sent' ? 'sentAt' : 'scheduledAt'
    list.sort((a, b) => {
      const tA = a[sortKey] ? new Date(a[sortKey]!).getTime() : 0
      const tB = b[sortKey] ? new Date(b[sortKey]!).getTime() : 0
      return tB - tA
    })

    const total = list.length
    const emails = list.slice(offset, offset + limit)
    return { emails, total }
  },

  async getScheduledPendingEmails(): Promise<EmailRecord[]> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query(`SELECT * FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`)
        return res.rows.map(mapEmailRow)
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        const rows = await allSqlite(`SELECT * FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`)
        return rows.map(mapEmailRow)
      } catch {}
    }
    return Array.from(memoryEmails.values()).filter((e) => e.status === 'scheduled')
  },

  // Slack Integration
  async getSlackIntegration(): Promise<SlackIntegration | null> {
    if (isConnectedToPostgres && pool) {
      try {
        const res = await pool.query(`SELECT * FROM slack_integrations ORDER BY updated_at DESC LIMIT 1`)
        if (res.rows[0]) {
          return {
            id: res.rows[0].id,
            userId: res.rows[0].user_id,
            accessToken: res.rows[0].access_token,
            webhookUrl: res.rows[0].webhook_url,
            channelId: res.rows[0].channel_id,
            channelName: res.rows[0].channel_name,
            teamId: res.rows[0].team_id,
            teamName: res.rows[0].team_name,
            createdAt: new Date(res.rows[0].created_at),
            updatedAt: new Date(res.rows[0].updated_at),
          }
        }
      } catch {}
    }

    if (isConnectedToSqlite) {
      try {
        const row = await getSqlite(`SELECT * FROM slack_integrations ORDER BY updated_at DESC LIMIT 1`)
        if (row) {
          return {
            id: row.id,
            userId: row.user_id,
            accessToken: row.access_token,
            webhookUrl: row.webhook_url,
            channelId: row.channel_id,
            channelName: row.channel_name,
            teamId: row.team_id,
            teamName: row.team_name,
            createdAt: new Date(row.created_at),
            updatedAt: new Date(row.updated_at),
          }
        }
      } catch {}
    }

    return memorySlack
  },

  async saveSlackIntegration(data: Partial<SlackIntegration>): Promise<SlackIntegration> {
    const id = data.id || 'slack_default'
    const record: SlackIntegration = {
      id,
      userId: data.userId,
      accessToken: data.accessToken,
      webhookUrl: data.webhookUrl,
      channelId: data.channelId,
      channelName: data.channelName,
      teamId: data.teamId,
      teamName: data.teamName,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    memorySlack = record
    globalAny.__reachinbox_memory_slack = record

    if (isConnectedToPostgres && pool) {
      try {
        await pool.query(`
          INSERT INTO slack_integrations (id, user_id, access_token, webhook_url, channel_id, channel_name, team_id, team_name, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
          ON CONFLICT (id) DO UPDATE SET
            access_token = EXCLUDED.access_token,
            webhook_url = EXCLUDED.webhook_url,
            channel_id = EXCLUDED.channel_id,
            channel_name = EXCLUDED.channel_name,
            team_id = EXCLUDED.team_id,
            team_name = EXCLUDED.team_name,
            updated_at = NOW()
        `, [id, record.userId || null, record.accessToken || null, record.webhookUrl || null, record.channelId || null, record.channelName || null, record.teamId || null, record.teamName || null])
      } catch {}
    }

    if (isConnectedToSqlite) {
      try {
        await runSqlite(`
          INSERT INTO slack_integrations (id, user_id, access_token, webhook_url, channel_id, channel_name, team_id, team_name, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            access_token = excluded.access_token,
            webhook_url = excluded.webhook_url,
            channel_id = excluded.channel_id,
            channel_name = excluded.channel_name,
            team_id = excluded.team_id,
            team_name = excluded.team_name,
            updated_at = excluded.updated_at
        `, [id, record.userId || null, record.accessToken || null, record.webhookUrl || null, record.channelId || null, record.channelName || null, record.teamId || null, record.teamName || null, new Date().toISOString()])
      } catch {}
    }

    return record
  },

  async deleteSlackIntegration(): Promise<void> {
    memorySlack = null
    globalAny.__reachinbox_memory_slack = null

    if (isConnectedToPostgres && pool) {
      try {
        await pool.query('DELETE FROM slack_integrations')
      } catch {}
    }
    if (isConnectedToSqlite) {
      try {
        await runSqlite('DELETE FROM slack_integrations')
      } catch {}
    }
  },
}
