import { Router } from 'express'
import authRoutes from './auth.routes'
import emailRoutes from './email.routes'
import senderRoutes from './sender.routes'
import slackRoutes from './slack.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/emails', emailRoutes)
router.use('/senders', senderRoutes)
router.use('/slack', slackRoutes)

export default router
