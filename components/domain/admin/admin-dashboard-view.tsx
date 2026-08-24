'use client'

import React, { useState } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Users,
  Shield,
  Sliders,
  History,
  Plus,
  FileSpreadsheet,
  AlertTriangle,
  Pencil,
  Trash2,
  UserCheck,
  UserX,
  Loader2,
} from 'lucide-react'
import {
  UserManagementItem,
  RoleManagementItem,
  SystemConfigItem,
  AuditLedgerItem,
} from '@/lib/services/admin'

interface AdminDashboardProps {
  initialUsers: UserManagementItem[]
  initialRoles: RoleManagementItem[]
  initialConfigs: SystemConfigItem[]
  initialAuditLogs: AuditLedgerItem[]
  isAdmin: boolean
}

const AVAILABLE_PERMISSIONS = [
  'view',
  'create',
  'edit',
  'approve',
  'override',
  'export',
  'configure',
  'administer',
]

export function AdminDashboardView({
  initialUsers,
  initialRoles,
  initialConfigs,
  initialAuditLogs,
}: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    'users' | 'roles' | 'config' | 'audit'
  >('users')

  const [usersList, setUsersList] = useState<UserManagementItem[]>(initialUsers)
  const [rolesList, setRolesList] = useState<RoleManagementItem[]>(initialRoles)
  const [configsList, setConfigsList] =
    useState<SystemConfigItem[]>(initialConfigs)
  const [auditLogsList] = useState<AuditLedgerItem[]>(initialAuditLogs)

  // Modals
  const [isCreateUserOpen, setIsCreateUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [isDeleteUserOpen, setIsDeleteUserOpen] = useState(false)
  const [isCreateRoleOpen, setIsCreateRoleOpen] = useState(false)
  const [isEditRoleOpen, setIsEditRoleOpen] = useState(false)
  const [isProposeConfigOpen, setIsProposeConfigOpen] = useState(false)
  const [isApproveConfigOpen, setIsApproveConfigOpen] = useState(false)

  // User Forms
  const [newUserName, setNewUserName] = useState('')
  const [newUserEmail, setNewUserEmail] = useState('')
  const [newUserPassword, setNewUserPassword] = useState('')
  const [newUserIsAdmin, setNewUserIsAdmin] = useState(false)
  const [newUserRoles, setNewUserRoles] = useState<string[]>(['operator'])

  // Edit User State
  const [selectedUserForEdit, setSelectedUserForEdit] =
    useState<UserManagementItem | null>(null)
  const [editUserName, setEditUserName] = useState('')
  const [editUserEmail, setEditUserEmail] = useState('')
  const [editUserPassword, setEditUserPassword] = useState('')
  const [editUserIsAdmin, setEditUserIsAdmin] = useState(false)
  const [editUserRoles, setEditUserRoles] = useState<string[]>([])

  // Delete User State
  const [selectedUserForDelete, setSelectedUserForDelete] =
    useState<UserManagementItem | null>(null)
  const [actionLoadingUserId, setActionLoadingUserId] = useState<string | null>(
    null,
  )

  const [newRoleName, setNewRoleName] = useState('')
  const [newRoleDescription, setNewRoleDescription] = useState('')
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([
    'view',
  ])

  const [selectedRoleForEdit, setSelectedRoleForEdit] =
    useState<RoleManagementItem | null>(null)
  const [editPermissionsList, setEditPermissionsList] = useState<string[]>([])

  const [selectedConfig, setSelectedConfig] = useState<SystemConfigItem | null>(
    null,
  )
  const [proposedJsonValue, setProposedJsonValue] = useState('')
  const [configReason, setConfigReason] = useState('')

  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUserName,
          email: newUserEmail,
          password: newUserPassword,
          isAdmin: newUserIsAdmin,
          roleNames: newUserRoles,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to create user')
      }

      const data = (await res.json()) as { user: UserManagementItem }
      setUsersList([data.user, ...usersList])
      setIsCreateUserOpen(false)
      setNewUserName('')
      setNewUserEmail('')
      setNewUserPassword('')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error creating user',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Open Edit User
  const handleOpenEditUser = (user: UserManagementItem) => {
    setSelectedUserForEdit(user)
    setEditUserName(user.name)
    setEditUserEmail(user.email)
    setEditUserPassword('')
    setEditUserIsAdmin(user.isAdmin)
    setEditUserRoles([...user.roles])
    setErrorMessage(null)
    setIsEditUserOpen(true)
  }

  // Handle Save Edit User
  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedUserForEdit) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/admin/users/${selectedUserForEdit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editUserName,
          email: editUserEmail,
          password: editUserPassword || undefined,
          isAdmin: editUserIsAdmin,
          roleNames: editUserRoles,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to update user')
      }

      const data = (await res.json()) as { user: UserManagementItem }
      setUsersList((prev) =>
        prev.map((u) => (u.id === data.user.id ? data.user : u)),
      )
      setIsEditUserOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error updating user',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Toggle Disable/Enable User
  const handleToggleDisableUser = async (user: UserManagementItem) => {
    const isCurrentlyDisabled = Boolean(user.disabledAt)
    setActionLoadingUserId(user.id)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          disabled: !isCurrentlyDisabled,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to toggle user status')
      }

      const data = (await res.json()) as { user: UserManagementItem }
      setUsersList((prev) =>
        prev.map((u) => (u.id === data.user.id ? data.user : u)),
      )
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error changing user status',
      )
    } finally {
      setActionLoadingUserId(null)
    }
  }

  // Handle Open Delete User Dialog
  const handleOpenDeleteUser = (user: UserManagementItem) => {
    setSelectedUserForDelete(user)
    setErrorMessage(null)
    setIsDeleteUserOpen(true)
  }

  // Handle Confirm Delete User
  const handleConfirmDeleteUser = async () => {
    if (!selectedUserForDelete) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch(`/api/admin/users/${selectedUserForDelete.id}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to delete user')
      }

      setUsersList((prev) =>
        prev.filter((u) => u.id !== selectedUserForDelete.id),
      )
      setIsDeleteUserOpen(false)
      setSelectedUserForDelete(null)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error deleting user',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Create Custom Role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newRoleName,
          description: newRoleDescription,
          permissions: newRolePermissions,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to create role')
      }

      const data = (await res.json()) as { role: RoleManagementItem }
      setRolesList([...rolesList, data.role])
      setIsCreateRoleOpen(false)
      setNewRoleName('')
      setNewRoleDescription('')
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error creating role',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Update Role Permissions
  const handleUpdateRolePerms = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedRoleForEdit) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roleId: selectedRoleForEdit.id,
          permissions: editPermissionsList,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to update permissions')
      }

      setRolesList((prev) =>
        prev.map((r) =>
          r.id === selectedRoleForEdit.id
            ? { ...r, permissions: editPermissionsList }
            : r,
        ),
      )
      setIsEditRoleOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error updating permissions',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Propose Config Change
  const handleProposeConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConfig) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      let parsedValue: unknown
      try {
        parsedValue = JSON.parse(proposedJsonValue)
      } catch {
        parsedValue = proposedJsonValue
      }

      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'propose',
          configId: selectedConfig.id,
          proposedValue: parsedValue,
          reason: configReason,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to propose change')
      }

      setConfigsList((prev) =>
        prev.map((c) =>
          c.id === selectedConfig.id
            ? {
                ...c,
                status: 'proposed_change',
                proposedValue: parsedValue,
                approvalNotes: configReason,
              }
            : c,
        ),
      )
      setIsProposeConfigOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error proposing config',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  // Handle Approve Config Change
  const handleApproveConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedConfig) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await fetch('/api/admin/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'approve',
          configId: selectedConfig.id,
          approvalNotes: configReason || 'Approved by administrator',
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error || 'Failed to approve config')
      }

      setConfigsList((prev) =>
        prev.map((c) =>
          c.id === selectedConfig.id
            ? {
                ...c,
                status: 'active',
                activeValue: c.proposedValue,
                proposedValue: null,
                version: c.version + 1,
              }
            : c,
        ),
      )
      setIsApproveConfigOpen(false)
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Error approving config',
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            System Administration &amp; Access Control
          </h1>
          <p className="text-xs text-slate-500">
            User management, dynamic RBAC permission matrices, staged
            configuration rules, and immutable audit ledger
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <Button
          variant={activeTab === 'users' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('users')}
          className="text-xs font-semibold"
        >
          <Users className="mr-1.5 h-3.5 w-3.5" />
          Users &amp; Logins ({usersList.length})
        </Button>
        <Button
          variant={activeTab === 'roles' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('roles')}
          className="text-xs font-semibold"
        >
          <Shield className="mr-1.5 h-3.5 w-3.5" />
          Dynamic Roles &amp; Permissions ({rolesList.length})
        </Button>
        <Button
          variant={activeTab === 'config' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('config')}
          className="text-xs font-semibold"
        >
          <Sliders className="mr-1.5 h-3.5 w-3.5" />
          Staged Config Rules ({configsList.length})
        </Button>
        <Button
          variant={activeTab === 'audit' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setActiveTab('audit')}
          className="text-xs font-semibold"
        >
          <History className="mr-1.5 h-3.5 w-3.5" />
          Audit Ledger ({auditLogsList.length})
        </Button>
      </div>

      {/* TAB 1: USER MANAGEMENT */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">
              Registered Plant Users
            </h2>
            <Button
              onClick={() => {
                setErrorMessage(null)
                setIsCreateUserOpen(true)
              }}
              size="sm"
              className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Add New User
            </Button>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3">User Name</th>
                    <th className="p-3">Email</th>
                    <th className="p-3">Assigned Roles</th>
                    <th className="p-3">Admin Status</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usersList.map((u) => {
                    const isDisabled = Boolean(u.disabledAt)
                    const isLoading = actionLoadingUserId === u.id

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-slate-50/50 ${
                          isDisabled ? 'bg-slate-50/70 opacity-75' : ''
                        }`}
                      >
                        <td className="p-3 font-bold text-slate-900">
                          {u.name}
                          {isDisabled && (
                            <span className="ml-2 text-[10px] font-normal text-rose-600">
                              (Disabled)
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">{u.email}</td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles.map((r) => (
                              <Badge
                                key={r}
                                variant="outline"
                                className="border-slate-200 bg-slate-50 text-[10px] text-slate-700"
                              >
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          {u.isAdmin ? (
                            <Badge className="border-purple-200 bg-purple-100 text-[10px] font-bold text-purple-800">
                              Administrator
                            </Badge>
                          ) : (
                            <span className="text-slate-400">Standard</span>
                          )}
                        </td>
                        <td className="p-3">
                          {isDisabled ? (
                            <Badge
                              variant="outline"
                              className="border-rose-200 bg-rose-50 text-[10px] font-bold text-rose-700"
                            >
                              Disabled
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-emerald-200 bg-emerald-50 text-[10px] font-bold text-emerald-700"
                            >
                              Active
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 font-mono text-[10px] text-slate-400">
                          {new Date(u.createdAt).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenEditUser(u)}
                              className="h-7 px-2 text-[11px] text-slate-700 hover:text-blue-600"
                              title="Edit user details and roles"
                            >
                              <Pencil className="mr-1 h-3 w-3" />
                              Edit
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              disabled={isLoading}
                              onClick={() => handleToggleDisableUser(u)}
                              className={`h-7 px-2 text-[11px] ${
                                isDisabled
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                              }`}
                              title={
                                isDisabled ? 'Enable user login' : 'Disable user login'
                              }
                            >
                              {isLoading ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : isDisabled ? (
                                <>
                                  <UserCheck className="mr-1 h-3 w-3" />
                                  Enable
                                </>
                              ) : (
                                <>
                                  <UserX className="mr-1 h-3 w-3" />
                                  Disable
                                </>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenDeleteUser(u)}
                              className="h-7 px-2 text-[11px] text-rose-600 hover:border-rose-300 hover:bg-rose-50"
                              title="Delete user"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: DYNAMIC ROLES & PERMISSIONS */}
      {activeTab === 'roles' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Custom Role &amp; Permission Registry
              </h2>
              <p className="text-xs text-slate-500">
                Create new roles and reconfigure permissions in real-time
                without modifying code.
              </p>
            </div>
            <Button
              onClick={() => {
                setErrorMessage(null)
                setIsCreateRoleOpen(true)
              }}
              size="sm"
              className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Create Custom Role
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {rolesList.map((role) => (
              <Card
                key={role.id}
                className="border-slate-200 bg-white p-4 shadow-xs"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-slate-900">
                        {role.name}
                      </span>
                      {role.isSystem && (
                        <Badge
                          variant="outline"
                          className="bg-slate-100 text-[9px] text-slate-600"
                        >
                          System Role
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500">
                      {role.description ||
                        `Assigned to ${role.userCount} active users`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setSelectedRoleForEdit(role)
                      setEditPermissionsList([...role.permissions])
                      setIsEditRoleOpen(true)
                    }}
                    className="h-7 text-xs"
                  >
                    Edit Perms
                  </Button>
                </div>

                <div className="mt-3 border-t border-slate-100 pt-2">
                  <div className="mb-1 text-[10px] font-bold text-slate-400 uppercase">
                    Allowed Actions ({role.permissions.length})
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {role.permissions.map((p) => (
                      <Badge
                        key={p}
                        variant="outline"
                        className="border-blue-200 bg-blue-50 font-mono text-[10px] text-blue-700"
                      >
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: STAGED CONFIGURATION RULES */}
      {activeTab === 'config' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Staged Manufacturing Rules Registry
            </h2>
            <p className="text-xs text-slate-500">
              Operational parameters requiring explicit supervisor approval
              before activating.
            </p>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3">Category</th>
                    <th className="p-3">Rule Key</th>
                    <th className="p-3">Active Value</th>
                    <th className="p-3">Proposed Value</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {configsList.map((cfg) => (
                    <tr key={cfg.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-semibold text-slate-700">
                        {cfg.category}
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">
                        {cfg.ruleKey}
                      </td>
                      <td className="p-3 font-mono text-slate-800">
                        {typeof cfg.activeValue === 'object'
                          ? JSON.stringify(cfg.activeValue)
                          : String(cfg.activeValue)}
                      </td>
                      <td className="p-3 font-mono text-amber-700">
                        {cfg.proposedValue
                          ? typeof cfg.proposedValue === 'object'
                            ? JSON.stringify(cfg.proposedValue)
                            : String(cfg.proposedValue)
                          : '-'}
                      </td>
                      <td className="p-3">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-bold ${
                            cfg.status === 'active'
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : 'border-amber-200 bg-amber-50 text-amber-700'
                          }`}
                        >
                          {cfg.status} (v{cfg.version})
                        </Badge>
                      </td>
                      <td className="space-x-1 p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedConfig(cfg)
                            setProposedJsonValue(
                              typeof cfg.activeValue === 'object'
                                ? JSON.stringify(cfg.activeValue, null, 2)
                                : String(cfg.activeValue),
                            )
                            setConfigReason('')
                            setIsProposeConfigOpen(true)
                          }}
                          className="h-6 text-[11px]"
                        >
                          Propose
                        </Button>
                        {cfg.status === 'proposed_change' && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedConfig(cfg)
                              setConfigReason('')
                              setIsApproveConfigOpen(true)
                            }}
                            className="h-6 bg-emerald-600 text-[11px] hover:bg-emerald-700"
                          >
                            Approve
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 4: IMMUTABLE AUDIT LEDGER */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Immutable Audit Trail
              </h2>
              <p className="text-xs text-slate-500">
                Append-only forensic event history recording every consequential
                state mutation.
              </p>
            </div>
            <a
              href="/api/admin/audit?export=true"
              target="_blank"
              rel="noreferrer"
            >
              <Button
                size="sm"
                className="bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
              >
                <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                Export Ledger (CSV)
              </Button>
            </a>
          </div>

          <Card className="border-slate-200 bg-white shadow-xs">
            <div className="max-h-[600px] overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 border-b border-slate-100 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase">
                  <tr>
                    <th className="p-3">Timestamp (UTC)</th>
                    <th className="p-3">Action</th>
                    <th className="p-3">Entity</th>
                    <th className="p-3">User</th>
                    <th className="p-3">State Transition</th>
                    <th className="p-3">Reason / Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {auditLogsList.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-mono text-[10px] text-slate-400">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="p-3 font-mono font-bold text-blue-700">
                        {log.action}
                      </td>
                      <td className="p-3 font-semibold text-slate-700">
                        {log.entityType} ({log.entityId.slice(0, 8)}...)
                      </td>
                      <td className="p-3 text-slate-600">
                        {log.userName || log.userEmail || 'System'}
                      </td>
                      <td className="p-3 font-mono text-[11px] text-slate-800">
                        {log.priorState ? `${log.priorState} ➔ ` : ''}
                        <span className="font-bold text-emerald-700">
                          {log.newState || '-'}
                        </span>
                      </td>
                      <td className="max-w-xs truncate p-3 text-slate-500 italic">
                        {log.reason || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Create User Modal */}
      <Dialog open={isCreateUserOpen} onOpenChange={setIsCreateUserOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateUser}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Register New Plant User
              </DialogTitle>
              <DialogDescription className="text-xs">
                Create user credentials and select default roles.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. Maria Gonzalez"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="maria@elward.com"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">Password</label>
                <input
                  type="password"
                  required
                  value={newUserPassword}
                  onChange={(e) => setNewUserPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="Min 6 characters"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Assign Roles
                </label>
                <div className="mt-1 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2">
                  {rolesList.map((r) => {
                    const isChecked = newUserRoles.includes(r.name)
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewUserRoles([...newUserRoles, r.name])
                            } else {
                              setNewUserRoles(
                                newUserRoles.filter((name) => name !== r.name),
                              )
                            }
                          }}
                        />
                        <span>{r.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isAdmin"
                  checked={newUserIsAdmin}
                  onChange={(e) => setNewUserIsAdmin(e.target.checked)}
                />
                <label htmlFor="isAdmin" className="font-bold text-slate-800">
                  Grant Full Administrator Privilege
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateUserOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Creating...' : 'Create User'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Role Modal */}
      <Dialog open={isCreateRoleOpen} onOpenChange={setIsCreateRoleOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreateRole}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Create Dynamic Custom Role
              </DialogTitle>
              <DialogDescription className="text-xs">
                Define a custom role title and configure permitted actions.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  Role Name
                </label>
                <input
                  type="text"
                  required
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. Field Estimator"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Description
                </label>
                <input
                  type="text"
                  value={newRoleDescription}
                  onChange={(e) => setNewRoleDescription(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. On-site field inspection and revision sign-off"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Permissions
                </label>
                <div className="mt-1 grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-2">
                  {AVAILABLE_PERMISSIONS.map((perm) => {
                    const isChecked = newRolePermissions.includes(perm)
                    return (
                      <label
                        key={perm}
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setNewRolePermissions([
                                ...newRolePermissions,
                                perm,
                              ])
                            } else {
                              setNewRolePermissions(
                                newRolePermissions.filter((p) => p !== perm),
                              )
                            }
                          }}
                        />
                        <span className="font-mono text-[11px]">{perm}</span>
                      </label>
                    )
                  })}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateRoleOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Creating...' : 'Create Role'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Role Permissions Modal */}
      <Dialog open={isEditRoleOpen} onOpenChange={setIsEditRoleOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUpdateRolePerms}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Edit Permissions for &quot;{selectedRoleForEdit?.name}&quot;
              </DialogTitle>
              <DialogDescription className="text-xs">
                Toggle authorized capabilities for this role template.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-xs">
              <div className="grid grid-cols-2 gap-2 rounded-md border border-slate-200 p-3">
                {AVAILABLE_PERMISSIONS.map((perm) => {
                  const isChecked = editPermissionsList.includes(perm)
                  return (
                    <label
                      key={perm}
                      className="flex cursor-pointer items-center gap-2"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setEditPermissionsList([
                              ...editPermissionsList,
                              perm,
                            ])
                          } else {
                            setEditPermissionsList(
                              editPermissionsList.filter((p) => p !== perm),
                            )
                          }
                        }}
                      />
                      <span className="font-mono text-[11px]">{perm}</span>
                    </label>
                  )
                })}
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditRoleOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Saving...' : 'Save Permissions'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Propose Config Modal */}
      <Dialog open={isProposeConfigOpen} onOpenChange={setIsProposeConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleProposeConfig}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Propose Change to {selectedConfig?.ruleKey}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Staged config changes require supervisor approval before
                activating.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  Proposed Value (JSON/Text)
                </label>
                <textarea
                  rows={3}
                  required
                  value={proposedJsonValue}
                  onChange={(e) => setProposedJsonValue(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 font-mono text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Reason / Change Justification
                </label>
                <input
                  type="text"
                  required
                  value={configReason}
                  onChange={(e) => setConfigReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. Updated shop floor crane capacity to 3000 lbs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsProposeConfigOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Proposed Change'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Approve Config Modal */}
      <Dialog open={isApproveConfigOpen} onOpenChange={setIsApproveConfigOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleApproveConfig}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Approve &amp; Activate {selectedConfig?.ruleKey}
              </DialogTitle>
              <DialogDescription className="text-xs">
                Promote proposed value to live production configuration.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-4 text-xs">
              <div className="rounded-md bg-slate-50 p-2.5 font-mono text-[11px]">
                <div className="text-slate-500">Proposed Value:</div>
                <div className="mt-1 font-bold text-amber-800">
                  {typeof selectedConfig?.proposedValue === 'object'
                    ? JSON.stringify(selectedConfig.proposedValue)
                    : String(selectedConfig?.proposedValue)}
                </div>
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Approval Sign-off Notes
                </label>
                <input
                  type="text"
                  required
                  value={configReason}
                  onChange={(e) => setConfigReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="e.g. Reviewed and verified with Plant Manager"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsApproveConfigOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-emerald-600 text-xs font-semibold hover:bg-emerald-700"
              >
                {isSubmitting ? 'Activating...' : 'Approve & Activate'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleSaveEditUser}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold">
                Edit User Details &amp; Access
              </DialogTitle>
              <DialogDescription className="text-xs">
                Update account profile, role assignments, or reset password.
              </DialogDescription>
            </DialogHeader>

            {errorMessage && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="space-y-3 py-4 text-xs">
              <div>
                <label className="font-semibold text-slate-700">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editUserName}
                  onChange={(e) => setEditUserName(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={editUserEmail}
                  onChange={(e) => setEditUserEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Reset Password (Optional)
                </label>
                <input
                  type="password"
                  value={editUserPassword}
                  onChange={(e) => setEditUserPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 p-2 text-xs"
                  placeholder="Leave blank to keep existing password"
                />
              </div>

              <div>
                <label className="font-semibold text-slate-700">
                  Assign Roles
                </label>
                <div className="mt-1 grid max-h-32 grid-cols-2 gap-2 overflow-y-auto rounded-md border border-slate-200 p-2">
                  {rolesList.map((r) => {
                    const isChecked = editUserRoles.includes(r.name)
                    return (
                      <label
                        key={r.id}
                        className="flex cursor-pointer items-center gap-1.5"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEditUserRoles([...editUserRoles, r.name])
                            } else {
                              setEditUserRoles(
                                editUserRoles.filter((name) => name !== r.name),
                              )
                            }
                          }}
                        />
                        <span>{r.name}</span>
                      </label>
                    )
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="editIsAdmin"
                  checked={editUserIsAdmin}
                  onChange={(e) => setEditUserIsAdmin(e.target.checked)}
                />
                <label htmlFor="editIsAdmin" className="font-bold text-slate-800">
                  Grant Full Administrator Privilege
                </label>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditUserOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                size="sm"
                className="bg-blue-600 text-xs font-semibold hover:bg-blue-700"
              >
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <Dialog open={isDeleteUserOpen} onOpenChange={setIsDeleteUserOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-700">
              Confirm Permanent User Deletion
            </DialogTitle>
            <DialogDescription className="text-xs">
              Are you sure you want to permanently delete user{' '}
              <strong className="text-slate-900">
                {selectedUserForDelete?.name}
              </strong>{' '}
              ({selectedUserForDelete?.email})? This action will remove their
              access and role assignments immediately.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="mt-3 flex items-center gap-2 rounded-md bg-red-50 p-2.5 text-xs text-red-700">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <DialogFooter className="mt-4">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDeleteUserOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={isSubmitting}
              onClick={handleConfirmDeleteUser}
              size="sm"
              className="bg-rose-600 text-xs font-semibold hover:bg-rose-700"
            >
              {isSubmitting ? 'Deleting...' : 'Delete User Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
