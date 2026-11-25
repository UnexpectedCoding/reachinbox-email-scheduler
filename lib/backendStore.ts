export interface StoredEmail {
  id: string
  recipient: string
  recipientName: string
  sender: string
  subject: string
  body: string
  bodyPreview: string
  status: 'scheduled' | 'sent' | 'failed'
  scheduledAt: string | null
  sentAt: string | null
  previewUrl?: string
  delayBetweenEmails?: number
  hourlyLimit?: number
}

export interface StoredSender {
  id: string
  email: string
  name: string
}

export interface StoredUser {
  id: string
  name: string
  email: string
  picture?: string
}

export interface StoredSlack {
  connected: boolean
  channel?: string
  team?: string
  webhookUrl?: string
}

// Global in-memory persistence for serverless execution
const globalStore = global as unknown as {
  __reachinbox_emails?: Map<string, StoredEmail>
  __reachinbox_senders?: StoredSender[]
  __reachinbox_user?: StoredUser
  __reachinbox_slack?: StoredSlack
  __reachinbox_rate_limits?: Map<string, number>
}

if (!globalStore.__reachinbox_emails) {
  globalStore.__reachinbox_emails = new Map<string, StoredEmail>()

  // Seed sample initial emails
  const initialEmails: StoredEmail[] = [
    {
      id: 'email_123',
      recipient: 'john@example.com',
      recipientName: 'John Smith',
      sender: 'oliver.brown@domain.io',
      subject: 'Meeting follow-up - Scheduled',
      body: '<p>Hi John, just wanted to follow up on our meeting yesterday.</p>',
      bodyPreview: 'Hi John, just wanted to follow up on our meeting...',
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      sentAt: null,
      status: 'scheduled',
    },
    {
      id: 'email_124',
      recipient: 'olive@example.com',
      recipientName: 'Olive',
      sender: 'oliver.brown@domain.io',
      subject: "Partnership Growth Proposal",
      body: "<p>Hi Olive, here is the proposal we discussed.</p>",
      bodyPreview: 'Hi Olive, here is the proposal we discussed...',
      scheduledAt: new Date(Date.now() + 172800000).toISOString(),
      sentAt: null,
      status: 'scheduled',
    },
    {
      id: 'email_125',
      recipient: 'sarah@example.com',
      recipientName: 'Sarah Wilson',
      sender: 'oliver.brown@domain.io',
      subject: 'Re: Project Update',
      body: '<p>Thanks for the update, Sarah. Looks good!</p>',
      bodyPreview: 'Thanks for the update, Sarah. Looks good!',
      scheduledAt: null,
      sentAt: new Date(Date.now() - 3600000).toISOString(),
      status: 'sent',
      previewUrl: 'https://ethereal.email/message/awV9B-iVxZpKyS2jawV-M3xXAa9ZbOMMAAAAARdW9UTdPiOf1KHihaVD554',
    },
    {
      id: 'email_126',
      recipient: 'support@example.com',
      recipientName: 'Support',
      sender: 'oliver.brown@domain.io',
      subject: 'Issue with login dashboard',
      body: '<p>I was having trouble logging in, resolved now.</p>',
      bodyPreview: 'I was having trouble logging in, resolved now.',
      scheduledAt: null,
      sentAt: new Date(Date.now() - 7200000).toISOString(),
      status: 'sent',
      previewUrl: 'https://ethereal.email/message/awV9B-iVxZpKyS2jawV-NXM3WywC8FquAAAAAmINItubbiOQKXKeieSUzVI',
    },
  ]

  initialEmails.forEach((e) => globalStore.__reachinbox_emails!.set(e.id, e))
}

if (!globalStore.__reachinbox_senders) {
  globalStore.__reachinbox_senders = [
    { id: 'sender_1', email: 'oliver.brown@domain.io', name: 'Oliver Brown' },
    { id: 'sender_2', email: 'hello@domain.io', name: 'ReachInbox Team' },
    { id: 'sender_3', email: 'sales@reachinbox.ai', name: 'Growth & Outreach' },
  ]
}

if (!globalStore.__reachinbox_user) {
  globalStore.__reachinbox_user = {
    id: 'usr_demo',
    name: 'Oliver Brown',
    email: 'oliver.brown@domain.io',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  }
}

if (!globalStore.__reachinbox_slack) {
  globalStore.__reachinbox_slack = {
    connected: false,
    channel: '#reachinbox-alerts',
    team: 'ReachInbox Workspace',
  }
}

if (!globalStore.__reachinbox_rate_limits) {
  globalStore.__reachinbox_rate_limits = new Map<string, number>()
}

export const backendStore = {
  getEmails(): StoredEmail[] {
    return Array.from(globalStore.__reachinbox_emails!.values())
  },

  getEmailById(id: string): StoredEmail | null {
    return globalStore.__reachinbox_emails!.get(id) || null
  },

  addEmail(email: StoredEmail): StoredEmail {
    globalStore.__reachinbox_emails!.set(email.id, email)
    return email
  },

  updateEmail(id: string, partial: Partial<StoredEmail>): StoredEmail | null {
    const existing = globalStore.__reachinbox_emails!.get(id)
    if (!existing) return null
    const updated = { ...existing, ...partial }
    globalStore.__reachinbox_emails!.set(id, updated)
    return updated
  },

  deleteEmail(id: string): boolean {
    return globalStore.__reachinbox_emails!.delete(id)
  },

  getSenders(): StoredSender[] {
    return globalStore.__reachinbox_senders!
  },

  getUser(): StoredUser | null {
    return globalStore.__reachinbox_user || null
  },

  setUser(user: StoredUser | null) {
    globalStore.__reachinbox_user = user || undefined
  },

  getSlack(): StoredSlack {
    return globalStore.__reachinbox_slack!
  },

  updateSlack(partial: Partial<StoredSlack>): StoredSlack {
    globalStore.__reachinbox_slack = { ...globalStore.__reachinbox_slack!, ...partial }
    return globalStore.__reachinbox_slack!
  },

  incrementRateLimit(sender: string, limit: number): { allowed: boolean; current: number; nextWindow: Date } {
    const hourKey = `${sender.toLowerCase()}_${new Date().toISOString().slice(0, 13)}`
    const current = (globalStore.__reachinbox_rate_limits!.get(hourKey) || 0) + 1
    globalStore.__reachinbox_rate_limits!.set(hourKey, current)

    const nextWindow = new Date()
    nextWindow.setMinutes(60, 0, 0)

    return {
      allowed: current <= limit,
      current,
      nextWindow,
    }
  },
}
