import { Request, Response } from 'express'
import { config } from '../config/env'
import { db } from '../db'
import { createAuthToken, generateGoogleOAuthUrl, getGoogleUserFromCode, verifyAuthToken } from '../services/auth.service'
import { User } from '../types'

export async function googleAuth(req: Request, res: Response) {
  const url = generateGoogleOAuthUrl()
  res.redirect(url)
}

export async function googleCallback(req: Request, res: Response) {
  const code = req.query.code as string
  if (!code) {
    return res.redirect(`${config.frontendUrl}/?error=no_code`)
  }

  try {
    const user = await getGoogleUserFromCode(code)
    const token = createAuthToken(user)

    res.cookie('token', token, {
      httpOnly: false,
      secure: config.nodeEnv === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })

    res.redirect(`${config.frontendUrl}/?auth=success`)
  } catch (err: any) {
    console.error(`Google OAuth error: ${err.message}`)
    res.redirect(`${config.frontendUrl}/?error=oauth_failed`)
  }
}

export async function demoLogin(req: Request, res: Response) {
  // Convenient instant login for reviewers/evaluators
  let user = await db.findUserByEmail('oliver.brown@domain.io')
  if (!user) {
    user = await db.upsertUser({
      id: 'usr_demo_oliver',
      email: 'oliver.brown@domain.io',
      name: 'Oliver Brown',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
    })
  }

  const token = createAuthToken(user)
  res.cookie('token', token, {
    httpOnly: false,
    secure: config.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })

  res.redirect(`${config.frontendUrl}/?auth=success`)
}

export async function getMe(req: Request, res: Response) {
  const token = req.cookies?.token || (req.headers.authorization?.replace(/^Bearer\s+/, ''))

  if (!token) {
    // If demo mode or no token, return default user profile
    return res.json({
      authenticated: false,
      user: {
        id: 'usr_demo_oliver',
        email: 'oliver.brown@domain.io',
        name: 'Oliver Brown',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
      },
    })
  }

  const decoded = verifyAuthToken(token)
  if (!decoded) {
    return res.status(401).json({ authenticated: false, message: 'Invalid or expired token' })
  }

  const user = await db.findUserById(decoded.id)
  return res.json({
    authenticated: true,
    user: user || decoded,
  })
}

export async function logout(req: Request, res: Response) {
  res.clearCookie('token')
  return res.json({ success: true, message: 'Logged out successfully' })
}
