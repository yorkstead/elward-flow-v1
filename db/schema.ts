import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
}

// ============================================================================
// 1. Multi-Tenant Foundation (Organization, Site)
// ============================================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  ...timestamps,
})

export const sites = pgTable(
  'sites',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    timezone: text('timezone').notNull().default('America/Denver'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('sites_organization_code_unique').on(
      table.organizationId,
      table.code,
    ),
  ],
)

// ============================================================================
// 2. Authentication & Authorization (Users, Roles, Permissions, Sessions)
// ============================================================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    siteId: uuid('site_id').references(() => sites.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    emailVerified: timestamp('email_verified', { withTimezone: true }),
    image: text('image'),
    passwordHash: text('password_hash').notNull(),
    isAdmin: boolean('is_admin').notNull().default(false),
    disabledAt: timestamp('disabled_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [uniqueIndex('users_email_unique').on(table.email)],
)

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => [
    primaryKey({ columns: [table.provider, table.providerAccountId] }),
  ],
)

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
})

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.identifier, table.token] })],
)

export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    description: text('description'),
    isSystem: boolean('is_system').notNull().default(true),
    ...timestamps,
  },
  (table) => [uniqueIndex('roles_code_unique').on(table.code)],
)

export const permissions = pgTable(
  'permissions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    resource: text('resource').notNull(),
    action: text('action').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('permissions_resource_action_unique').on(
      table.resource,
      table.action,
    ),
  ],
)

export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionId] })],
)

export const userRoles = pgTable(
  'user_roles',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.roleId] })],
)

// ============================================================================
// 3. Core Manufacturing Entities (Customer, Project, 5-Digit Job, Release)
// ============================================================================

export const customers = pgTable('customers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code'),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  version: integer('version').notNull().default(1),
  ...timestamps,
})

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  customerId: uuid('customer_id')
    .notNull()
    .references(() => customers.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code'),
  location: text('location'),
  version: integer('version').notNull().default(1),
  ...timestamps,
})

// Manufacturing Jobs (Job numbers are strictly 5 digits)
export const productionJobs = pgTable(
  'production_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    jobNumber: varchar('job_number', { length: 5 }).notNull(),
    name: text('name').notNull(),
    status: text('status').notNull().default('Active'),
    targetShipDate: timestamp('target_ship_date', { withTimezone: true }),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('production_jobs_org_job_number_unique').on(
      table.organizationId,
      table.jobNumber,
    ),
  ],
)

// Operational Status Enum
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

// Unique business key: Job + Release
export const releases = pgTable(
  'releases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    jobId: uuid('job_id')
      .notNull()
      .references(() => productionJobs.id, { onDelete: 'cascade' }),
    releaseNumber: integer('release_number').notNull(),
    status: releaseStatusEnum('status').notNull().default('Draft'),
    priority: integer('priority').notNull().default(0),
    requiredDate: timestamp('required_date', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('releases_org_job_release_number_unique').on(
      table.organizationId,
      table.jobId,
      table.releaseNumber,
    ),
  ],
)

export const revisionStatusEnum = pgEnum('revision_status', [
  'Draft',
  'Approved',
  'Superseded',
  'Cancelled',
])

export const releaseRevisions = pgTable(
  'release_revisions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    revisionNumber: integer('revision_number').notNull().default(1),
    revisionLabel: text('revision_label').notNull().default('A'),
    status: revisionStatusEnum('status').notNull().default('Draft'),
    isCurrent: boolean('is_current').notNull().default(false),
    notes: text('notes'),
    approvedById: uuid('approved_by_id').references(() => users.id),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('release_revisions_release_rev_num_unique').on(
      table.releaseId,
      table.revisionNumber,
    ),
  ],
)

export const panelMarks = pgTable(
  'panel_marks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    releaseRevisionId: uuid('release_revision_id')
      .notNull()
      .references(() => releaseRevisions.id, { onDelete: 'cascade' }),
    mark: text('mark').notNull(),
    description: text('description'),
    quantity: integer('quantity').notNull().default(1),
    materialFamily: text('material_family').notNull(),
    color: text('color'),
    thickness: numeric('thickness', { precision: 10, scale: 4 }),
    width: numeric('width', { precision: 10, scale: 4 }),
    length: numeric('length', { precision: 10, scale: 4 }),
    dimensionUnit: text('dimension_unit').notNull().default('in'),
    notes: text('notes'),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    index('panel_marks_revision_mark_index').on(
      table.releaseRevisionId,
      table.mark,
    ),
  ],
)

// ============================================================================
// 4. File Storage & Document Control (Immutable Originals, Derived Files)
// ============================================================================

export const storedFiles = pgTable(
  'stored_files',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    objectKey: text('object_key').notNull(),
    originalName: text('original_name').notNull(),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    uploadedById: uuid('uploaded_by_id')
      .notNull()
      .references(() => users.id),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('stored_files_object_key_unique').on(table.objectKey),
  ],
)

export const derivedFiles = pgTable('derived_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceFileId: uuid('source_file_id')
    .notNull()
    .references(() => storedFiles.id, { onDelete: 'cascade' }),
  storedFileId: uuid('stored_file_id')
    .notNull()
    .references(() => storedFiles.id, { onDelete: 'cascade' }),
  generationType: text('generation_type').notNull(),
  generationVersion: integer('generation_version').notNull().default(1),
  generatorLogs: jsonb('generator_logs'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const documentClassifications = pgTable(
  'document_classifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    expectedByDefault: boolean('expected_by_default').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('doc_classifications_org_code_unique').on(
      table.organizationId,
      table.code,
    ),
  ],
)

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => productionJobs.id, { onDelete: 'cascade' }),
  releaseId: uuid('release_id')
    .notNull()
    .references(() => releases.id, { onDelete: 'cascade' }),
  classificationId: uuid('classification_id')
    .notNull()
    .references(() => documentClassifications.id),
  name: text('name').notNull(),
  version: integer('version').notNull().default(1),
  ...timestamps,
})

export const documentRevisions = pgTable('document_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  releaseRevisionId: uuid('release_revision_id')
    .notNull()
    .references(() => releaseRevisions.id, { onDelete: 'cascade' }),
  storedFileId: uuid('stored_file_id')
    .notNull()
    .references(() => storedFiles.id, { onDelete: 'cascade' }),
  revisionLabel: text('revision_label').notNull().default('A'),
  status: text('status').notNull().default('current'),
  notes: text('notes'),
  ...timestamps,
})

// ============================================================================
// 5. Production Operations, Routing & Shop Stations
// ============================================================================

export const workstations = pgTable('workstations', {
  id: uuid('id').primaryKey().defaultRandom(),
  siteId: uuid('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull(),
  department: text('department').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const devices = pgTable(
  'devices',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    siteId: uuid('site_id')
      .notNull()
      .references(() => sites.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    deviceIdentifier: text('device_identifier').notNull(),
    type: text('type').notNull().default('scanner'),
    currentWorkstationId: uuid('current_workstation_id').references(
      () => workstations.id,
      { onDelete: 'set null' },
    ),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('devices_identifier_unique').on(table.deviceIdentifier),
  ],
)

export const operationDefinitions = pgTable(
  'operation_definitions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    code: text('code').notNull(),
    department: text('department').notNull(),
    defaultSequence: integer('default_sequence').notNull().default(10),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('op_defs_org_code_unique').on(table.organizationId, table.code),
  ],
)

export const operationRoutes = pgTable('operation_routes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  materialFamily: text('material_family').notNull(),
  name: text('name').notNull(),
  steps: jsonb('steps').notNull().default([]),
  version: integer('version').notNull().default(1),
  isActive: boolean('is_active').notNull().default(true),
  ...timestamps,
})

export const operationInstanceStatusEnum = pgEnum('operation_instance_status', [
  'Pending',
  'Ready',
  'In progress',
  'Completed',
  'Hold',
  'Skipped',
])

export const operationInstances = pgTable('operation_instances', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  releaseRevisionId: uuid('release_revision_id')
    .notNull()
    .references(() => releaseRevisions.id, { onDelete: 'cascade' }),
  panelMarkId: uuid('panel_mark_id')
    .notNull()
    .references(() => panelMarks.id, { onDelete: 'cascade' }),
  operationDefinitionId: uuid('operation_definition_id')
    .notNull()
    .references(() => operationDefinitions.id),
  sequence: integer('sequence').notNull(),
  status: operationInstanceStatusEnum('status').notNull().default('Pending'),
  plannedQuantity: integer('planned_quantity').notNull().default(1),
  completedQuantity: integer('completed_quantity').notNull().default(0),
  scrapQuantity: integer('scrap_quantity').notNull().default(0),
  holdQuantity: integer('hold_quantity').notNull().default(0),
  priority: text('priority').notNull().default('Standard'),
  assignedTeam: text('assigned_team'),
  startedAt: timestamp('started_at', { withTimezone: true }),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  firstOffInspection: text('first_off_inspection').notNull().default('pending'),
  firstOffNotes: text('first_off_notes'),
  machineReference: text('machine_reference'),
  layoutReference: text('layout_reference'),
  cartReference: text('cart_reference'),
  assignedWorkstationId: uuid('assigned_workstation_id').references(
    () => workstations.id,
    { onDelete: 'set null' },
  ),
  notes: text('notes'),
  version: integer('version').notNull().default(1),
  ...timestamps,
})

// Machine & Shop Downtime Tracking
export const productionDowntimeEvents = pgTable('production_downtime_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  workstationId: uuid('workstation_id').references(() => workstations.id, {
    onDelete: 'set null',
  }),
  department: text('department').notNull(),
  category: text('category').notNull(), // 'Machine Breakdown' | 'Drawing Conflict' | 'Material Shortage' | 'Tooling Change' | 'Quality Investigation' | 'Other'
  reason: text('reason').notNull(),
  notes: text('notes'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),
  reportedById: uuid('reported_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  resolvedById: uuid('resolved_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  ...timestamps,
})

// ============================================================================
// 6. Audit Ledger & Activity Stream (Append-Only, Immutable)
// ============================================================================

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actingRole: text('acting_role').notNull(),
    action: text('action').notNull(),
    resourceType: text('resource_type').notNull(),
    resourceId: text('resource_id').notNull(),
    priorState: jsonb('prior_state'),
    newState: jsonb('new_state'),
    quantity: numeric('quantity', { precision: 12, scale: 4 }),
    condition: text('condition'),
    sourceRevision: text('source_revision'),
    reason: text('reason'), // Mandatory for overrides & exceptions
    workstationId: uuid('workstation_id').references(() => workstations.id, {
      onDelete: 'set null',
    }),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    ipAddress: text('ip_address'),
    timestamp: timestamp('timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('audit_events_org_time_idx').on(
      table.organizationId,
      table.timestamp,
    ),
    index('audit_events_resource_idx').on(table.resourceType, table.resourceId),
    index('audit_events_actor_idx').on(table.actorId),
  ],
)

export const activityEvents = pgTable('activity_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  actorId: uuid('actor_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  actionTitle: text('action_title').notNull(),
  summary: text('summary').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const movementEvents = pgTable(
  'movement_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actingRole: text('acting_role').notNull(),
    recordType: text('record_type').notNull(), // 'panel_mark', 'release', 'pallet', 'inventory_item', 'shipment'
    recordId: uuid('record_id').notNull(),
    recordIdentifier: text('record_identifier').notNull(), // e.g. '54120-1', 'P-101', 'PAL-54120-1-01'
    sourceStatus: text('source_status').notNull(),
    destinationStatus: text('destination_status').notNull(),
    operationInstanceId: uuid('operation_instance_id').references(
      () => operationInstances.id,
      { onDelete: 'set null' },
    ),
    revisionLabel: text('revision_label').notNull().default('A'),
    quantity: numeric('quantity', { precision: 12, scale: 4 })
      .notNull()
      .default('1'),
    unit: text('unit').notNull().default('EA'),
    condition: text('condition').notNull().default('pass'), // pass, pass_with_note, hold, rework, remake, scrap
    reason: text('reason'),
    notes: text('notes'),
    workstationId: uuid('workstation_id').references(() => workstations.id, {
      onDelete: 'set null',
    }),
    deviceId: uuid('device_id').references(() => devices.id, {
      onDelete: 'set null',
    }),
    idempotencyKey: text('idempotency_key').notNull(),
    clientTimestamp: timestamp('client_timestamp', { withTimezone: true }),
    serverTimestamp: timestamp('server_timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('movement_events_org_idempotency_unique').on(
      table.organizationId,
      table.idempotencyKey,
    ),
    index('movement_events_record_idx').on(table.recordType, table.recordId),
    index('movement_events_org_time_idx').on(
      table.organizationId,
      table.serverTimestamp,
    ),
  ],
)

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  storedFileId: uuid('stored_file_id')
    .notNull()
    .references(() => storedFiles.id, { onDelete: 'cascade' }),
  caption: text('caption'),
  uploadedById: uuid('uploaded_by_id')
    .notNull()
    .references(() => users.id),
  ...timestamps,
})

export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  ...timestamps,
})

// ============================================================================
// 7. Staged Configuration Rules Registry
// ============================================================================

export const configStatusEnum = pgEnum('config_status', [
  'active',
  'proposed_change',
  'deprecated',
])

export const configurationRules = pgTable(
  'configuration_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    category: text('category').notNull(),
    ruleKey: text('rule_key').notNull(),
    activeValue: jsonb('active_value').notNull(),
    proposedValue: jsonb('proposed_value'),
    status: configStatusEnum('status').notNull().default('active'),
    version: integer('version').notNull().default(1),
    effectiveFrom: timestamp('effective_from', { withTimezone: true }),
    effectiveTo: timestamp('effective_to', { withTimezone: true }),
    proposedById: uuid('proposed_by_id').references(() => users.id),
    approvedById: uuid('approved_by_id').references(() => users.id),
    approvalNotes: text('approval_notes'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('config_rules_org_cat_key_ver_unique').on(
      table.organizationId,
      table.category,
      table.ruleKey,
      table.version,
    ),
  ],
)

// ============================================================================
// 8. Background Task Queue
// ============================================================================

export const jobStatus = pgEnum('job_status', [
  'queued',
  'running',
  'retry',
  'succeeded',
  'dead',
])

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').notNull(),
    payload: jsonb('payload').notNull().default({}),
    status: jobStatus('status').notNull().default('queued'),
    idempotencyKey: text('idempotency_key').notNull(),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    availableAt: timestamp('available_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by'),
    lastError: jsonb('last_error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('jobs_idempotency_key_unique').on(table.idempotencyKey),
    index('jobs_claim_index').on(table.status, table.availableAt),
  ],
)

// ============================================================================
// 9. Relational Queries Configuration
// ============================================================================

export const productionJobsRelations = relations(
  productionJobs,
  ({ one, many }) => ({
    customer: one(customers, {
      fields: [productionJobs.customerId],
      references: [customers.id],
    }),
    project: one(projects, {
      fields: [productionJobs.projectId],
      references: [projects.id],
    }),
    releases: many(releases),
  }),
)

export const releasesRelations = relations(releases, ({ one, many }) => ({
  job: one(productionJobs, {
    fields: [releases.jobId],
    references: [productionJobs.id],
  }),
  revisions: many(releaseRevisions),
}))

export const releaseRevisionsRelations = relations(
  releaseRevisions,
  ({ one, many }) => ({
    release: one(releases, {
      fields: [releaseRevisions.releaseId],
      references: [releases.id],
    }),
    panelMarks: many(panelMarks),
    operations: many(operationInstances),
  }),
)
