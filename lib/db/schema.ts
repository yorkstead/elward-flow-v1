import {
  pgTable,
  varchar,
  timestamp,
  text,
  integer,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { and, relations } from 'drizzle-orm'
import { strict } from 'assert'
import { number } from 'zod'
import { db } from '@/db'

// 14 Core Operational Statuses (Appendix A)
export const releaseStatusEnum = pgEnum('release_status', [
  'Draft',
  'Awaiting approval',
  'Approved for production',
  'Material hold',
  'Ready for CNC',
  'In production',
  'Partial',
  'QC hold',
  'Ready for packaging',
  'Packaging',
  'Ready to ship',
  'Shipped',
  'Closed',
  'Cancelled',
])

// Jobs Table (Strict 5-digit primary key)
export const jobs = pgTable('jobs', {
  job_number: varchar('job_number', { length: 5 }).primaryKey(),
  customer: text('customer').notNull(),
  schedule: timestamp('schedule'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Releases Table (Job + Release unique scope)
export const releases = pgTable('releases', {
  id: varchar('id', { length: 12 }).primaryKey(), // formatted as "jobNum-releaseNum"
  job_number: varchar('job_number', { length: 5 })
    .notNull()
    .references(() => jobs.job_number),
  release_number: integer('release_number').notNull(),
  revision: integer('revision').default(1).notNull(),
  required_date: timestamp('required_date'),
  status: releaseStatusEnum('status').default('Draft').notNull(),
  version: integer('version').default(1).notNull(), // Optimistic concurrency lock
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
})

// Immutable Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
  user_email: text('user_email').notNull(),
  action: text('action').notNull(),
  target_id: text('target_id').notNull(),
  reason: text('reason').notNull(),
  payload: text('payload'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
})

export const jobsRelations = relations(jobs, ({ many }) => ({
  releases: many(releases),
}))

export const releasesRelations = relations(releases, ({ one }) => ({
  job: one(jobs, {
    fields: [releases.job_number],
    references: [jobs.job_number],
  }),
}))
