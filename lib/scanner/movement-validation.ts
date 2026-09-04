import { z } from 'zod'

export const movementInputSchema = z.object({
  idempotencyKey: z.string().min(1).max(200),
  recordType: z.literal('panel_mark'),
  recordId: z.string().uuid(),
  recordIdentifier: z.string().min(1).max(200),
  operationInstanceId: z.string().uuid(),
  actionId: z.string().min(1).max(100),
  sourceStatus: z.string().min(1),
  destinationStatus: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.literal('EA').default('EA'),
  condition: z
    .enum(['pass', 'pass_with_note', 'hold', 'rework', 'remake', 'scrap'])
    .default('pass'),
  reason: z.string().max(2000).optional(),
  notes: z.string().max(4000).optional(),
  workstationId: z.string().uuid().optional(),
  deviceId: z.string().uuid().optional(),
  clientTimestamp: z.iso.datetime().optional(),
})
