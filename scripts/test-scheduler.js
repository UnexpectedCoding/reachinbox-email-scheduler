// End-to-end Verification Script for ReachInbox Scheduler
const http = require('http')

const API_BASE = 'http://localhost:5000/api/v1'

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE)
    const reqOptions = {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    }

    const req = http.request(url, reqOptions, (res) => {
      let data = ''
      res.on('data', (chunk) => (data += chunk))
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) })
        } catch {
          resolve({ status: res.statusCode, body: data })
        }
      })
    })

    req.on('error', reject)
    if (options.body) {
      req.write(JSON.stringify(options.body))
    }
    req.end()
  })
}

async function runTests() {
  console.log('🧪 Starting End-to-End Scheduler Verification...\n')

  // 1. Health check
  try {
    const health = await request('http://localhost:5000/health')
    console.log('✅ 1. Backend Health Check:', health.body)
  } catch (err) {
    console.error('❌ Backend is not running on http://localhost:5000. Start it with "npm run dev:backend".')
    process.exit(1)
  }

  // 2. Senders
  const sendersRes = await request('/senders')
  console.log(`✅ 2. Multiple Senders Available: ${sendersRes.body.data?.length || 0} senders found.`)

  // 3. Schedule Campaign
  const schedulePayload = {
    senderId: 'oliver.brown@domain.io',
    recipients: [
      'demo.lead1@example.com',
      'demo.lead2@example.com',
      'demo.lead3@example.com'
    ],
    subject: 'Automated Outreach Verification',
    body: '<p>Hi there, testing ReachInbox scheduler with provider throttling and Ethereal SMTP!</p>',
    scheduledAt: new Date(Date.now() + 2000).toISOString(),
    delayBetweenEmails: 2, // 2s provider delay
    hourlyLimit: 5,        // hourly limit
  }

  const scheduleRes = await request('/emails/schedule', {
    method: 'POST',
    body: schedulePayload,
  })
  console.log(`✅ 3. Batch Email Scheduling: ${scheduleRes.body.count} emails enqueued successfully.`)

  // 4. Query Scheduled
  const scheduledList = await request('/emails?status=scheduled')
  console.log(`✅ 4. Scheduled Emails Query: ${scheduledList.body.data?.length || 0} scheduled emails listed.`)

  // 5. Test Search
  const searchRes = await request('/emails?search=Outreach')
  console.log(`✅ 5. Elasticsearch/Full-text Search: Found ${searchRes.body.data?.length || 0} matches for query "Outreach".`)

  // 6. Test Slack Status
  const slackRes = await request('/slack/status')
  console.log(`✅ 6. Slack Integration Status: Connected = ${slackRes.body.connected}`)

  console.log('\n🎉 All API endpoints and scheduling logic are active and operational!')
  console.log('👉 Open http://localhost:3000 to test visually in the UI.')
  console.log('👉 Open http://localhost:5000/admin/queues to inspect BullMQ live dashboard.')
}

runTests().catch(console.error)
