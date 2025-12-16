import { Hono } from 'hono'
import { Bindings } from '../types'
import { createDbClient } from '../db/client'
import { validateSession } from '../lib/auth/session'
import { calculateAvailableCredits } from '../lib/credits/calculate-available-credits'
import { getActivePlan } from '../lib/credits/get-active-plan'
import { consumeUserCredit } from '../lib/credits/consume'
import { refundUserCredit } from '../lib/credits/refund'
import { z } from 'zod'

const app = new Hono<{ Bindings: Bindings }>()

const consumeSchema = z.object({
    analysisId: z.number().optional(),
})

const refundSchema = z.object({
    analysisId: z.number(),
})

app.get('/available', async (c) => {
  const authHeader = c.req.header('Authorization')
  if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
  const token = authHeader.replace('Bearer ', '')
  
  const db = createDbClient(c.env.DB)
  const sessionData = await validateSession(db, token)
  if (!sessionData) return c.json({ error: 'Unauthorized' }, 401)
  const { user } = sessionData

  try {
    const credits = await calculateAvailableCredits(db, user.id)
    return c.json({ success: true, credits })
  } catch (error) {
    console.error('Failed to get available credits', error)
    return c.json({ error: 'Failed to get available credits' }, 500)
  }
})

app.get('/active-plan', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    
    const db = createDbClient(c.env.DB)
    const sessionData = await validateSession(db, token)
    if (!sessionData) return c.json({ error: 'Unauthorized' }, 401)
    const { user } = sessionData
  
    try {
      const plan = await getActivePlan(db, user.id)
      return c.json({ success: true, plan })
    } catch (error) {
      console.error('Failed to get active plan', error)
      return c.json({ error: 'Failed to get active plan' }, 500)
    }
  })

app.post('/consume', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    
    const db = createDbClient(c.env.DB)
    const sessionData = await validateSession(db, token)
    if (!sessionData) return c.json({ error: 'Unauthorized' }, 401)
    const { user } = sessionData

    const body = await c.req.json()
    const validation = consumeSchema.safeParse(body)
    if (!validation.success) return c.json({ error: 'Invalid body' }, 400)
    const { analysisId } = validation.data
  
    try {
      const result = await consumeUserCredit(db, user.id, analysisId)
      return c.json(result)
    } catch (error) {
      console.error('Failed to consume credit', error)
      return c.json({ success: false, error: 'Failed to consume credit' }, 500)
    }
  })

app.post('/refund', async (c) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader) return c.json({ error: 'Unauthorized' }, 401)
    const token = authHeader.replace('Bearer ', '')
    
    const db = createDbClient(c.env.DB)
    const sessionData = await validateSession(db, token)
    if (!sessionData) return c.json({ error: 'Unauthorized' }, 401)
    const { user } = sessionData

    const body = await c.req.json()
    const validation = refundSchema.safeParse(body)
    if (!validation.success) return c.json({ error: 'Invalid body' }, 400)
    const { analysisId } = validation.data
  
    try {
      const result = await refundUserCredit(db, user.id, analysisId)
      return c.json(result)
    } catch (error) {
      console.error('Failed to refund credit', error)
      return c.json({ success: false, error: 'Failed to refund credit' }, 500)
    }
  })

export default app
