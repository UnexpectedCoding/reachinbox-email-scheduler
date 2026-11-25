# ReachInbox Email Scheduler

A distributed email scheduling platform built with TypeScript, Express, BullMQ, Redis, PostgreSQL (with SQLite fallback), Nodemailer (Ethereal SMTP), Elasticsearch, and Next.js.

The system handles time-delayed email dispatches, sender-level rate limiting, concurrency control, and restart persistence without using cron jobs.

---

## Architecture Overview

### 1. Scheduling Mechanism (No Cron)
This system does not use OS-level cron (`crontab`) or Node cron libraries (`node-cron`, `agenda`). Instead, scheduling is implemented using **BullMQ delayed jobs** backed by Redis sorted sets (`ZSET`):

1. When an email campaign is scheduled with a target timestamp $T$, the backend calculates the delay:
   $$\text{delay} = \max(0, T - \text{Date.now()})$$
2. For multiple recipients in a batch, each subsequent recipient is offset by the configured inter-email delay:
   $$T_i = T_{\text{start}} + (i \times \text{delayBetweenEmails} \times 1000)$$
3. Each job is added to the BullMQ queue (`email-queue`) with its specific delay and unique `jobId`:
   ```ts
   await queue.add('send-email', jobData, { delay, jobId: email.id })
   ```
4. Redis stores the job in a sorted set ordered by execution timestamp. Redis triggers the job when the timer expires, and the worker picks it up without polling loops.

### 2. Persistence & Idempotency Across Restarts
To prevent email duplication and guarantee that future emails execute at the correct time following a server crash or restart:

- **Strict Idempotency**: Every job uses `jobId = email.id`. BullMQ guarantees that a job with an identical ID cannot be enqueued or executed more than once.
- **Relational Storage**: Email records are inserted into the database (`PostgreSQL` or disk-persisted `SQLite`) before enqueueing, storing their current status (`scheduled`, `sent`, `failed`, `cancelled`), target timestamp, and job reference.
- **Startup Reconciliation**: During server boot, `recoverPendingScheduledJobs()` queries the database for emails with `status = 'scheduled'`. If Redis was restarted or flushed, the routine re-enqueues missing jobs with their remaining delay:
  $$\text{remainingDelay} = \max(0, \text{scheduledAt} - \text{Date.now()})$$
  Because `jobId` matches the email ID, existing jobs are safely de-duplicated.

### 3. Concurrency & Provider Throttling
Email providers enforce rate and throughput thresholds. The scheduler implements two layers of throttling:

- **Worker Concurrency**: The BullMQ worker is configured with configurable concurrency (`WORKER_CONCURRENCY=5`). Multiple worker instances can run in parallel across machines without race conditions.
- **Minimum Inter-Send Delay**: To avoid burst-triggering provider spam filters, workers enforce an explicit delay between consecutive sends (`MIN_DELAY_BETWEEN_EMAILS_MS=2000` / 2 seconds).

### 4. Hourly Rate Limiting & Load Rescheduling
To prevent sender domains from exceeding provider limits (e.g. 100 emails/hour/sender):

- **Atomic Counters**: Sent volume is tracked using Redis keys formatted by sender and UTC hour window:
  ```
  ratelimit:<sender_email>:<YYYY-MM-DD-HH>
  ```
  Increments use atomic Redis `INCR` with a 3900-second TTL.
- **Rescheduling Behavior (No Dropped Jobs)**:
  When an email would cause the sender's count to exceed `hourlyLimit`:
  1. The job is **not dropped** and is **not marked as failed**.
  2. The system computes the time remaining until the start of the next hour window:
     $$\text{nextWindowDelay} = \text{startOfNextHour} - \text{now} + 1500\text{ms}$$
  3. The job is re-enqueued for that window, and its database/Elasticsearch records are updated with the postponed timestamp.
  4. Order is preserved for remaining queued items.

### 5. Live Slack Alerts
When a sender hits their hourly limit for the first time in a given window:
- The system checks if the user or workspace has connected Slack via OAuth or configured an incoming webhook.
- An alert is dispatched via HTTP POST to the Slack Webhook or Web API (`chat.postMessage`), containing the sender email, limit, current count, and the time to which subsequent jobs were postponed.
- A deduplication flag (`slack_alert_sent:<sender>:<window>`) ensures only one notification is sent per window per sender.
- If Slack is not connected, the scheduler logs the event and continues execution without errors.

### 6. Elasticsearch Search & Indexing
- Emails are indexed into Elasticsearch (`emails` index) upon scheduling.
- Updates (`status`, `sentAt`, `previewUrl`, `errorMessage`) are synchronized in real-time.
- Searches via `/api/v1/emails?search=...` query across `recipient`, `recipientName`, `sender`, `subject`, `body`, and `bodyPreview` with fuzziness.
- If Elasticsearch is offline or unreachable, the database layer transparently falls back to SQL `LIKE` / `ILIKE` queries so search functionality remains available.

---

## Implemented Features

### Backend
| Requirement | Status | Implementation Details |
|---|---|---|
| Non-cron scheduling | Complete | Implemented via BullMQ delayed jobs backed by Redis sorted sets. |
| Relational DB | Complete | PostgreSQL with automatic schema migration, plus SQLite fallback (`email_scheduler.sqlite`). |
| Multi-sender SMTP | Complete | Nodemailer with Ethereal SMTP. Auto-creates test accounts on startup. |
| Email preview links | Complete | Captures `previewUrl` from Nodemailer for browser rendering. |
| Restart persistence | Complete | Database state + `recoverPendingScheduledJobs()` reconciliation routine on boot. |
| Idempotency | Complete | Enforced via BullMQ deterministic `jobId` (`email.id`). |
| Concurrency control | Complete | Configurable worker pool (`WORKER_CONCURRENCY`, default 5). |
| Inter-send delay | Complete | Configurable delay (`MIN_DELAY_BETWEEN_EMAILS_MS`, default 2000ms). |
| Hourly rate limiting | Complete | Atomic Redis hour-window counters; non-dropping rescheduling to next hour. |
| Slack notification | Complete | Slack OAuth + Webhook dispatcher when sender hourly limit is reached. |
| Search indexing | Complete | Elasticsearch 8.x indexing with fallback to SQL pattern matching. |
| Live queue dashboard | Complete | Bull-Board mounted at `/admin/queues`. |
| Google OAuth | Complete | OAuth 2.0 flow with JWT cookie issuance and demo login mode. |

### Frontend
| Requirement | Status | Implementation Details |
|---|---|---|
| Google Login | Complete | Real Google OAuth redirect flow, session checking (`/api/v1/auth/me`), and demo login option. |
| User header | Complete | Displays user avatar, display name, email, and logout button in sidebar/header. |
| Main dashboard | Complete | Tabbed view for **Scheduled Emails** and **Sent Emails** with counts and status badges. |
| Compose page | Complete | Subject, rich HTML body, dynamic sender selector, delay and hourly limit inputs. |
| Lead file upload | Complete | Client-side CSV/text parser detecting valid email formats and displaying detected count. |
| Search bar | Complete | Connects to Elasticsearch/backend search endpoint with debounced execution. |
| Detail view | Complete | Full email preview, metadata, status indicators, and live Ethereal test mail link. |
| Reschedule / Cancel | Complete | In-place modal to reschedule future sends; cancel action to remove from BullMQ. |
| Settings page | Complete | Slack connection state, OAuth connect/disconnect buttons, and Bull-Board link. |
| UX states | Complete | Loading skeletons, empty state illustrations, and error banners. |

---

## Environment Variables

### Backend Configuration (`backend/.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `5000` | Port for the Express backend server. |
| `API_BASE_URL` | `http://localhost:5000/api/v1` | Public API base URL. |
| `FRONTEND_URL` | `http://localhost:3000` | Allowed CORS origin for the frontend. |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/email_scheduler` | PostgreSQL connection string. Falls back to local SQLite if unreachable. |
| `REDIS_HOST` | `localhost` | Redis host for BullMQ and rate limiting. |
| `REDIS_PORT` | `6379` | Redis port. |
| `REDIS_PASSWORD` | *(empty)* | Redis authentication password (if applicable). |
| `WORKER_CONCURRENCY` | `5` | Number of jobs processed in parallel by the worker. |
| `MIN_DELAY_BETWEEN_EMAILS_MS` | `2000` | Delay between individual email dispatches (provider throttling). |
| `MAX_EMAILS_PER_HOUR_PER_SENDER` | `100` | Hourly rate limit ceiling per sender. |
| `ELASTICSEARCH_NODE` | `http://localhost:9200` | Elasticsearch node URL. |
| `ELASTICSEARCH_INDEX` | `emails` | Elasticsearch index name. |
| `ETHEREAL_USER` | *(empty)* | Ethereal SMTP username. Auto-generated on boot if omitted. |
| `ETHEREAL_PASS` | *(empty)* | Ethereal SMTP password. Auto-generated on boot if omitted. |
| `GOOGLE_CLIENT_ID` | *(empty)* | Google Cloud OAuth 2.0 client ID. |
| `GOOGLE_CLIENT_SECRET` | *(empty)* | Google Cloud OAuth 2.0 client secret. |
| `GOOGLE_CALLBACK_URL` | `http://localhost:5000/api/v1/auth/google/callback` | Google OAuth redirect URI. |
| `JWT_SECRET` | *(default provided)* | Secret key used for signing session JWT tokens. |
| `SLACK_CLIENT_ID` | *(empty)* | Slack app client ID for OAuth. |
| `SLACK_CLIENT_SECRET` | *(empty)* | Slack app client secret. |
| `SLACK_REDIRECT_URI` | `http://localhost:5000/api/v1/slack/oauth/callback` | Slack OAuth redirect URI. |
| `SLACK_WEBHOOK_URL` | *(empty)* | Direct Slack incoming webhook URL (optional override). |

### Frontend Configuration (`.env.local`)

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `http://localhost:5000/api/v1` | Target URL for backend REST API calls. |
| `NEXT_PUBLIC_DEMO_MODE` | `false` | Enables offline UI mock mode if set to `true`. |

---

## Setting Up Ethereal Email

Ethereal is a fake SMTP service used for testing. Sent emails are not delivered to real inboxes; instead, they generate a URL where the rendered message can be inspected in a browser.

### Automatic Setup (Default)
Leave `ETHEREAL_USER` and `ETHEREAL_PASS` blank in `backend/.env`. When the server starts, it calls `nodemailer.createTestAccount()` automatically, prints the generated credentials to the console, and uses them for the session.

### Manual Setup
1. Visit [ethereal.email/create](https://ethereal.email/create) to generate an account.
2. Add the credentials to `backend/.env`:
   ```ini
   ETHEREAL_USER=your_user@ethereal.email
   ETHEREAL_PASS=your_password
   ```
3. Whenever an email is sent, click **"View on Ethereal"** in the frontend or check the console for the `https://ethereal.email/message/...` preview link.

---

## Running the Application

### Option A: Using Docker Compose (Full Stack)

If Docker is installed and running:

1. Start PostgreSQL, Redis, and Elasticsearch:
   ```bash
   docker compose up -d
   ```
2. Start the backend:
   ```bash
   cd backend
   npm install
   npm run dev
   ```
3. Start the frontend:
   ```bash
   cd ..
   npm install
   npm run dev
   ```

---

### Option B: Without Docker (Local / Standalone)

If Docker is unavailable, the application runs directly on Windows using local binaries or embedded fallbacks:

#### 1. Start Redis
A portable Windows Redis binary is included in `backend/redis/`:
- Run `npm run redis` in the `backend/` directory, or
- Double-click `backend\start-redis.bat`.

*(Alternatively, configure a free cloud Redis instance from [Upstash](https://upstash.com) in `backend/.env`).*

#### 2. Start the Backend
```bash
cd backend
npm install
npm run dev
```
- If PostgreSQL is offline, the backend automatically connects to the embedded SQLite database (`backend/email_scheduler.sqlite`).
- If Elasticsearch is offline, searches automatically fall back to SQL queries.

#### 3. Start the Frontend
In a new terminal in the project root:
```bash
npm install
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## Verification & Walkthrough

1. **Authentication**: Navigate to `http://localhost:3000`. Sign in using Google OAuth or click **"Continue as Demo User"** for instant access as Oliver Brown.
2. **Scheduling a Batch**:
   - Go to `/compose`.
   - Click **"+ Upload CSV/Text Leads"** and select `test-leads.csv` (10 sample recipients included).
   - Set delay (e.g. `2` seconds) and hourly limit (e.g. `100`).
   - Pick a send time and submit.
3. **Queue Visibility**: Open `http://localhost:5000/admin/queues` to inspect delayed jobs, countdown timers, and job payloads in Bull-Board.
4. **Verifying Rate Limiting & Slack**:
   - In Settings (`/settings`), click **"Quick Test Connect"** under Slack.
   - Schedule 3 emails with an hourly limit of `1`.
   - Observe in the console: email #1 sends, emails #2 and #3 are rescheduled into the next hour window, and a Slack alert is dispatched.
5. **Viewing Sent Previews**:
   - Open the **Sent** tab (`/?status=sent`).
   - Click on an email and click **"View on Ethereal"** to open the message preview.
6. **Elasticsearch Query**: Enter a search term (e.g. `Michael` or `Outreach`) in the dashboard toolbar to test full-text search.
7. **Automated CLI Verification**:
   With the backend running, execute the verification script:
   ```bash
   node scripts/test-scheduler.js
   ```
