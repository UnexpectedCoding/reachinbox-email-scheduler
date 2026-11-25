import { NextResponse } from 'next/server'
import { backendStore } from '@/lib/backendStore'

export async function GET(request: Request) {
  backendStore.setUser({
    id: 'usr_demo_oliver',
    email: 'oliver.brown@domain.io',
    name: 'Oliver Brown',
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=256&q=80',
  })
  const url = new URL('/', request.url)
  return NextResponse.redirect(url)
}
