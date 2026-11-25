import nodemailer, { Transporter } from 'nodemailer'
import { config } from '../config/env'

let transporter: Transporter | null = null
let etherealAccount: { user: string; pass: string } | null = null

export async function initEmailTransporter(): Promise<Transporter> {
  if (transporter) return transporter

  if (config.ethereal.user && config.ethereal.pass) {
    etherealAccount = {
      user: config.ethereal.user,
      pass: config.ethereal.pass,
    }
  } else {
    try {
      console.log('🔄 Creating Ethereal SMTP test account for automated testing...')
      const testAccount = await nodemailer.createTestAccount()
      etherealAccount = {
        user: testAccount.user,
        pass: testAccount.pass,
      }
      console.log(`✅ Ethereal Test Account created:\n   User: ${testAccount.user}\n   Pass: ${testAccount.pass}`)
    } catch (err: any) {
      console.warn(`⚠️ Could not create Ethereal account automatically (${err.message}). Using fallback credentials.`)
      etherealAccount = {
        user: 'mock.ethereal.user@ethereal.email',
        pass: 'mockpassword',
      }
    }
  }

  transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
      user: etherealAccount.user,
      pass: etherealAccount.pass,
    },
  })

  return transporter
}

export interface SendEmailResult {
  messageId: string
  previewUrl: string | false
}

export async function sendEmail(params: {
  from: string
  to: string
  toName?: string
  subject: string
  html: string
  text?: string
}): Promise<SendEmailResult> {
  const mailer = await initEmailTransporter()

  const info = await mailer.sendMail({
    from: params.from,
    to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
    subject: params.subject,
    text: params.text || params.html.replace(/<[^>]*>?/gm, ''),
    html: params.html,
  })

  const previewUrl = nodemailer.getTestMessageUrl(info)
  if (previewUrl) {
    console.log(`📬 Email sent via Ethereal! Preview URL: ${previewUrl}`)
  }

  return {
    messageId: info.messageId,
    previewUrl: previewUrl || false,
  }
}
