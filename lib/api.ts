export function getBaseApiUrl(): string {
  if (typeof window === 'undefined') {
    // Server-side (Vercel Functions / Server Components): use internal service binding if present
    const backendUrl = process.env.BACKEND_URL
    if (backendUrl) {
      return `${backendUrl.replace(/\/$/, '')}/api/v1`
    }
  }
  // Client-side or fallback: use relative path or explicit public base URL
  return process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let targetUrl: string

  if (path.startsWith('http://') || path.startsWith('https://')) {
    targetUrl = path
  } else {
    const base = getBaseApiUrl()
    const cleanPath = path.startsWith('/') ? path : `/${path}`

    // Avoid double /api/v1 prefix if path already includes it
    if (cleanPath.startsWith('/api/v1')) {
      const origin = base.replace(/\/api\/v1$/, '')
      targetUrl = origin ? `${origin}${cleanPath}` : cleanPath
    } else {
      targetUrl = `${base}${cleanPath}`
    }
  }

  const response = await fetch(targetUrl, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    let jsonErr: any = null
    try {
      jsonErr = JSON.parse(errorText)
    } catch {}
    const msg = jsonErr?.error || jsonErr?.message || errorText || `HTTP ${response.status}`
    throw new Error(msg)
  }

  return response.json() as Promise<T>
}
