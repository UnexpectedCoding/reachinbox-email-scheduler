import { createBullBoard } from '@bull-board/api'
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter'
import { ExpressAdapter } from '@bull-board/express'
import { getEmailQueue } from '../queue/emailQueue'

export function setupBullBoard() {
  const serverAdapter = new ExpressAdapter()
  serverAdapter.setBasePath('/admin/queues')

  try {
    createBullBoard({
      queues: [new BullMQAdapter(getEmailQueue())],
      serverAdapter,
    })
    console.log('✅ BullMQ Live Dashboard mounted at /admin/queues')
  } catch (err: any) {
    console.warn(`⚠️ Bull-Board setup warning: ${err.message}`)
  }

  return serverAdapter.getRouter()
}
