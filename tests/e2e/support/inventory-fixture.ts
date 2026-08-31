import { eq, and } from 'drizzle-orm'
import { db } from '@/db'
import {
  users,
  inventoryItems,
  purchaseOrders,
  purchaseOrderLines,
} from '@/db/schema'

export async function createReceiptFixture() {
  if (
    !['localhost', '127.0.0.1'].includes(
      new URL(process.env.DATABASE_URL!).hostname,
    )
  )
    throw new Error('Browser fixtures require a local test database')
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, process.env.ADMIN_EMAIL || 'admin@example.test'))
    .limit(1)
  const [item] = await db
    .select()
    .from(inventoryItems)
    .where(
      and(
        eq(inventoryItems.organizationId, user.organizationId),
        eq(inventoryItems.itemNumber, 'ACM-BW-48120'),
      ),
    )
    .limit(1)
  const poNumber = `TEST-PO-${crypto.randomUUID().slice(0, 8)}`
  const [po] = await db
    .insert(purchaseOrders)
    .values({
      organizationId: user.organizationId,
      poNumber,
      vendorName: 'Synthetic receiving test vendor',
    })
    .returning()
  await db.insert(purchaseOrderLines).values({
    purchaseOrderId: po.id,
    inventoryItemId: item.id,
    lineNumber: 1,
    description: 'Synthetic receiving test stock',
    orderedQuantity: '100',
    unit: item.unit,
  })
  return poNumber
}
