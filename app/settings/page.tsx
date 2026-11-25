'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react'
import { Sidebar } from '@/app/page'
import { disconnectSlack, getSlackStatus, slackOAuthUrl } from '@/services/slack.service'
import { getMe, logoutUser, type AuthUser } from '@/services/auth.service'

export default function SettingsPage() {
  const [connected, setConnected] = useState(false)
  const [channel, setChannel] = useState<string | undefined>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<AuthUser | null>(null)

  const checkSlack = () => {
    setLoading(true)
    getSlackStatus()
      .then((x: any) => {
        setConnected(x.connected)
        if (x.channel) setChannel(x.channel)
      })
      .catch(() => setError('Unable to verify Slack connection. Ensure backend service is running.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getMe().then((res) => {
      if (res.user) setUser(res.user)
    })
    checkSlack()
  }, [])

  const disconnect = async () => {
    try {
      await disconnectSlack()
      setConnected(false)
      setChannel(undefined)
    } catch {
      setError('Could not disconnect Slack.')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active="scheduled" user={user} onLogout={() => logoutUser().then(() => window.location.href = '/')} />
      <main className="settings-main">
        <Link href="/" className="settings-back">
          <ArrowLeft size={16} /> Back to inbox
        </Link>
        <h1>Settings &amp; Integrations</h1>

        <section className="settings-section">
          <h2>Slack Rate Limit Notifications</h2>
          <p>
            When a sender's hourly email rate limit is reached, ReachInbox automatically postpones remaining emails to the next hour window and dispatches a live alert to your Slack channel.
          </p>

          <div className="integration-row" style={{ marginTop: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <b>Slack Integration</b>
                {connected && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: '#16a34a', fontSize: '10px' }}>
                    <CheckCircle2 size={12} /> Active {channel ? `(${channel})` : ''}
                  </span>
                )}
              </div>
              <p>{loading ? 'Checking status…' : connected ? 'Live notifications active.' : 'Not connected.'}</p>
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {connected ? (
                <button className="outline-button" onClick={() => void disconnect()} style={{ color: '#dc2626', borderColor: '#fca5a5' }}>
                  Disconnect
                </button>
              ) : (
                <>
                  <a className="outline-button" href={slackOAuthUrl()}>
                    Connect Slack <ExternalLink size={13} />
                  </a>
                  <a
                    className="outline-button"
                    style={{ background: '#f8fafc', color: '#64748b' }}
                    href="/api/v1/slack/demo-connect"
                  >
                    Quick Test Connect
                  </a>
                </>
              )}
            </div>
          </div>
          {error && <p className="integration-error">{error}</p>}
        </section>

        <section className="settings-section">
          <h2>BullMQ Queue Monitoring</h2>
          <p>
            View real-time delayed jobs, active workers, rate-limited postponements, and retry metrics in the Bull Board dashboard.
          </p>
          <div style={{ marginTop: '14px' }}>
            <a
              href="/admin/queues"
              target="_blank"
              rel="noreferrer"
              className="outline-button"
              style={{ background: '#16c784', color: '#fff', border: 0, gap: '6px' }}
            >
              Open Live Queue Dashboard <ExternalLink size={14} />
            </a>
          </div>
        </section>

        <section className="settings-section">
          <h2>System Health &amp; Endpoints</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px', color: '#64748b', marginTop: '10px' }}>
            <div>Backend API: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>/api/v1</code></div>
            <div>Health check: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>/health</code></div>
            <div>Bull-Board: <code style={{ background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>/admin/queues</code></div>
          </div>
        </section>
      </main>
    </div>
  )
}
