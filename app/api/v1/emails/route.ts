import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const search = searchParams.get('search')?.toLowerCase() || ''
  const page = parseInt(searchParams.get('page') || '1', 10)
  const limit = parseInt(searchParams.get('limit') || '50', 10)

  let list = backendStore.getEmails()

  if (status) {
    list = list.filter((e) => e.status === status)
  }

  if (search.trim()) {
    list = list.filter((e) =>
      `${e.recipientName} ${e.recipient} ${e.subject} ${e.bodyPreview} ${e.sender}`
        .toLowerCase()
        .includes(search)
    )
  }

  const sortKey = status === 'sent' ? 'sentAt' : 'scheduledAt'
  list.sort((a, b) => {
    const tA = a[sortKey] ? new Date(a[sortKey]!).getTime() : 0
    const tB = b[sortKey] ? new Date(b[sortKey]!).getTime() : 0
    return tB - tA
  })

  const total = list.length
  const totalPages = Math.ceil(total / limit)
  const offset = (page - 1) * limit
  const data = list.slice(offset, offset + limit)

  return NextResponse.json({
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  })
}
