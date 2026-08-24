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
    isProductionFacility: boolean('is_production_facility')
      .notNull()
      .default(false),
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
    elevation: text('elevation'),
    sourceMetadata: jsonb('source_metadata'),
    notes: text('notes'),
    isRemake: boolean('is_remake').notNull().default(false),
    originalMarkId: uuid('original_mark_id'),
    remakeType: text('remake_type'), // 'RMK' | 'RME'
    remakeSequence: integer('remake_sequence'),
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
// 5B. Inventory, Purchasing, Receiving & Allocations
// ============================================================================

export const inventoryItems = pgTable(
  'inventory_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    itemNumber: text('item_number').notNull(),
    materialFamily: text('material_family').notNull(), // 'ACM' | 'Plate' | 'Extrusion' | 'Fastener' | 'Gasket' | 'Other'
    description: text('description').notNull(),
    manufacturer: text('manufacturer'),
    color: text('color'),
    finish: text('finish'),
    thickness: numeric('thickness', { precision: 10, scale: 4 }),
    width: numeric('width', { precision: 10, scale: 4 }),
    length: numeric('length', { precision: 10, scale: 4 }),
    unit: text('unit').notNull().default('sheets'), // 'sheets' | 'ft' | 'pcs' | 'lbs'
    reorderPoint: numeric('reorder_point', { precision: 12, scale: 4 }).default(
      '10',
    ),
    reorderQuantity: numeric('reorder_quantity', {
      precision: 12,
      scale: 4,
    }).default('20'),
    unitCost: numeric('unit_cost', { precision: 12, scale: 4 }).default('0'),
    status: text('status').notNull().default('Active'), // 'Active' | 'Discontinued' | 'Hold'
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('inventory_items_org_item_number_unique').on(
      table.organizationId,
      table.itemNumber,
    ),
  ],
)

export const inventoryLocations = pgTable(
  'inventory_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    code: text('code').notNull(),
    name: text('name').notNull(),
    zone: text('zone').notNull().default('Warehouse'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('inventory_locations_org_code_unique').on(
      table.organizationId,
      table.code,
    ),
  ],
)

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    poNumber: text('po_number').notNull(),
    vendorName: text('vendor_name').notNull(),
    status: text('status').notNull().default('Issued'), // 'Draft' | 'Issued' | 'Partially Received' | 'Received' | 'Cancelled'
    orderDate: timestamp('order_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expectedDate: timestamp('expected_date', { withTimezone: true }),
    releaseId: uuid('release_id').references(() => releases.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    version: integer('version').notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('purchase_orders_org_po_number_unique').on(
      table.organizationId,
      table.poNumber,
    ),
  ],
)

export const purchaseOrderLines = pgTable('purchase_order_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  purchaseOrderId: uuid('purchase_order_id')
    .notNull()
    .references(() => purchaseOrders.id, { onDelete: 'cascade' }),
  lineNumber: integer('line_number').notNull(),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id),
  description: text('description').notNull(),
  orderedQuantity: numeric('ordered_quantity', {
    precision: 12,
    scale: 4,
  }).notNull(),
  receivedQuantity: numeric('received_quantity', {
    precision: 12,
    scale: 4,
  })
    .notNull()
    .default('0'),
  unit: text('unit').notNull().default('sheets'),
  unitPrice: numeric('unit_price', { precision: 12, scale: 4 }).default('0'),
  status: text('status').notNull().default('Open'), // 'Open' | 'Partially Received' | 'Completed' | 'Cancelled'
  ...timestamps,
})

export const materialAllocations = pgTable('material_allocations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id, { onDelete: 'cascade' }),
  releaseId: uuid('release_id')
    .notNull()
    .references(() => releases.id, { onDelete: 'cascade' }),
  panelMarkId: uuid('panel_mark_id').references(() => panelMarks.id, {
    onDelete: 'set null',
  }),
  allocatedQuantity: numeric('allocated_quantity', {
    precision: 12,
    scale: 4,
  }).notNull(),
  issuedQuantity: numeric('issued_quantity', {
    precision: 12,
    scale: 4,
  })
    .notNull()
    .default('0'),
  consumedQuantity: numeric('consumed_quantity', {
    precision: 12,
    scale: 4,
  })
    .notNull()
    .default('0'),
  unit: text('unit').notNull().default('sheets'),
  isSubstituted: boolean('is_substituted').notNull().default(false),
  originalItemId: uuid('original_item_id').references(() => inventoryItems.id, {
    onDelete: 'set null',
  }),
  substitutionReason: text('substitution_reason'),
  allocatedById: uuid('allocated_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  ...timestamps,
})

export const cycleCountSessions = pgTable('cycle_count_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  sessionNumber: text('session_number').notNull(),
  status: text('status').notNull().default('Open'), // 'Open' | 'In Progress' | 'Reconciliation Required' | 'Approved' | 'Closed'
  isBlindMode: boolean('is_blind_mode').notNull().default(true),
  scopeZone: text('scope_zone').notNull().default('All Warehouse'),
  countedById: uuid('counted_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  approvedById: uuid('approved_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  notes: text('notes'),
  startedAt: timestamp('started_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
  ...timestamps,
})

export const cycleCountLines = pgTable('cycle_count_lines', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id')
    .notNull()
    .references(() => cycleCountSessions.id, { onDelete: 'cascade' }),
  inventoryItemId: uuid('inventory_item_id')
    .notNull()
    .references(() => inventoryItems.id, { onDelete: 'cascade' }),
  locationId: uuid('location_id').references(() => inventoryLocations.id, {
    onDelete: 'set null',
  }),
  systemQuantity: numeric('system_quantity', {
    precision: 12,
    scale: 4,
  }).notNull(),
  countedQuantity: numeric('counted_quantity', { precision: 12, scale: 4 }),
  discrepancyQuantity: numeric('discrepancy_quantity', {
    precision: 12,
    scale: 4,
  }),
  isReconciled: boolean('is_reconciled').notNull().default(false),
  reconciliationReason: text('reconciliation_reason'),
  ...timestamps,
})

// Immutable Inventory Transactions Ledger
export const inventoryTransactions = pgTable(
  'inventory_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    inventoryItemId: uuid('inventory_item_id')
      .notNull()
      .references(() => inventoryItems.id, { onDelete: 'cascade' }),
    locationId: uuid('location_id').references(() => inventoryLocations.id, {
      onDelete: 'set null',
    }),
    transactionType: text('transaction_type').notNull(), // 'opening_balance' | 'receipt' | 'transfer' | 'allocation' | 'deallocation' | 'issue' | 'return' | 'consumption' | 'scrap' | 'adjustment' | 'cycle_count'
    quantity: numeric('quantity', { precision: 12, scale: 4 }).notNull(),
    unit: text('unit').notNull().default('sheets'),
    lotNumber: text('lot_number'),
    heatNumber: text('heat_number'),
    condition: text('condition').notNull().default('good'), // 'good' | 'damaged' | 'held' | 'quarantine'
    releaseId: uuid('release_id').references(() => releases.id, {
      onDelete: 'set null',
    }),
    panelMarkId: uuid('panel_mark_id').references(() => panelMarks.id, {
      onDelete: 'set null',
    }),
    operationInstanceId: uuid('operation_instance_id').references(
      () => operationInstances.id,
      { onDelete: 'set null' },
    ),
    purchaseOrderId: uuid('purchase_order_id').references(
      () => purchaseOrders.id,
      { onDelete: 'set null' },
    ),
    purchaseOrderLineId: uuid('purchase_order_line_id').references(
      () => purchaseOrderLines.id,
      { onDelete: 'set null' },
    ),
    countSessionId: uuid('count_session_id').references(
      () => cycleCountSessions.id,
      { onDelete: 'set null' },
    ),
    actorId: uuid('actor_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actingRole: text('acting_role').notNull(),
    reason: text('reason'), // Mandatory for scrap, adjustments, substitutions
    notes: text('notes'),
    serverTimestamp: timestamp('server_timestamp', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('inv_trans_org_time_idx').on(
      table.organizationId,
      table.serverTimestamp,
    ),
    index('inv_trans_item_idx').on(table.inventoryItemId),
    index('inv_trans_type_idx').on(table.transactionType),
  ],
)

// ============================================================================
// 5C. Quality Management, Holds, Non-Conformances & Remakes
// ============================================================================

export const qualityInspections = pgTable('quality_inspections', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  releaseId: uuid('release_id')
    .notNull()
    .references(() => releases.id, { onDelete: 'cascade' }),
  releaseRevisionId: uuid('release_revision_id').references(
    () => releaseRevisions.id,
    { onDelete: 'set null' },
  ),
  panelMarkId: uuid('panel_mark_id')
    .notNull()
    .references(() => panelMarks.id, { onDelete: 'cascade' }),
  operationInstanceId: uuid('operation_instance_id').references(
    () => operationInstances.id,
    { onDelete: 'set null' },
  ),
  quantity: integer('quantity').notNull().default(1),
  inspectorId: uuid('inspector_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  specificationVersion: text('specification_version').notNull().default('v1.0'),
  measurements: jsonb('measurements'), // { width, length, diagonal, thickness, notes }
  disposition: text('disposition').notNull(), // 'Pass' | 'Pass with Note' | 'Hold' | 'Rework' | 'Remake' | 'Scrap'
  notes: text('notes'),
  destination: text('destination'),
  ...timestamps,
})

export const qualityIssues = pgTable('quality_issues', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  issueNumber: text('issue_number').notNull(),
  category: text('category').notNull(), // 'Surface Defect' | 'Dimensional Discrepancy' | 'Machining / Routing Error' | 'Hardware/Assembly Defect' | 'Material Flaw' | 'Drawing Discrepancy' | 'Handling Damage' | 'Other'
  severity: text('severity').notNull().default('Moderate'), // 'Minor' | 'Moderate' | 'Critical' | 'Blocking'
  detectionPoint: text('detection_point').notNull(), // 'QC Final Inspection' | 'Assembly Bay' | 'CNC Routing'
  suspectedCause: text('suspected_cause'),
  responsibleDepartment: text('responsible_department').notNull(), // 'Engineering' | 'CNC' | 'ELU' | 'Assembly' | 'Material/Vendor' | 'Shipping' | 'Field'
  ownerId: uuid('owner_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  dueDate: timestamp('due_date', { withTimezone: true }),
  affectedQuantity: integer('affected_quantity').notNull().default(1),
  containmentAction: text('containment_action'),
  disposition: text('disposition').notNull().default('Hold'), // 'Hold' | 'Rework' | 'Remake' | 'Scrap' | 'Pass with Note' | 'Resolved'
  status: text('status').notNull().default('Open'), // 'Open' | 'Under Investigation' | 'Resolved' | 'Closed'
  resolutionNotes: text('resolution_notes'),
  verifiedById: uuid('verified_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  verifiedAt: timestamp('verified_at', { withTimezone: true }),
  releaseId: uuid('release_id').references(() => releases.id, {
    onDelete: 'cascade',
  }),
  panelMarkId: uuid('panel_mark_id').references(() => panelMarks.id, {
    onDelete: 'cascade',
  }),
  operationInstanceId: uuid('operation_instance_id').references(
    () => operationInstances.id,
    { onDelete: 'set null' },
  ),
  ...timestamps,
})

export const panelMarkRemakes = pgTable('panel_mark_remakes', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'cascade' }),
  remakeType: text('remake_type').notNull(), // 'RMK' (Shop) | 'RME' (Engineering)
  remakeMark: text('remake_mark').notNull(), // e.g. 'P-101-RME-51'
  sequenceNumber: integer('sequence_number').notNull().default(51),
  originalPanelMarkId: uuid('original_panel_mark_id')
    .notNull()
    .references(() => panelMarks.id, { onDelete: 'cascade' }),
  replacementPanelMarkId: uuid('replacement_panel_mark_id').references(
    () => panelMarks.id,
    { onDelete: 'set null' },
  ),
  qualityIssueId: uuid('quality_issue_id').references(() => qualityIssues.id, {
    onDelete: 'set null',
  }),
  responsibleArea: text('responsible_area').notNull(), // 'Engineering' | 'Shop Floor' | 'Vendor' | 'Customer Change'
  materialCost: numeric('material_cost', { precision: 12, scale: 4 }).default(
    '0',
  ),
  laborHours: numeric('labor_hours', { precision: 10, scale: 2 }).default('0'),
  laborCost: numeric('labor_cost', { precision: 12, scale: 4 }).default('0'),
  outsideCost: numeric('outside_cost', { precision: 12, scale: 4 }).default(
    '0',
  ),
  totalCost: numeric('total_cost', { precision: 12, scale: 4 }).default('0'),
  approvedById: uuid('approved_by_id').references(() => users.id, {
    onDelete: 'set null',
  }),
  status: text('status').notNull().default('Pending'), // 'Pending' | 'In Routing' | 'QC Completed' | 'Palletized' | 'Shipped'
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
// 9. Palletizing & Logistics (Pallet Plans, Pallets, Pallet Items, Shipments)
// ============================================================================

export const palletPlanStatusEnum = pgEnum('pallet_plan_status', [
  'Draft',
  'Review',
  'Approved',
  'Applied',
  'Superseded',
  'Cancelled',
])

export const palletPlans = pgTable(
  'pallet_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    releaseRevisionId: uuid('release_revision_id')
      .notNull()
      .references(() => releaseRevisions.id, { onDelete: 'cascade' }),
    status: palletPlanStatusEnum('status').notNull().default('Draft'),
    algorithmVersion: text('algorithm_version').notNull().default('1.0.0'),
    generatedById: uuid('generated_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    generatedAt: timestamp('generated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedById: uuid('approved_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    appliedById: uuid('applied_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    appliedAt: timestamp('applied_at', { withTimezone: true }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
    warnings: jsonb('warnings').notNull().default([]),
    metadata: jsonb('metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index('pallet_plans_org_release_idx').on(
      table.organizationId,
      table.releaseId,
    ),
    index('pallet_plans_release_rev_idx').on(
      table.organizationId,
      table.releaseRevisionId,
    ),
  ],
)

export const palletPlanPallets = pgTable(
  'pallet_plan_pallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    palletPlanId: uuid('pallet_plan_id')
      .notNull()
      .references(() => palletPlans.id, { onDelete: 'cascade' }),
    sequence: integer('sequence').notNull().default(1),
    plannedPalletNumber: text('planned_pallet_number').notNull(),
    widthInches: numeric('width_inches', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    lengthInches: numeric('length_inches', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    heightInches: numeric('height_inches', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    weightLbs: numeric('weight_lbs', { precision: 10, scale: 2 })
      .notNull()
      .default('0.00'),
    borderInches: numeric('border_inches', { precision: 10, scale: 2 })
      .notNull()
      .default('4.00'),
    elevations: jsonb('elevations').notNull().default([]),
    materialFamilies: jsonb('material_families').notNull().default([]),
    panelCount: integer('panel_count').notNull().default(0),
    notes: text('notes'),
    warnings: jsonb('warnings').notNull().default([]),
    overrides: jsonb('overrides').notNull().default([]),
    ...timestamps,
  },
  (table) => [index('pallet_plan_pallets_plan_idx').on(table.palletPlanId)],
)

export const palletPlanItems = pgTable(
  'pallet_plan_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    palletPlanPalletId: uuid('pallet_plan_pallet_id')
      .notNull()
      .references(() => palletPlanPallets.id, { onDelete: 'cascade' }),
    panelMarkId: uuid('panel_mark_id')
      .notNull()
      .references(() => panelMarks.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    sequence: integer('sequence').notNull().default(1),
    elevation: text('elevation'),
    calculatedWeight: numeric('calculated_weight', { precision: 10, scale: 2 }),
    calculatedHeight: numeric('calculated_height', { precision: 10, scale: 2 }),
    sourceMetadata: jsonb('source_metadata').notNull().default({}),
    ...timestamps,
  },
  (table) => [
    index('pallet_plan_items_pallet_idx').on(table.palletPlanPalletId),
    index('pallet_plan_items_mark_idx').on(table.panelMarkId),
  ],
)

export const pallets = pgTable(
  'pallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    palletNumber: text('pallet_number').notNull(),
    releaseId: uuid('release_id')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    releaseRevisionId: uuid('release_revision_id').references(
      () => releaseRevisions.id,
      { onDelete: 'set null' },
    ),
    palletPlanId: uuid('pallet_plan_id').references(() => palletPlans.id, {
      onDelete: 'set null',
    }),
    status: text('status').notNull().default('Draft'), // 'Draft' | 'Building' | 'Completed' | 'Staged' | 'Shipped'
    elevation: text('elevation'),
    elevations: jsonb('elevations').notNull().default([]),
    widthInches: numeric('width_inches', { precision: 10, scale: 2 }),
    lengthInches: numeric('length_inches', { precision: 10, scale: 2 }),
    borderInches: numeric('border_inches', { precision: 10, scale: 2 }),
    maxHeightInches: numeric('max_height_inches', { precision: 10, scale: 2 })
      .notNull()
      .default('60.00'),
    currentHeightInches: numeric('current_height_inches', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    maxWeightLbs: numeric('max_weight_lbs', { precision: 10, scale: 2 })
      .notNull()
      .default('3500.00'),
    currentWeightLbs: numeric('current_weight_lbs', {
      precision: 10,
      scale: 2,
    })
      .notNull()
      .default('0.00'),
    panelCount: integer('panel_count').notNull().default(0),
    builderId: uuid('builder_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('pallets_org_number_unique').on(
      table.organizationId,
      table.palletNumber,
    ),
    index('pallets_release_id_idx').on(table.releaseId),
  ],
)

export const palletItems = pgTable(
  'pallet_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    palletId: uuid('pallet_id')
      .notNull()
      .references(() => pallets.id, { onDelete: 'cascade' }),
    panelMarkId: uuid('panel_mark_id')
      .notNull()
      .references(() => panelMarks.id, { onDelete: 'cascade' }),
    quantity: integer('quantity').notNull().default(1),
    sequence: integer('sequence').notNull().default(1),
    elevation: text('elevation'),
    calculatedWeight: numeric('calculated_weight', { precision: 10, scale: 2 }),
    calculatedHeight: numeric('calculated_height', { precision: 10, scale: 2 }),
    stagedAt: timestamp('staged_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    stagedById: uuid('staged_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    index('pallet_items_pallet_id_idx').on(table.palletId),
    index('pallet_items_panel_mark_id_idx').on(table.panelMarkId),
  ],
)

export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    shipmentNumber: text('shipment_number').notNull(),
    carrier: text('carrier').notNull().default('Dedicated Logistics'),
    trailerNumber: text('trailer_number'),
    driverName: text('driver_name'),
    driverPhone: text('driver_phone'),
    bolNumber: text('bol_number'),
    status: text('status').notNull().default('Draft'), // 'Draft' | 'Loading' | 'Ready for Dispatch' | 'Dispatched' | 'Delivered'
    scheduledDeparture: timestamp('scheduled_departure', {
      withTimezone: true,
    }),
    actualDeparture: timestamp('actual_departure', { withTimezone: true }),
    originAddress: text('origin_address')
      .notNull()
      .default('Elward Systems Corp Plant 1, Loveland, CO'),
    destinationAddress: text('destination_address'),
    totalWeightLbs: numeric('total_weight_lbs', { precision: 12, scale: 2 })
      .notNull()
      .default('0.00'),
    totalPallets: integer('total_pallets').notNull().default(0),
    dispatchedById: uuid('dispatched_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    notes: text('notes'),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('shipments_org_number_unique').on(
      table.organizationId,
      table.shipmentNumber,
    ),
  ],
)

export const shipmentPallets = pgTable(
  'shipment_pallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    shipmentId: uuid('shipment_id')
      .notNull()
      .references(() => shipments.id, { onDelete: 'cascade' }),
    palletId: uuid('pallet_id')
      .notNull()
      .references(() => pallets.id, { onDelete: 'cascade' }),
    truckPosition: integer('truck_position'),
    loadedAt: timestamp('loaded_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    loadedById: uuid('loaded_by_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    ...timestamps,
  },
  (table) => [
    index('shipment_pallets_shipment_id_idx').on(table.shipmentId),
    index('shipment_pallets_pallet_id_idx').on(table.palletId),
  ],
)

// ============================================================================
// 10. Relational Queries Configuration
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
  pallets: many(pallets),
  palletPlans: many(palletPlans),
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
    palletPlans: many(palletPlans),
  }),
)

export const palletPlansRelations = relations(palletPlans, ({ one, many }) => ({
  release: one(releases, {
    fields: [palletPlans.releaseId],
    references: [releases.id],
  }),
  releaseRevision: one(releaseRevisions, {
    fields: [palletPlans.releaseRevisionId],
    references: [releaseRevisions.id],
  }),
  pallets: many(palletPlanPallets),
  generatedBy: one(users, {
    fields: [palletPlans.generatedById],
    references: [users.id],
  }),
  approvedBy: one(users, {
    fields: [palletPlans.approvedById],
    references: [users.id],
  }),
  appliedBy: one(users, {
    fields: [palletPlans.appliedById],
    references: [users.id],
  }),
}))

export const palletPlanPalletsRelations = relations(
  palletPlanPallets,
  ({ one, many }) => ({
    plan: one(palletPlans, {
      fields: [palletPlanPallets.palletPlanId],
      references: [palletPlans.id],
    }),
    items: many(palletPlanItems),
  }),
)

export const palletPlanItemsRelations = relations(
  palletPlanItems,
  ({ one }) => ({
    pallet: one(palletPlanPallets, {
      fields: [palletPlanItems.palletPlanPalletId],
      references: [palletPlanPallets.id],
    }),
    panelMark: one(panelMarks, {
      fields: [palletPlanItems.panelMarkId],
      references: [panelMarks.id],
    }),
  }),
)

export const palletsRelations = relations(pallets, ({ one, many }) => ({
  release: one(releases, {
    fields: [pallets.releaseId],
    references: [releases.id],
  }),
  releaseRevision: one(releaseRevisions, {
    fields: [pallets.releaseRevisionId],
    references: [releaseRevisions.id],
  }),
  palletPlan: one(palletPlans, {
    fields: [pallets.palletPlanId],
    references: [palletPlans.id],
  }),
  items: many(palletItems),
  shipmentPallets: many(shipmentPallets),
}))

export const palletItemsRelations = relations(palletItems, ({ one }) => ({
  pallet: one(pallets, {
    fields: [palletItems.palletId],
    references: [pallets.id],
  }),
  panelMark: one(panelMarks, {
    fields: [palletItems.panelMarkId],
    references: [panelMarks.id],
  }),
}))

export const shipmentsRelations = relations(shipments, ({ many }) => ({
  shipmentPallets: many(shipmentPallets),
}))

export const shipmentPalletsRelations = relations(
  shipmentPallets,
  ({ one }) => ({
    shipment: one(shipments, {
      fields: [shipmentPallets.shipmentId],
      references: [shipments.id],
    }),
    pallet: one(pallets, {
      fields: [shipmentPallets.palletId],
      references: [pallets.id],
    }),
  }),
)
