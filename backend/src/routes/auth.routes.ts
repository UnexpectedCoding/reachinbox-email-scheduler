import { Router } from 'express'
import { demoLogin, getMe, googleAuth, googleCallback, logout } from '../controllers/auth.controller'

const router = Router()

router.get('/google', googleAuth)
router.get('/google/callback', googleCallback)
router.get('/demo', demoLogin)
router.get('/me', getMe)
router.post('/logout', logout)

export default router
