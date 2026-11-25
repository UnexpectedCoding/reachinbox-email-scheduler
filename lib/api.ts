const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || '/api/v1'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const url = path.startsWith('http') ? path : `${API_BASE}${path}`
  const response = await fetch(url, {
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
    throw new Error(`API request failed (${response.status}): ${errorText}`)
  }
  return response.json() as Promise<T>
}
