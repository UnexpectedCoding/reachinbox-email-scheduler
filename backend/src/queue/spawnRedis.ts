import { spawn } from 'child_process'
import fs from 'fs'
import net from 'net'
import path from 'path'

export function isPortOpen(port: number, host = '127.0.0.1'): Promise<boolean> {
  if (process.env.VERCEL) return Promise.resolve(false)

  return new Promise((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(400)
    socket.on('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.on('error', () => {
      socket.destroy()
      resolve(false)
    })
    socket.on('timeout', () => {
      socket.destroy()
      resolve(false)
    })
    socket.connect(port, host)
  })
}

export async function ensureRedisRunning(): Promise<boolean> {
  if (process.env.VERCEL) return false

  const open = await isPortOpen(6379)
  if (open) {
    console.log('✅ Redis is already running on port 6379.')
    return true
  }

  const redisExePath = path.resolve(__dirname, '../../redis/redis-server.exe')
  if (fs.existsSync(redisExePath)) {
    try {
      console.log('🔄 Launching local Windows Redis server (redis-server.exe)...')
      const child = spawn(redisExePath, [], {
        detached: true,
        stdio: 'ignore',
        cwd: path.dirname(redisExePath),
      })
      child.unref()

      // Wait up to 2 seconds for port to open
      for (let i = 0; i < 4; i++) {
        await new Promise((r) => setTimeout(r, 500))
        if (await isPortOpen(6379)) {
          console.log('✅ Local Windows Redis server started successfully on port 6379.')
          return true
        }
      }
    } catch (err: any) {
      console.warn(`Could not auto-spawn redis-server.exe: ${err.message}`)
    }
  }

  return false
}
