import { api } from '@/lib/api'

export interface AuthUser {
  id: string
  email: string
  name: string
  picture?: string
}

export interface AuthResponse {
  authenticated: boolean
  user: AuthUser | null
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'

export async function getMe(): Promise<AuthResponse> {
  try {
    return await api<AuthResponse>('/auth/me')
  } catch {
    return {
      authenticated: false,
      user: null,
    }
  }
}

export async function logoutUser(): Promise<void> {
  try {
    await api('/auth/logout', { method: 'POST' })
  } catch (err) {
    console.error('Logout failed', err)
  }
}

export function getGoogleOAuthUrl(): string {
  return `${API_BASE}/auth/demo`
}

export function getDemoLoginUrl(): string {
  return `${API_BASE}/auth/demo`
}
