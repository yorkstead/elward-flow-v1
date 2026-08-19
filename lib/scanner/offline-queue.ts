import type { ExecuteMovementInput } from '@/lib/services/scanner'

export interface QueuedMovementItem {
  idempotencyKey: string
  payload: ExecuteMovementInput
  queuedAt: string
  retryCount: number
  status: 'pending' | 'syncing' | 'failed'
  lastError?: string
}

const STORAGE_KEY = 'EF_OFFLINE_SCAN_QUEUE_V1'

export class OfflineScanQueue {
  /**
   * Get all queued items from local browser storage.
   */
  static getQueue(): QueuedMovementItem[] {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return []
      return JSON.parse(raw) as QueuedMovementItem[]
    } catch {
      return []
    }
  }

  /**
   * Save queue state to local storage and broadcast update event.
   */
  private static saveQueue(items: QueuedMovementItem[]): void {
    if (typeof window === 'undefined') return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
      window.dispatchEvent(
        new CustomEvent('ef:queue-updated', {
          detail: { count: items.filter((i) => i.status === 'pending').length },
        }),
      )
    } catch (e) {
      console.error('Failed to save offline queue', e)
    }
  }

  /**
   * Enqueue a new movement action to execute locally or sync immediately.
   */
  static enqueue(input: ExecuteMovementInput): QueuedMovementItem {
    const items = this.getQueue()
    const existing = items.find(
      (i) => i.idempotencyKey === input.idempotencyKey,
    )
    if (existing) return existing

    const item: QueuedMovementItem = {
      idempotencyKey: input.idempotencyKey,
      payload: input,
      queuedAt: new Date().toISOString(),
      retryCount: 0,
      status: 'pending',
    }

    items.push(item)
    this.saveQueue(items)
    return item
  }

  /**
   * Remove item from queue upon successful confirmation.
   */
  static remove(idempotencyKey: string): void {
    const items = this.getQueue().filter(
      (i) => i.idempotencyKey !== idempotencyKey,
    )
    this.saveQueue(items)
  }

  /**
   * Clear all confirmed or rejected items.
   */
  static clear(): void {
    this.saveQueue([])
  }

  /**
   * Synchronize all pending items with server.
   */
  static async flush(): Promise<{
    succeeded: number
    failed: number
    conflicts: QueuedMovementItem[]
  }> {
    if (typeof window === 'undefined' || !navigator.onLine) {
      return { succeeded: 0, failed: 0, conflicts: [] }
    }

    const items = this.getQueue()
    const pending = items.filter((i) => i.status === 'pending')
    if (pending.length === 0) {
      return { succeeded: 0, failed: 0, conflicts: [] }
    }

    let succeeded = 0
    let failed = 0
    const conflicts: QueuedMovementItem[] = []

    try {
      const res = await fetch('/api/scanner/movement/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: pending.map((p) => p.payload),
        }),
      })

      if (!res.ok) {
        throw new Error(`Batch sync failed with status ${res.status}`)
      }

      const json = await res.json()
      const results: Array<{
        idempotencyKey: string
        success: boolean
        error?: string
      }> = json.results || []

      const updatedQueue: QueuedMovementItem[] = []

      for (const item of items) {
        const resMatch = results.find(
          (r) => r.idempotencyKey === item.idempotencyKey,
        )
        if (resMatch) {
          if (resMatch.success) {
            succeeded++
            // Remove successful from queue
          } else {
            failed++
            item.status = 'failed'
            item.lastError = resMatch.error
            item.retryCount++
            conflicts.push(item)
            updatedQueue.push(item)
          }
        } else {
          updatedQueue.push(item)
        }
      }

      this.saveQueue(updatedQueue)
    } catch {
      failed = pending.length
    }

    return { succeeded, failed, conflicts }
  }
}
