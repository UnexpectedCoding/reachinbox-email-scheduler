import { Router } from 'express'
import {
  disconnectSlack,
  getSlackStatus,
  slackDemoConnect,
  slackOAuthCallback,
  slackOAuthRedirect,
} from '../controllers/slack.controller'

const router = Router()

router.get('/status', getSlackStatus)
router.delete('/disconnect', disconnectSlack)
router.get('/oauth', slackOAuthRedirect)
router.get('/oauth/callback', slackOAuthCallback)
router.get('/demo-connect', slackDemoConnect)

export default router
