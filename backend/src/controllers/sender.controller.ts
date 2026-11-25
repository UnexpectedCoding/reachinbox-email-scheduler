import { Request, Response } from 'express'
import { db } from '../db'

export async function getSenders(req: Request, res: Response) {
  try {
    const senders = await db.getSenders()
    return res.json({ data: senders })
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch senders' })
  }
}
