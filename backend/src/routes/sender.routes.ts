import { Router } from 'express'
import { getSenders } from '../controllers/sender.controller'

const router = Router()

router.get('/', getSenders)

export default router
