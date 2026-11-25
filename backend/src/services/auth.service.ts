import axios from 'axios'
import jwt from 'jsonwebtoken'
import { config } from '../config/env'
import { db } from '../db'
import { User } from '../types'

export function generateGoogleOAuthUrl(): string {
  if (!config.google.clientId) {
    return `${config.apiBaseUrl}/auth/demo`
  }
  const rootUrl = 'https://accounts.google.com/o/oauth2/v2/auth'
  const options = {
    redirect_uri: config.google.callbackUrl,
    client_id: config.google.clientId,
    access_type: 'offline',
    response_type: 'code',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/userinfo.email',
    ].join(' '),
  }
  const qs = new URLSearchParams(options)
  return `${rootUrl}?${qs.toString()}`
}

export async function getGoogleUserFromCode(code: string): Promise<User> {
  const tokenUrl = 'https://oauth2.googleapis.com/token'
  const values = {
    code,
    client_id: config.google.clientId,
    client_secret: config.google.clientSecret,
    redirect_uri: config.google.callbackUrl,
    grant_type: 'authorization_code',
  }

  const tokenRes = await axios.post(tokenUrl, new URLSearchParams(values).toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })

  const { id_token, access_token } = tokenRes.data

  const userRes = await axios.get(
    `https://www.googleapis.com/oauth2/v2/userinfo?alt=json&access_token=${access_token}`,
    {
      headers: { Authorization: `Bearer ${id_token}` },
    }
  )

  const googleData = userRes.data

  const user: User = {
    id: `usr_${googleData.id}`,
    googleId: googleData.id,
    email: googleData.email,
    name: googleData.name || googleData.email.split('@')[0],
    picture: googleData.picture,
  }

  return db.upsertUser(user)
}

export function createAuthToken(user: User): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, picture: user.picture },
    config.jwtSecret,
    { expiresIn: '7d' }
  )
}

export function verifyAuthToken(token: string): any {
  try {
    return jwt.verify(token, config.jwtSecret)
  } catch {
    return null
  }
}
