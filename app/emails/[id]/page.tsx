'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  Star,
  Trash2,
  CalendarClock,
  ExternalLink,
  CheckCircle2,
  Clock3,
  AlertTriangle,
} from 'lucide-react'
import { Sidebar } from '@/app/page'
import { cancelEmail, getEmail, rescheduleEmail, type Email } from '@/services/email.service'
import { getMe, logoutUser, type AuthUser } from '@/services/auth.service'

export default function EmailDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [mail, setMail] = useState<Email | null>(null)
  const [error, setError] = useState('')
  const [rescheduling, setRescheduling] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [notice, setNotice] = useState('')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    getMe().then((res) => {
      if (res.user) setUser(res.user)
    })
    getEmail(id)
      .then((data) => {
        setMail(data)
        if (data.scheduledAt) {
          setNewDate(new Date(data.scheduledAt).toISOString().slice(0, 16))
        }
      })
      .catch(() => setError('Email details are unavailable. Check that the backend is running.'))
  }, [id])

  const handleCancel = async () => {
    if (!mail) return
    if (!window.confirm('Are you sure you want to cancel this scheduled email?')) return
    try {
      await cancelEmail(mail.id)
      router.push('/?status=scheduled')
    } catch {
      setError('Unable to cancel this scheduled email.')
    }
  }

  const handleReschedule = async () => {
    if (!mail || !newDate) return
    try {
      await rescheduleEmail(mail.id, new Date(newDate).toISOString())
      setNotice('Email rescheduled successfully in BullMQ.')
      setRescheduling(false)
      const refreshed = await getEmail(id)
      setMail(refreshed)
    } catch (err: any) {
      setNotice('Could not reschedule email.')
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        active={mail?.status === 'sent' ? 'sent' : 'scheduled'}
        user={user}
        onLogout={() => logoutUser().then(() => router.push('/'))}
      />
      <main className="detail-main">
        <header className="detail-toolbar">
          <Link href={`/?status=${mail?.status === 'sent' ? 'sent' : 'scheduled'}`} aria-label="Back to emails">
            <ArrowLeft size={17} />
          </Link>
          <span />
          <button aria-label="Star">
            <Star size={15} />
          </button>
          {mail?.status === 'scheduled' && (
            <button aria-label="Cancel scheduled email" onClick={() => void handleCancel()} title="Cancel Email">
              <Trash2 size={15} color="#e11d48" />
            </button>
          )}
        </header>

        {notice && (
          <div
            style={{
              padding: '8px 14px',
              borderRadius: '6px',
              background: '#ecfdf5',
              color: '#065f46',
              fontSize: '11px',
              margin: '10px 0',
            }}
          >
            {notice}
          </div>
        )}

        {error ? (
          <div className="detail-error">{error}</div>
        ) : !mail ? (
          <div className="detail-error">Loading email details…</div>
        ) : (
          <article className="message-detail">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <h1>{mail.subject}</h1>

              {mail.status === 'sent' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: '#f0fdf4',
                    color: '#16a34a',
                    fontSize: '10px',
                    fontWeight: 500,
                  }}
                >
                  <CheckCircle2 size={12} /> Sent
                </span>
              ) : mail.status === 'scheduled' ? (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: '#fff7ed',
                    color: '#ea580c',
                    fontSize: '10px',
                    fontWeight: 500,
                  }}
                >
                  <Clock3 size={12} /> Scheduled
                </span>
              ) : (
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    background: '#fef2f2',
                    color: '#dc2626',
                    fontSize: '10px',
                    fontWeight: 500,
                  }}
                >
                  <AlertTriangle size={12} /> {mail.status}
                </span>
              )}
            </div>

            <div className="message-meta">
              <span className="sender-avatar">{mail.sender[0].toUpperCase()}</span>
              <div>
                <b>{mail.sender}</b>
                <small>
                  To: {mail.recipientName} &lt;{mail.recipient}&gt;
                </small>
              </div>
              <time>
                {mail.sentAt
                  ? `Sent: ${new Date(mail.sentAt).toLocaleString()}`
                  : mail.scheduledAt
                  ? `Scheduled for: ${new Date(mail.scheduledAt).toLocaleString()}`
                  : ''}
              </time>
            </div>

            <div
              className="message-content"
              dangerouslySetInnerHTML={{ __html: mail.body || mail.bodyPreview }}
            />

            {mail.previewUrl && (
              <div
                style={{
                  margin: '20px 37px',
                  padding: '14px 18px',
                  borderRadius: '8px',
                  border: '1px solid #bbf7d0',
                  background: '#f0fdf4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <b style={{ color: '#166534', fontSize: '12px' }}>Live Ethereal SMTP Preview Available</b>
                  <p style={{ margin: '4px 0 0', color: '#15803d', fontSize: '10px' }}>
                    View the real HTML email rendered on the Ethereal test mail server.
                  </p>
                </div>
                <a
                  href={mail.previewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="outline-button"
                  style={{ background: '#16a34a', color: '#fff', border: 0, gap: '6px' }}
                >
                  View on Ethereal <ExternalLink size={12} />
                </a>
              </div>
            )}

            {mail.status === 'scheduled' && (
              <div className="detail-actions" style={{ alignItems: 'center' }}>
                {!rescheduling ? (
                  <>
                    <button className="outline-button" onClick={() => setRescheduling(true)}>
                      <CalendarClock size={13} style={{ marginRight: '5px' }} /> Reschedule
                    </button>
                    <button
                      className="outline-button"
                      style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                      onClick={() => void handleCancel()}
                    >
                      Cancel scheduled email
                    </button>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="datetime-local"
                      value={newDate}
                      onChange={(e) => setNewDate(e.target.value)}
                      style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '11px' }}
                    />
                    <button className="outline-button" onClick={() => void handleReschedule()}>
                      Save New Time
                    </button>
                    <button className="outline-button" onClick={() => setRescheduling(false)}>
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )}
          </article>
        )}
      </main>
    </div>
  )
}
