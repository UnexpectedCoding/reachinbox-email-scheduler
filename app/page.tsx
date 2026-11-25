'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Search,
  Filter,
  RefreshCw,
  Clock3,
  Send,
  Star,
  ChevronDown,
  Plus,
  Paperclip,
  ArrowLeft,
  X,
  Settings,
  ExternalLink,
  Bold,
  Italic,
  Underline,
  ListOrdered,
  List,
  AlignLeft,
  Link2,
  RotateCcw,
  RotateCw,
  LogOut,
  Mail,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react'
import { getEmails, scheduleEmail, type Email } from '@/services/email.service'
import { getSenders, type Sender } from '@/services/sender.service'
import { getMe, logoutUser, getGoogleOAuthUrl, getDemoLoginUrl, type AuthUser } from '@/services/auth.service'

export function Sidebar({ active, user, onLogout }: { active: 'scheduled' | 'sent'; user: AuthUser | null; onLogout: () => void }) {
  const [menu, setMenu] = useState(false)
  const displayName = user?.name || 'Oliver Brown'
  const displayEmail = user?.email || 'oliver.brown@domain.io'
  const avatarLetter = displayName[0]?.toUpperCase() || 'O'

  return (
    <aside className="sidebar">
      <Link href="/" className="logo">ONB</Link>

      <button className="profile" onClick={() => setMenu(!menu)} aria-expanded={menu}>
        {user?.picture ? (
          <img src={user.picture} alt={displayName} className="avatar object-cover" />
        ) : (
          <span className="avatar">{avatarLetter}</span>
        )}
        <span className="profile-copy">
          <b>{displayName}</b>
          <small>{displayEmail}</small>
        </span>
        <ChevronDown size={13} />
      </button>

      {menu && (
        <div className="profile-menu">
          <Link href="/settings">
            <Settings size={14} /> Settings & integrations
          </Link>
          <a href="/admin/queues" target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Queue monitoring
          </a>
          <button
            onClick={onLogout}
            style={{ width: '100%', border: 0, background: 'none', display: 'flex', alignItems: 'center', gap: '8px', padding: '9px', color: '#c74444', cursor: 'pointer', fontSize: '11px', borderRadius: '5px' }}
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      )}

      <Link href="/compose" className="compose-link">
        Compose
      </Link>

      <div className="section-label">CORE</div>
      <nav className="side-nav">
        <Link href="/?status=scheduled" className={active === 'scheduled' ? 'active' : ''}>
          <Clock3 size={14} /> Scheduled
        </Link>
        <Link href="/?status=sent" className={active === 'sent' ? 'active' : ''}>
          <Send size={14} /> Sent
        </Link>
      </nav>
    </aside>
  )
}

function GoogleLoginPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8fafc', padding: '20px' }}>
      <div style={{ maxWidth: '420px', width: '100%', background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '36px 32px', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.05)', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '12px', background: '#e6f7ef', color: '#0b9e62', marginBottom: '20px' }}>
          <Mail size={26} />
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 600, color: '#1e293b', margin: '0 0 8px' }}>ReachInbox Scheduler</h1>
        <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 28px', lineHeight: 1.5 }}>
          Sign in to schedule cold emails with provider rate limiting, BullMQ queue monitoring, and Slack notifications.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a
            href={getGoogleOAuthUrl()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              height: '42px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#334155',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 500,
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
              transition: 'background 0.2s',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z" />
              <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.98 0 12s.45 3.82 1.25 5.42l4.03-3.15z" />
              <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
            </svg>
            Sign in with Google
          </a>

          <a
            href={getDemoLoginUrl()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              height: '40px',
              borderRadius: '8px',
              border: '1px solid #16c784',
              background: '#f0fdf4',
              color: '#15803d',
              textDecoration: 'none',
              fontSize: '12px',
              fontWeight: 500,
            }}
          >
            Continue as Demo User (Instant)
          </a>
        </div>
      </div>
    </div>
  )
}

function HomeContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const status = searchParams.get('status') === 'sent' ? 'sent' : 'scheduled'

  const [user, setUser] = useState<AuthUser | null>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  const [emails, setEmails] = useState<Email[]>([])
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [starred, setStarred] = useState<string[]>([])
  const [filterOpen, setFilterOpen] = useState(false)

  // Verify auth on mount
  useEffect(() => {
    getMe()
      .then((res) => {
        if (res.authenticated && res.user) {
          setUser(res.user)
        } else {
          // If demo mode or initial visit, fallback to demo user
          setUser(res.user || { id: 'usr_demo', name: 'Oliver Brown', email: 'oliver.brown@domain.io' })
        }
      })
      .finally(() => setCheckingAuth(false))
  }, [])

  const handleLogout = async () => {
    await logoutUser()
    setUser(null)
  }

  const load = async () => {
    setBusy(true)
    setError('')
    try {
      const data = await getEmails({ status, search: query, page: 1, limit: 50 })
      setEmails(data)
    } catch {
      setEmails([])
      setError('Could not connect to the backend scheduler. Ensure backend service is running.')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (user) {
      void load()
    }
  }, [status, user])

  // Trigger search on debounce or Enter
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void load()
  }

  const filtered = useMemo(
    () =>
      emails.filter((e) =>
        `${e.recipientName} ${e.recipient} ${e.subject} ${e.bodyPreview}`.toLowerCase().includes(query.toLowerCase())
      ),
    [emails, query]
  )

  if (checkingAuth) {
    return <div className="list-state" style={{ minHeight: '100vh' }}>Checking session…</div>
  }

  if (!user) {
    return <GoogleLoginPage />
  }

  return (
    <div className="app-shell">
      <Sidebar active={status} user={user} onLogout={handleLogout} />
      <main className="main-pane">
        <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid #f1f2f3', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: 600, margin: 0, textTransform: 'capitalize' }}>
              {status} Emails
            </h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Link
                href="/?status=scheduled"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                  background: status === 'scheduled' ? '#e6f7ef' : '#f1f5f9',
                  color: status === 'scheduled' ? '#0b9e62' : '#64748b',
                  fontWeight: status === 'scheduled' ? 600 : 400,
                }}
              >
                Scheduled
              </Link>
              <Link
                href="/?status=sent"
                style={{
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '14px',
                  textDecoration: 'none',
                  background: status === 'sent' ? '#e6f7ef' : '#f1f5f9',
                  color: status === 'sent' ? '#0b9e62' : '#64748b',
                  fontWeight: status === 'sent' ? 600 : 400,
                }}
              >
                Sent
              </Link>
            </div>
          </div>

          <Link href="/compose" className="outline-button" style={{ background: '#16c784', color: '#fff', border: 0, fontWeight: 500 }}>
            <Plus size={13} style={{ marginRight: '4px' }} /> Compose New Email
          </Link>
        </header>

        <div className="toolbar">
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flex: 1, maxWidth: '560px' }}>
            <label className="search-box">
              <Search size={15} />
              <input
                aria-label="Search emails via Elasticsearch"
                placeholder="Search recipient, subject, body (Elasticsearch indexed)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
          </form>

          <button className="icon-button" aria-label="Filter emails" onClick={() => setFilterOpen(!filterOpen)}>
            <Filter size={15} />
          </button>
          <button className="icon-button" aria-label="Refresh emails" onClick={() => void load()}>
            <RefreshCw size={15} />
          </button>
        </div>

        {filterOpen && (
          <div className="filter-popover">
            <span>Filter</span>
            <button onClick={() => setFilterOpen(false)}>All {status} emails</button>
            <button
              onClick={() => {
                setQuery('')
                setFilterOpen(false)
                void load()
              }}
            >
              Clear search
            </button>
          </div>
        )}

        <section className="email-list" aria-label={`${status} emails`}>
          {busy && <div className="list-state">Loading emails from queue &amp; database…</div>}

          {!busy && error && (
            <div className="list-state error-state">
              <AlertCircle size={24} color="#e11d48" style={{ marginBottom: '6px' }} />
              <b>Unable to load emails</b>
              <span>{error}</span>
              <button className="outline-button compact" onClick={() => void load()}>
                Try again
              </button>
            </div>
          )}

          {!busy && !error && filtered.length === 0 && (
            <div className="list-state" style={{ flexDirection: 'column', gap: '8px' }}>
              <Mail size={32} color="#cbd5e1" />
              <b>{query ? 'No emails match your search query.' : `No ${status} emails found.`}</b>
              <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                {status === 'scheduled'
                  ? 'Click "Compose New Email" above to schedule automated campaigns.'
                  : 'Sent messages will appear here once dispatched via Ethereal SMTP.'}
              </span>
            </div>
          )}

          {!busy &&
            !error &&
            filtered.map((mail) => (
              <Link href={`/emails/${mail.id}`} className="email-row" key={mail.id}>
                <span className="recipient" title={mail.recipient}>
                  To: {mail.recipientName || mail.recipient}
                </span>

                {status === 'scheduled' ? (
                  <span className="time-badge">
                    <Clock3 size={11} />
                    {mail.scheduledAt
                      ? new Date(mail.scheduledAt).toLocaleString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : 'Pending'}
                  </span>
                ) : (
                  <span className="sent-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <CheckCircle2 size={10} color="#16a34a" /> Sent
                  </span>
                )}

                <span className="subject">{mail.subject}</span>
                <span className="preview">- {mail.bodyPreview}</span>

                <button
                  aria-label={starred.includes(mail.id) ? 'Unstar email' : 'Star email'}
                  className="star-button"
                  onClick={(e) => {
                    e.preventDefault()
                    setStarred((s) =>
                      s.includes(mail.id) ? s.filter((x) => x !== mail.id) : [...s, mail.id]
                    )
                  }}
                >
                  <Star size={14} fill={starred.includes(mail.id) ? '#f5bf5b' : 'none'} />
                </button>
              </Link>
            ))}
        </section>

        {!busy && !error && filtered.length > 0 && (
          <button className="load-more" onClick={() => void load()}>
            Refresh list
          </button>
        )}
      </main>
    </div>
  )
}

export default function Home() {
  return (
    <Suspense fallback={<div className="list-state" style={{ minHeight: '100vh' }}>Loading ReachInbox…</div>}>
      <HomeContent />
    </Suspense>
  )
}

export function ComposePage() {
  const router = useRouter()
  const [to, setTo] = useState('')
  const [recipients, setRecipients] = useState<string[]>([])
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [delay, setDelay] = useState('2') // Default 2 seconds minimum delay
  const [limit, setLimit] = useState('100') // Default 100 emails per hour
  const [scheduled, setScheduled] = useState('')
  const [popover, setPopover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [fileSummary, setFileSummary] = useState('')
  const [sender, setSender] = useState('oliver.brown@domain.io')
  const [sendersList, setSendersList] = useState<Sender[]>([])
  const [fileRef, setFileRef] = useState<HTMLInputElement | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    getMe().then((res) => {
      if (res.user) setUser(res.user)
    })
    getSenders()
      .then((res) => {
        if (res.data?.length) {
          setSendersList(res.data)
          setSender(res.data[0].email)
        }
      })
      .catch(() => {})
  }, [])

  const add = (value: string) => {
    const emails = value
      .split(/[\s,;]+/)
      .map((x) => x.trim().toLowerCase())
      .filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))
    setRecipients((old) => Array.from(new Set([...old, ...emails])))
  }

  const upload = (file?: File) => {
    if (!file) return
    void file.text().then((text) => {
      const candidates = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || []
      const valid = Array.from(new Set(candidates.map((x) => x.toLowerCase())))
      const totalLines = text.split(/[\r\n,;]+/).filter(Boolean).length
      const invalid = Math.max(0, totalLines - valid.length)
      setRecipients((old) => Array.from(new Set([...old, ...valid])))
      setFileSummary(`${valid.length} valid email addresses detected${invalid ? ` · ${invalid} duplicates/invalid skipped` : ''}`)
    })
  }

  const quick = (hours: number) => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    d.setHours(hours, 0, 0, 0)
    setScheduled(d.toISOString().slice(0, 16))
    setPopover(false)
  }

  const send = async () => {
    add(to)
    const all = Array.from(new Set([...recipients, ...to.split(/[\s,;]+/).filter((x) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x))]))

    if (!all.length || !subject.trim() || !body.trim()) {
      setNotice('Please provide at least one recipient, a subject, and email body.')
      return
    }

    const scheduledDate = scheduled ? new Date(scheduled) : new Date(Date.now() + 5000)

    setSaving(true)
    setNotice('')

    try {
      await scheduleEmail({
        senderId: sender,
        recipients: all,
        subject,
        body,
        scheduledAt: scheduledDate.toISOString(),
        delayBetweenEmails: Number(delay) || 2,
        hourlyLimit: Number(limit) || 100,
      })

      setNotice(`✅ ${all.length} emails scheduled successfully via BullMQ!`)
      setTimeout(() => router.push('/?status=scheduled'), 800)
    } catch (err: any) {
      setNotice(`Error scheduling: ${err.message || 'Please check backend connection.'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="app-shell">
      <Sidebar active="scheduled" user={user} onLogout={() => logoutUser().then(() => router.push('/'))} />
      <main className="compose-main">
        <header className="compose-header">
          <button className="back-button" onClick={() => router.back()} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
          <h1>Compose New Email Campaign</h1>
          <span className="header-spacer" />
          <button
            className="icon-button"
            aria-label="Attach file"
            onClick={() => setNotice('Attachments will be sent via Ethereal SMTP.')}
          >
            <Paperclip size={16} />
          </button>
          <button className="icon-button" aria-label="Choose send time" onClick={() => setPopover(!popover)}>
            <Clock3 size={16} />
          </button>
          <button className="outline-button send-button" onClick={() => setPopover(!popover)}>
            {scheduled
              ? new Date(scheduled).toLocaleString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })
              : 'Send Later'}
          </button>
        </header>

        <div className="compose-content">
          <div className="form-row">
            <label htmlFor="sender">From</label>
            <select id="sender" value={sender} onChange={(e) => setSender(e.target.value)}>
              {sendersList.length > 0 ? (
                sendersList.map((s) => (
                  <option key={s.id} value={s.email}>
                    {s.name ? `${s.name} <${s.email}>` : s.email}
                  </option>
                ))
              ) : (
                <>
                  <option value="oliver.brown@domain.io">Oliver Brown &lt;oliver.brown@domain.io&gt;</option>
                  <option value="hello@domain.io">ReachInbox Team &lt;hello@domain.io&gt;</option>
                </>
              )}
            </select>
          </div>

          <div className="form-row recipient-row">
            <label htmlFor="recipients">To</label>
            <div className="recipient-area">
              <div className="chips">
                {recipients.slice(0, 4).map((r) => (
                  <span className="recipient-chip" key={r}>
                    {r}
                    <button onClick={() => setRecipients(recipients.filter((x) => x !== r))} aria-label={`Remove ${r}`}>
                      <X size={11} />
                    </button>
                  </span>
                ))}
                {recipients.length > 4 && <span className="recipient-chip">+{recipients.length - 4} more</span>}
                <input
                  id="recipients"
                  placeholder="Type email and press Enter or space..."
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
                      e.preventDefault()
                      add(to)
                      setTo('')
                    }
                  }}
                  onBlur={() => {
                    if (to.trim()) {
                      add(to)
                      setTo('')
                    }
                  }}
                />
              </div>
            </div>

            <button className="upload-link" onClick={() => fileRef?.click()}>
              <Plus size={13} /> Upload CSV/Text Leads
            </button>
            <input
              ref={(el) => setFileRef(el)}
              className="hidden-file"
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </div>

          {fileSummary && (
            <div className="upload-summary">
              {fileSummary}
              <button
                onClick={() => {
                  setRecipients([])
                  setFileSummary('')
                }}
              >
                Clear all
              </button>
            </div>
          )}

          <div className="form-row">
            <label htmlFor="subject">Subject</label>
            <input
              id="subject"
              placeholder="e.g. Quick question about outreach scaling"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          <div className="sending-config">
            <label title="Delay between individual email sends in seconds (Provider throttling)">
              Delay between sends (sec):
              <input
                type="number"
                min="0"
                step="1"
                value={delay}
                onChange={(e) => setDelay(e.target.value)}
              />
            </label>

            <label title="Rate limit: maximum emails per hour for this sender">
              Hourly Limit:
              <input
                type="number"
                min="1"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </label>
          </div>

          <div className="editor">
            <div
              className="editor-input"
              role="textbox"
              aria-label="Email message"
              aria-multiline="true"
              contentEditable
              suppressContentEditableWarning
              data-placeholder="Type your message or pitch here..."
              onInput={(e) => setBody(e.currentTarget.innerHTML)}
            />
            <div className="editor-toolbar">
              {[RotateCcw, RotateCw, AlignLeft, Bold, Italic, Underline, ListOrdered, List, Link2].map((Icon, i) => (
                <button
                  key={i}
                  aria-label={['Undo', 'Redo', 'Align left', 'Bold', 'Italic', 'Underline', 'Ordered list', 'Bulleted list', 'Insert link'][i]}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const commands = ['undo', 'redo', 'justifyLeft', 'bold', 'italic', 'underline', 'insertOrderedList', 'insertUnorderedList', 'createLink']
                    if (i === 8) {
                      const url = window.prompt('Enter link URL')
                      if (url) document.execCommand(commands[i], false, url)
                    } else {
                      document.execCommand(commands[i])
                    }
                    setBody(document.querySelector('[contenteditable="true"]')?.innerHTML || '')
                  }}
                >
                  <Icon size={14} />
                </button>
              ))}
            </div>
          </div>

          {notice && <div className="form-notice" role="status">{notice}</div>}
        </div>

        {popover && (
          <div className="schedule-popover">
            <b>Schedule Campaign</b>
            <label>
              Pick date &amp; time:
              <input type="datetime-local" value={scheduled} onChange={(e) => setScheduled(e.target.value)} />
            </label>
            <div className="quick-times">
              <button onClick={() => quick(9)}>Tomorrow, 9:00 AM</button>
              <button onClick={() => quick(10)}>Tomorrow, 10:00 AM</button>
              <button onClick={() => quick(14)}>Tomorrow, 2:00 PM</button>
              <button onClick={() => quick(16)}>Tomorrow, 4:00 PM</button>
            </div>
            <footer>
              <button onClick={() => setPopover(false)}>Close</button>
              <button className="outline-button" onClick={() => void send()} disabled={saving}>
                {saving ? 'Scheduling…' : 'Schedule Now'}
              </button>
            </footer>
          </div>
        )}
      </main>
    </div>
  )
}
