import { Router } from 'express'
import {
  cancelEmail,
  getEmailById,
  getEmails,
  rescheduleEmail,
  scheduleEmail,
} from '../controllers/email.controller'

const router = Router()

router.get('/', getEmails)
router.post('/schedule', scheduleEmail)
router.get('/:id', getEmailById)
router.patch('/:id/reschedule', rescheduleEmail)
router.delete('/:id', cancelEmail)

export default router
