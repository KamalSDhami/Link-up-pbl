import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Ban,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronDown,
  Edit2,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

const ROLE_OPTIONS: Array<TableRow<'users'>['role']> = ['student', 'moderator', 'event_manager', 'super_admin']
const GOD_ROLE: TableRow<'users'>['role'] = 'god'
const ROLE_FILTER_OPTIONS: Array<TableRow<'users'>['role']> = [...ROLE_OPTIONS, GOD_ROLE]

const PREDEFINED_SECTIONS: string[] = (() => {
  const result: string[] = []
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  for (const letter of alphabet) {
    result.push(`${letter}1`, `${letter}2`)
  }
  for (let index = 1; index <= 4; index += 1) {
    result.push(`ML${index}`, `DS${index}`, `CS${index}`)
  }
  return result
})()

interface ManagedUser extends Pick<
  TableRow<'users'>,
  | 'id'
  | 'name'
  | 'email'
  | 'role'
  | 'gehu_verified'
  | 'gehu_email'
  | 'is_banned'
  | 'section'
  | 'year'
  | 'created_at'
  | 'updated_at'
> {}

interface CreateUserForm {
  email: string
  name: string
  role: TableRow<'users'>['role']
  section: string
  year: number
  temporaryPassword: string
}

interface EditUserForm {
  name: string
  section: string
  year: number
}

const DEFAULT_CREATE_FORM: CreateUserForm = {
  email: '',
  name: '',
  role: 'student',
  section: '',
  year: 1,
  temporaryPassword: '',
}

export default function AdminUsersPage() {
  const { user } = useAuthStore()
  const actorIsGod = user?.role === GOD_ROLE
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'all' | TableRow<'users'>['role']>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'disabled'>('all')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState<CreateUserForm>(DEFAULT_CREATE_FORM)
  const [creatingUser, setCreatingUser] = useState(false)
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null)
  const [editForm, setEditForm] = useState<EditUserForm>({ name: '', section: '', year: 1 })
  const [savingEdit, setSavingEdit] = useState(false)
  const [isCustomSection, setIsCustomSection] = useState(false)
  type SortKey = 'name' | 'role' | 'verification' | 'section' | 'joined'
  const [sortConfig, setSortConfig] = useState<{ key: SortKey; direction: 'asc' | 'desc' } | null>(null)
  const [verifyingUserId, setVerifyingUserId] = useState<string | null>(null)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [settingVerification, setSettingVerification] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<ManagedUser | null>(null)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingUser, setDeletingUser] = useState(false)

  useEffect(() => {
    if (!user) return
    loadUsers()
  }, [user])

  const loadUsers = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select(
          'id, name, email, role, gehu_verified, gehu_email, is_banned, section, year, created_at, updated_at'
        )
        .order('created_at', { ascending: false })

      if (error) throw error

      setUsers(((data as ManagedUser[]) ?? []).map((entry) => ({
        ...entry,
        name: entry.name ?? '',
        section: entry.section ?? '',
        year: entry.year ?? 1,
      })))
    } catch (error: any) {
      console.error('Failed to load users:', error)
      toast.error(error?.message || 'Unable to load users')
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase()
    const filtered = users.filter((entry) => {
      if (roleFilter !== 'all' && entry.role !== roleFilter) return false
      if (statusFilter === 'active' && entry.is_banned) return false
      if (statusFilter === 'disabled' && !entry.is_banned) return false

      if (!query) return true
      return (
        entry.name.toLowerCase().includes(query) ||
        entry.email.toLowerCase().includes(query) ||
        entry.section.toLowerCase().includes(query)
      )
    })
    if (!sortConfig) {
      return filtered
    }

    const sorted = [...filtered].sort((first, second) => {
      const directionFactor = sortConfig.direction === 'asc' ? 1 : -1

      switch (sortConfig.key) {
        case 'name': {
          const a = (first.name || first.email || '').toLowerCase()
          const b = (second.name || second.email || '').toLowerCase()
          return a.localeCompare(b, undefined, { numeric: true }) * directionFactor
        }
        case 'role': {
          return first.role.localeCompare(second.role, undefined, { numeric: true }) * directionFactor
        }
        case 'verification': {
          const a = first.gehu_verified ? 1 : 0
          const b = second.gehu_verified ? 1 : 0
          return (a - b) * directionFactor
        }
        case 'section': {
          const a = (first.section || '').toLowerCase()
          const b = (second.section || '').toLowerCase()
          return a.localeCompare(b, undefined, { numeric: true }) * directionFactor
        }
        case 'joined': {
          const a = new Date(first.created_at).getTime()
          const b = new Date(second.created_at).getTime()
          return (a - b) * directionFactor
        }
        default:
          return 0
      }
    })

    return sorted
  }, [users, search, roleFilter, statusFilter, sortConfig])

  const sectionOptions = useMemo(() => {
    const unique = new Set<string>(PREDEFINED_SECTIONS)
    users.forEach((entry) => {
      if (entry.section) {
        unique.add(entry.section.trim().toUpperCase())
      }
    })
    return Array.from(unique).sort()
  }, [users])

  const resetCreateModal = () => {
    setCreateForm(DEFAULT_CREATE_FORM)
    setShowCreateModal(false)
    setCreatingUser(false)
  }

  const handleCreateUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!createForm.email.trim()) {
      toast.error('Email is required')
      return
    }
    if (!createForm.section.trim()) {
      toast.error('Section is required')
      return
    }

    setCreatingUser(true)
    try {
      const payload = {
        p_email: createForm.email.trim().toLowerCase(),
        p_name: createForm.name.trim() || null,
        p_role: createForm.role,
        p_section: createForm.section.trim().toUpperCase(),
        p_year: createForm.year,
        p_temporary_password: createForm.temporaryPassword.trim() || null,
      }

      const { data, error } = await supabase.rpc<ManagedUser['id']>('admin_create_user', payload as never)

      if (error) throw error

      toast.success('User created and invited successfully')
      resetCreateModal()
      await loadUsers()
      return data
    } catch (error: any) {
      console.error('Failed to create user:', error)
      toast.error(error?.message || 'Unable to create user')
    } finally {
      setCreatingUser(false)
    }
  }

  const openDeleteModal = (entry: ManagedUser) => {
    if (entry.role === GOD_ROLE && !actorIsGod) {
      toast.error('God mode accounts cannot be deleted.')
      return
    }
    if (user?.id === entry.id) {
      toast.error('You cannot delete your own account')
      return
    }
    setDeleteTarget(entry)
    setDeleteConfirmation('')
    setDeletingUser(false)
  }

  const closeDeleteModal = () => {
    setDeleteTarget(null)
    setDeleteConfirmation('')
    setDeletingUser(false)
  }

  const handleDeleteUser = async () => {
    if (!deleteTarget) return
    if (deleteTarget.role === GOD_ROLE && !actorIsGod) {
      toast.error('God mode accounts cannot be deleted.')
      return
    }
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm removal')
      return
    }

    setDeletingUser(true)
    try {
      const { error } = await supabase.rpc('admin_delete_user', { p_user_id: deleteTarget.id } as never)
      if (error) throw error
      toast.success('User removed')
      setUsers((prev) => prev.filter((entry) => entry.id !== deleteTarget.id))
      closeDeleteModal()
    } catch (error: any) {
      console.error('Failed to remove user:', error)
      toast.error(error?.message || 'Unable to remove user')
    } finally {
      setDeletingUser(false)
    }
  }

  const handleRoleChange = async (userId: string, nextRole: TableRow<'users'>['role']) => {
    const target = users.find((entry) => entry.id === userId)
    const targetIsGod = target?.role === GOD_ROLE

    if (nextRole === GOD_ROLE && !actorIsGod) {
      toast.error('God mode can only be assigned by a god account.')
      return
    }

    if (targetIsGod && !actorIsGod) {
      toast.error('God mode accounts cannot be modified.')
      return
    }

    if (user?.id === userId && nextRole !== 'super_admin') {
      toast.error('You cannot change your own role')
      return
    }

    try {
      const { error } = await supabase.rpc('admin_set_user_role', {
        p_user_id: userId,
        p_role: nextRole,
      } as never)

      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) => (entry.id === userId ? { ...entry, role: nextRole, updated_at: new Date().toISOString() } : entry))
      )
      toast.success('Role updated')
    } catch (error: any) {
      console.error('Failed to update role:', error)
      toast.error(error?.message || 'Unable to update role')
    }
  }

  const handleToggleBan = async (userId: string, shouldBan: boolean) => {
    if (!actorIsGod && users.some((entry) => entry.id === userId && entry.role === GOD_ROLE)) {
      toast.error('God mode accounts cannot be disabled.')
      return
    }

    if (user?.id === userId) {
      toast.error('You cannot disable your own account')
      return
    }

    try {
      const { error } = await supabase.rpc('admin_set_user_ban', {
        p_user_id: userId,
        p_is_banned: shouldBan,
      } as never)

      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) => (entry.id === userId ? { ...entry, is_banned: shouldBan, updated_at: new Date().toISOString() } : entry))
      )
      toast.success(shouldBan ? 'User disabled' : 'User enabled')
    } catch (error: any) {
      console.error('Failed to update user status:', error)
      toast.error(error?.message || 'Unable to update user status')
    }
  }

  const openVerificationModal = (entry: ManagedUser) => {
    if (entry.role === GOD_ROLE && !actorIsGod) {
      toast.error('God mode accounts cannot be modified.')
      return
    }
    setVerifyingUserId(entry.id)
    setVerificationEmail(entry.gehu_email ?? entry.email)
  }

  const closeVerificationModal = () => {
    setVerifyingUserId(null)
    setVerificationEmail('')
    setSettingVerification(false)
  }

  const handleVerificationChange = async (shouldVerify: boolean) => {
    if (!verifyingUserId) return

    const target = users.find((entry) => entry.id === verifyingUserId)
    if (target?.role === GOD_ROLE && !actorIsGod) {
      toast.error('God mode accounts cannot be modified.')
      return
    }

    setSettingVerification(true)
    try {
      const payload = {
        p_user_id: verifyingUserId,
        p_verified: shouldVerify,
        p_gehu_email: shouldVerify ? verificationEmail.trim().toLowerCase() || null : null,
      }

      const { error } = await supabase.rpc('admin_set_user_verification', payload as never)
      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === verifyingUserId
            ? {
                ...entry,
                gehu_verified: shouldVerify,
                gehu_email: shouldVerify ? payload.p_gehu_email : null,
                updated_at: new Date().toISOString(),
              }
            : entry
        )
      )

      toast.success(shouldVerify ? 'User verified' : 'Verification revoked')
      closeVerificationModal()
    } catch (error: any) {
      console.error('Failed to update verification:', error)
      toast.error(error?.message || 'Unable to update verification')
    } finally {
      setSettingVerification(false)
    }
  }

  const openEditModal = (entry: ManagedUser) => {
    const isGodAccount = entry.role === GOD_ROLE
    if (isGodAccount && !actorIsGod) {
      toast.error('God mode accounts cannot be modified.')
      return
    }
    const normalizedSection = (entry.section ?? '').toUpperCase()
    setEditingUser(entry)
    setEditForm({
      name: entry.name ?? '',
      section: normalizedSection,
      year: entry.year ?? 1,
    })
    const hasOptions = sectionOptions.length > 0
    const isKnownSection = normalizedSection ? sectionOptions.includes(normalizedSection) : false
    setIsCustomSection(!hasOptions || (!!normalizedSection && !isKnownSection))
  }

  const closeEditModal = () => {
    setEditingUser(null)
    setSavingEdit(false)
    setIsCustomSection(false)
  }

  const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editingUser) return
    if (editingUser.role === GOD_ROLE && !actorIsGod) {
      toast.error('God mode accounts cannot be modified.')
      return
    }

    if (!editForm.name.trim()) {
      toast.error('Name cannot be empty')
      return
    }
    if (!editForm.section.trim()) {
      toast.error('Section is required')
      return
    }

    setSavingEdit(true)
    try {
      const updates = {
        name: editForm.name.trim(),
        section: editForm.section.trim().toUpperCase(),
        year: editForm.year,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('users').update(updates as never).eq('id', editingUser.id)
      if (error) throw error

      setUsers((prev) =>
        prev.map((entry) => (entry.id === editingUser.id ? { ...entry, ...updates } : entry))
      )
      toast.success('Profile updated')
      closeEditModal()
    } catch (error: any) {
      console.error('Failed to update user:', error)
      toast.error(error?.message || 'Unable to update user')
    } finally {
      setSavingEdit(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadUsers()
    setRefreshing(false)
  }

  const toggleSort = (key: SortKey) => {
    setSortConfig((previous) => {
      if (previous?.key === key) {
        const nextDirection = previous.direction === 'asc' ? 'desc' : 'asc'
        return { key, direction: nextDirection }
      }
      return { key, direction: 'asc' }
    })
  }

  const getSortIcon = (key: SortKey) => {
    if (sortConfig?.key !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5" />
    }
    return sortConfig.direction === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5" />
    )
  }

  const deleteConfirmed = deleteConfirmation.trim().toUpperCase() === 'DELETE'

  if (!user) {
    return null
  }

  const isSuperAdmin = user.role === 'super_admin' || user.role === GOD_ROLE

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">You need super admin permissions to manage users.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Administration</p>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>User management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Add, verify, suspend, or update roles for members across the platform.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition"
            style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
            disabled={refreshing || loading}
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Refresh
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add user
          </button>
        </div>
      </div>

      <div className="card space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, or section"
              className="input-field w-full pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <FilterPill
              label="Role"
              value={roleFilter}
              options={[{ value: 'all', label: 'All roles' }, ...ROLE_FILTER_OPTIONS.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))]}
              onChange={(value) => setRoleFilter(value as typeof roleFilter)}
            />
            <FilterPill
              label="Status"
              value={statusFilter}
              options={[
                { value: 'all', label: 'All statuses' },
                { value: 'active', label: 'Active' },
                { value: 'disabled', label: 'Disabled' },
              ]}
              onChange={(value) => setStatusFilter(value as typeof statusFilter)}
            />
          </div>
        </div>

        {/* Scrollable table container for mobile */}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center px-6 py-16 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm text-slate-500">
              No users match your filters.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-50 px-4 py-2 min-w-[180px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('name')}
                      className="flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-800"
                    >
                      User
                      {getSortIcon('name')}
                    </button>
                  </th>
                  <th className="px-4 py-2 min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('role')}
                      className="flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-800"
                    >
                      Role
                      {getSortIcon('role')}
                    </button>
                  </th>
                  <th className="px-4 py-2 min-w-[120px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('verification')}
                      className="flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-800"
                    >
                      Verification
                      {getSortIcon('verification')}
                    </button>
                  </th>
                  <th className="px-4 py-2 min-w-[120px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('section')}
                      className="flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-800"
                    >
                      Section
                      {getSortIcon('section')}
                    </button>
                  </th>
                  <th className="px-4 py-2 min-w-[100px]">
                    <button
                      type="button"
                      onClick={() => toggleSort('joined')}
                      className="flex items-center gap-1 font-semibold text-slate-600 transition hover:text-slate-800"
                    >
                      Joined
                      {getSortIcon('joined')}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-right min-w-[180px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredUsers.map((entry) => {
                  const joinedAt = new Date(entry.created_at)
                  const joinedLabel = joinedAt.toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })
                  const isDisabled = entry.is_banned
                  const isGod = entry.role === GOD_ROLE
                  const isProtectedGod = isGod && !actorIsGod

                  return (
                    <tr key={entry.id} className="hover:bg-slate-50">
                      <td className="sticky left-0 z-10 bg-white px-4 py-3 min-w-[180px]">
                        <div className="font-medium text-slate-800">{entry.name || 'Unnamed user'}</div>
                        <div className="text-xs text-slate-500">{entry.email}</div>
                      </td>
                      <td className="px-4 py-3 min-w-[100px]">
                        {isGod ? (
                          <span className="inline-flex items-center rounded-lg border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-purple-700">
                            GOD MODE
                          </span>
                        ) : (
                          <div className="relative inline-flex items-center">
                            <select
                              value={entry.role}
                              onChange={(event) => handleRoleChange(entry.id, event.target.value as ManagedUser['role'])}
                              className="appearance-none rounded-lg border border-slate-200 bg-white py-1 pl-3 pr-8 text-sm font-medium capitalize text-slate-700 shadow-sm focus:border-primary-300 focus:outline-none"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role} value={role} className="capitalize">
                                  {role.replace(/_/g, ' ')}
                                </option>
                              ))}
                            </select>
                            <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 text-slate-400" />
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {entry.gehu_verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
                            <CheckCircle2 className="h-3 w-3" /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                            <Shield className="h-3 w-3" /> Pending
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                          {entry.section || '—'} · Year {entry.year || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-sm">{joinedLabel}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openEditModal(entry)}
                            className="table-action-button"
                            data-variant="muted"
                            title={isProtectedGod ? 'God mode accounts cannot be edited' : 'Edit profile'}
                            disabled={isProtectedGod}
                            aria-label={`Edit ${entry.name || entry.email}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openVerificationModal(entry)}
                            className="table-action-button"
                            data-variant={entry.gehu_verified ? 'danger' : 'success'}
                            title={isProtectedGod ? 'God mode accounts cannot be modified' : entry.gehu_verified ? 'Revoke verification' : 'Verify user'}
                            disabled={isProtectedGod}
                            aria-label={entry.gehu_verified ? `Revoke verification for ${entry.name || entry.email}` : `Verify ${entry.name || entry.email}`}
                          >
                            <ShieldCheck className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleBan(entry.id, !isDisabled)}
                            className="table-action-button"
                            data-variant={isDisabled ? 'success' : 'warning'}
                            title={isProtectedGod ? 'God mode accounts cannot be disabled' : isDisabled ? 'Enable user' : 'Disable user'}
                            disabled={isProtectedGod}
                            aria-label={isDisabled ? `Enable ${entry.name || entry.email}` : `Disable ${entry.name || entry.email}`}
                          >
                            {isDisabled ? <CheckCircle2 className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => openDeleteModal(entry)}
                            className="table-action-button"
                            data-variant="danger"
                            title={isProtectedGod ? 'God mode accounts cannot be removed' : 'Delete user'}
                            disabled={isProtectedGod}
                            aria-label={`Delete ${entry.name || entry.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          </div>
        </div>
      </div>

      {showCreateModal && (
        <Modal title="Add new user" onClose={resetCreateModal}>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Name
              </label>
              <input
                value={createForm.name}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, name: event.target.value }))}
                placeholder="Full name"
                className="input-field mt-1"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Email
              </label>
              <input
                value={createForm.email}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="student@example.edu"
                className="input-field mt-1"
                required
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Section
                </label>
                <input
                  value={createForm.section}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, section: event.target.value }))}
                  placeholder="A1"
                  className="input-field mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                  Year
                </label>
                <input
                  type="number"
                  min={1}
                  max={4}
                  value={createForm.year}
                  onChange={(event) =>
                    setCreateForm((prev) => ({ ...prev, year: Number(event.target.value) || 1 }))
                  }
                  className="input-field mt-1"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Role
              </label>
              <select
                value={createForm.role}
                onChange={(event) => setCreateForm((prev) => ({ ...prev, role: event.target.value as ManagedUser['role'] }))}
                className="input-field mt-1 appearance-none"
                style={{
                  backgroundImage:
                    "url('data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'none\\' viewBox=\\'0 0 20 20\\'%3E%3Cpath stroke=\\'%23ffffff\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M6 8l4 4 4-4\\'%3E%3C/path%3E%3C/svg%3E')",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '1.1rem'
                }}
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Temporary password
              </label>
              <input
                value={createForm.temporaryPassword}
                onChange={(event) =>
                  setCreateForm((prev) => ({ ...prev, temporaryPassword: event.target.value }))
                }
                placeholder="Leave blank to auto-generate"
                className="input-field mt-1"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={resetCreateModal}
                className="btn-secondary"
                disabled={creatingUser}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary inline-flex items-center gap-2"
                disabled={creatingUser}
              >
                {creatingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create user
              </button>
            </div>
          </form>
        </Modal>
      )}

      {editingUser && (
        <Modal title="Edit user details" onClose={closeEditModal}>
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Name
              </label>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                className="input-field mt-1"
                required
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Section
              </label>
              <select
                value={
                  isCustomSection
                    ? '__custom__'
                    : editForm.section
                      ? editForm.section
                      : '__placeholder__'
                }
                onChange={(event) => {
                  const value = event.target.value
                  if (value === '__placeholder__') {
                    return
                  }
                  if (value === '__custom__') {
                    setIsCustomSection(true)
                    setEditForm((prev) => ({ ...prev, section: '' }))
                    return
                  }
                  setIsCustomSection(false)
                  setEditForm((prev) => ({ ...prev, section: value.toUpperCase() }))
                }}
                className="input-field mt-1 appearance-none"
                style={{
                  backgroundImage:
                    "url('data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' fill=\\'none\\' viewBox=\\'0 0 20 20\\'%3E%3Cpath stroke=\\'%23ffffff\\' stroke-linecap=\\'round\\' stroke-linejoin=\\'round\\' stroke-width=\\'1.5\\' d=\\'M6 8l4 4 4-4\\'%3E%3C/path%3E%3C/svg%3E')",
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 0.85rem center',
                  backgroundSize: '1.1rem'
                }}
              >
                <option value="__placeholder__" disabled>
                  Select section
                </option>
                {sectionOptions.map((section) => (
                  <option key={section} value={section}>
                    {section}
                  </option>
                ))}
                <option value="__custom__">Other...</option>
              </select>
              {isCustomSection && (
                <input
                  value={editForm.section}
                  onChange={(event) =>
                    setEditForm((prev) => ({ ...prev, section: event.target.value.toUpperCase() }))
                  }
                  placeholder="Type a new section"
                  className="input-field mt-3"
                  required
                />
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Year
              </label>
              <input
                type="number"
                min={1}
                max={4}
                value={editForm.year}
                onChange={(event) => setEditForm((prev) => ({ ...prev, year: Number(event.target.value) || 1 }))}
                className="input-field mt-1"
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={closeEditModal}
                className="btn-secondary"
                disabled={savingEdit}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn-primary inline-flex items-center gap-2"
                disabled={savingEdit}
              >
                {savingEdit ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Save changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {deleteTarget && (
        <Modal title="Delete user" onClose={closeDeleteModal}>
          <div className="space-y-5">
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
              <p className="text-sm font-semibold" style={{ color: 'rgba(254, 202, 202, 0.92)' }}>This action is permanent.</p>
              <p className="mt-1 text-xs" style={{ color: 'rgba(254, 202, 202, 0.75)' }}>
                Deleting
                {' '}
                <span className="font-semibold text-red-100">{deleteTarget.name || deleteTarget.email}</span>
                {' '}
                removes their access immediately. This cannot be undone.
              </p>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                Type DELETE to confirm
              </label>
              <input
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                placeholder="DELETE"
                className="input-field mt-1"
                autoFocus
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeDeleteModal}
                className="btn-secondary"
                disabled={deletingUser}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUser}
                className="btn-secondary inline-flex items-center gap-2"
                style={{
                  background: 'linear-gradient(135deg, rgba(248,113,113,0.92), rgba(220,38,38,0.95))',
                  borderColor: 'rgba(248,113,113,0.55)',
                  color: '#fff',
                }}
                disabled={deletingUser || !deleteConfirmed}
              >
                {deletingUser ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Delete user
              </button>
            </div>
          </div>
        </Modal>
      )}

      {verifyingUserId && (
        <Modal title="Adjust verification" onClose={closeVerificationModal}>
          <div className="space-y-4">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Set the GEHU email this user verified with or revoke their verification flag.
            </p>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>
                GEHU email
              </label>
              <input
                value={verificationEmail}
                onChange={(event) => setVerificationEmail(event.target.value)}
                placeholder="name@gehu.ac.in"
                className="input-field mt-1"
              />
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handleVerificationChange(false)}
                className="btn-secondary"
                style={{
                  backgroundColor: 'rgba(234, 179, 8, 0.12)',
                  borderColor: 'rgba(234, 179, 8, 0.35)',
                  color: 'rgba(234, 179, 8, 0.95)'
                }}
                disabled={settingVerification}
              >
                Revoke
              </button>
              <button
                onClick={() => handleVerificationChange(true)}
                className="btn-primary inline-flex items-center gap-2"
                disabled={settingVerification}
              >
                {settingVerification ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Mark verified
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

interface FilterPillProps {
  label: string
  value: string
  options: Array<{ value: string; label: string }>
  onChange: (value: string) => void
}

function FilterPill({ label, value, options, onChange }: FilterPillProps) {
  return (
    <label className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
      <span>{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="bg-transparent text-sm font-medium text-slate-700 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: 'rgba(5, 5, 5, 0.72)',
        backdropFilter: 'blur(18px)',
      }}
    >
      <div
        className="w-full max-w-lg rounded-3xl border p-6 shadow-2xl"
        style={{
          background: 'rgba(20, 20, 20, 0.94)',
          borderColor: 'rgba(230, 126, 34, 0.22)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Administrative action</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-slate-300 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgba(230,126,34,0.45)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  )
}
