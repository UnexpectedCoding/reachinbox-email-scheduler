export interface User {
  id: string
  googleId?: string
  email: string
  name: string
  picture?: string
  createdAt?: Date
}

export interface Sender {
  id: string
  userId?: string
  email: string
  name?: string
  createdAt?: Date
}

export type EmailStatus = 'scheduled' | 'sent' | 'failed' | 'cancelled'

export interface EmailRecord {
  id: string
  userId?: string
  senderId: string
  senderEmail: string
  recipientEmail: string
  recipientName: string
  subject: string
  body: string
  bodyPreview: string
  status: EmailStatus
  scheduledAt: Date
  sentAt: Date | null
  errorMessage?: string | null
  previewUrl?: string | null
  bullmqJobId?: string | null
  delayBetweenEmails: number
  hourlyLimit: number
  createdAt: Date
  updatedAt: Date
}

export interface SlackIntegration {
  id: string
  userId?: string
  accessToken?: string
  webhookUrl?: string
  channelId?: string
  channelName?: string
  teamId?: string
  teamName?: string
  createdAt: Date
  updatedAt: Date
}

export interface EmailJobData {
  emailId: string
  senderEmail: string
  recipientEmail: string
  recipientName: string
  subject: string
  body: string
  scheduledAt: string
  delayBetweenEmails: number
  hourlyLimit: number
  rescheduledCount?: number
}
