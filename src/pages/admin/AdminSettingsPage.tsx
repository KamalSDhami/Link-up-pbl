import { ChangeEvent, useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { Loader2, RotateCcw, Save } from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableInsert, TableRow } from '@/types/database'

type SystemSettingRow = TableRow<'system_settings'>
type SystemSettingInsert = TableInsert<'system_settings'>

type SettingType = 'boolean' | 'string' | 'number'

type SettingDefinition = {
  key: string
  label: string
  category: string
  description?: string
  helper?: string
  type: SettingType
  defaultValue: boolean | string | number
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

type SettingValue = string | boolean

type SettingMeta = {
  updated_at: string | null
  updated_by: string | null
}

const SETTING_DEFINITIONS: SettingDefinition[] = [
  {
    key: 'platform.maintenance_mode',
    label: 'Enable maintenance mode',
    category: 'Platform availability',
    type: 'boolean',
    defaultValue: false,
    description:
      'Temporarily disable non-essential features for students while administrators perform maintenance tasks.',
  },
  {
    key: 'platform.support_email',
    label: 'Support contact email',
    category: 'Platform availability',
    type: 'string',
    defaultValue: 'support@linkup.app',
    placeholder: 'support@campus.edu',
    description: 'Visible in help dialogs and footer content for escalation purposes.',
  },
  {
    key: 'teams.max_teams_per_student',
    label: 'Team membership limit per student',
    category: 'Teams & recruitment',
    type: 'number',
    defaultValue: 2,
    min: 1,
    max: 5,
    step: 1,
    description: 'Restrict how many active teams a student can join simultaneously.',
  },
  {
    key: 'teams.require_verified_profile',
    label: 'Require verified GEHU email for team creation',
    category: 'Teams & recruitment',
    type: 'boolean',
    defaultValue: true,
    description: 'Only allow verified campus accounts to create or manage teams.',
  },
  {
    key: 'teams.auto_archive_recruitment_days',
    label: 'Auto-archive recruitment posts (days)',
    category: 'Teams & recruitment',
    type: 'number',
    defaultValue: 14,
    min: 1,
    max: 60,
    step: 1,
    description: 'Automatically close recruitment posts after the specified number of days.',
  },
  {
    key: 'messaging.allow_group_dm_creation',
    label: 'Allow students to create group chats',
    category: 'Messaging & collaboration',
    type: 'boolean',
    defaultValue: true,
    description: 'If disabled, only staff can provision new group conversations.',
  },
  {
    key: 'messaging.reactions_enabled',
    label: 'Enable message reactions',
    category: 'Messaging & collaboration',
    type: 'boolean',
    defaultValue: true,
    description: 'Allow emoji reactions on chat messages.',
  },
  {
    key: 'security.require_two_factor_for_staff',
    label: 'Enforce two-factor authentication for staff',
    category: 'Security & moderation',
    type: 'boolean',
    defaultValue: false,
    description: 'When enabled, moderators and event managers will be prompted to configure 2FA at sign-in.',
  },
  {
    key: 'security.pending_report_threshold',
    label: 'Pending moderation report threshold',
    category: 'Security & moderation',
    type: 'number',
    defaultValue: 10,
    min: 1,
    max: 100,
    step: 1,
    description: 'Number of unresolved message reports that triggers an escalation banner for staff.',
  },
  {
    key: 'security.session_idle_timeout_minutes',
    label: 'Admin session idle timeout (minutes)',
    category: 'Security & moderation',
    type: 'number',
    defaultValue: 30,
    min: 5,
    max: 180,
    step: 5,
    description: 'Automatically sign out inactive admin sessions after this many minutes.',
  },
]

const definitionByKey = new Map(SETTING_DEFINITIONS.map((definition) => [definition.key, definition]))

const formatTimestamp = (iso: string | null) => {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

const coerceInitialValue = (definition: SettingDefinition, rowValue: SystemSettingRow['value'] | undefined): SettingValue => {
  const fallback = definition.defaultValue

  if (definition.type === 'boolean') {
    if (typeof rowValue === 'boolean') return rowValue
    if (typeof rowValue === 'string') return rowValue === 'true' || rowValue === '1'
    if (typeof rowValue === 'number') return rowValue === 1
    return Boolean(fallback)
  }

  if (definition.type === 'number') {
    if (typeof rowValue === 'number') return String(rowValue)
    if (typeof rowValue === 'string' && rowValue.trim() !== '') return rowValue
    return String(fallback)
  }

  if (typeof rowValue === 'string') {
    return rowValue
  }

  if (typeof rowValue === 'number') {
    return String(rowValue)
  }

  return typeof fallback === 'string' ? fallback : ''
}

const normalizeForPersist = (definition: SettingDefinition, rawValue: SettingValue): SystemSettingRow['value'] => {
  if (definition.type === 'boolean') {
    return Boolean(rawValue)
  }

  if (definition.type === 'number') {
    const parsed = Number(typeof rawValue === 'string' ? rawValue.trim() : rawValue)
    const { min, max, defaultValue } = definition

    if (!Number.isFinite(parsed)) {
      return Number(defaultValue)
    }

    let clamped = parsed
    if (typeof min === 'number') {
      clamped = Math.max(min, clamped)
    }
    if (typeof max === 'number') {
      clamped = Math.min(max, clamped)
    }

    return Math.round(clamped)
  }

  if (typeof rawValue === 'string') {
    return rawValue.trim()
  }

  return rawValue ?? ''
}

const AdminSettingsPage = () => {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [values, setValues] = useState<Record<string, SettingValue>>({})
  const [initialValues, setInitialValues] = useState<Record<string, SettingValue>>({})
  const [metadata, setMetadata] = useState<Record<string, SettingMeta>>({})

  const isSuperAdmin = user?.role === 'super_admin' || user?.role === 'god'

  const dirtyKeys = useMemo(() => {
    return SETTING_DEFINITIONS.map((definition) => definition.key).filter((key) => {
      const current = values[key]
      const initial = initialValues[key]

      if (typeof current === 'boolean' || typeof initial === 'boolean') {
        return current !== initial
      }

      return String(current ?? '') !== String(initial ?? '')
    })
  }, [values, initialValues])

  const groupedDefinitions = useMemo(() => {
    return SETTING_DEFINITIONS.reduce<Record<string, SettingDefinition[]>>((accumulator, definition) => {
      if (!accumulator[definition.category]) {
        accumulator[definition.category] = []
      }
      accumulator[definition.category].push(definition)
      return accumulator
    }, {})
  }, [])

  useEffect(() => {
    if (!isSuperAdmin) return

    const loadSettings = async () => {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('system_settings')
          .select('key, value, updated_at, updated_by')

        if (error) {
          throw error
        }

        const rows = (data ?? []) as SystemSettingRow[]
        const rowMap = new Map(rows.map((row) => [row.key, row]))

        const nextValues: Record<string, SettingValue> = {}
        const nextInitial: Record<string, SettingValue> = {}
        const nextMeta: Record<string, SettingMeta> = {}

        SETTING_DEFINITIONS.forEach((definition) => {
          const row = rowMap.get(definition.key)
          const coerced = coerceInitialValue(definition, row?.value)
          nextValues[definition.key] = coerced
          nextInitial[definition.key] = coerced
          nextMeta[definition.key] = {
            updated_at: row?.updated_at ?? null,
            updated_by: row?.updated_by ?? null,
          }
        })

        setValues(nextValues)
        setInitialValues(nextInitial)
        setMetadata(nextMeta)
      } catch (error: any) {
        console.error('Failed to load system settings:', error)
        toast.error(error?.message || 'Unable to load system settings')
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [isSuperAdmin])

  const handleBooleanToggle = (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.checked
    setValues((previous) => ({ ...previous, [key]: nextValue }))
  }

  const handleInputChange = (key: string) => (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value
    setValues((previous) => ({ ...previous, [key]: nextValue }))
  }

  const handleReset = () => {
    setValues((previous) => {
      const next: Record<string, SettingValue> = {}
      Object.keys(previous).forEach((key) => {
        next[key] = initialValues[key]
      })
      return next
    })
  }

  const handleSave = async () => {
    if (!user || !dirtyKeys.length) return

    setSaving(true)
    try {
      const nowIso = new Date().toISOString()

      const payload = dirtyKeys.map<SystemSettingInsert>((key) => {
        const definition = definitionByKey.get(key)
        if (!definition) {
          throw new Error(`Unknown setting: ${key}`)
        }

        const currentValue = values[key]
        const normalizedValue = normalizeForPersist(definition, currentValue)

        return {
          key,
          value: normalizedValue,
          category: definition.category,
          description: definition.description ?? null,
          updated_at: nowIso,
          updated_by: user.id,
        }
      })

      const { error } = await supabase.from('system_settings').upsert(payload as never, {
        onConflict: 'key',
      })

      if (error) {
        throw error
      }

      const nextInitial: Record<string, SettingValue> = {}
      dirtyKeys.forEach((key) => {
        nextInitial[key] = values[key]
      })

      setInitialValues((previous) => ({ ...previous, ...nextInitial }))
      setMetadata((previous) => {
        const next = { ...previous }
        dirtyKeys.forEach((key) => {
          next[key] = {
            updated_at: nowIso,
            updated_by: user.id,
          }
        })
        return next
      })

      toast.success('Settings updated successfully')
    } catch (error: any) {
      console.error('Failed to save system settings:', error)
      toast.error(error?.message || 'Unable to save settings')
    } finally {
      setSaving(false)
    }
  }

  if (!user) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Administrator access required</h1>
        <p className="text-slate-600">Sign in with your admin account to configure system settings.</p>
      </div>
    )
  }

  if (!isSuperAdmin) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 py-16 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">Only super administrators can manage platform-wide system settings.</p>
      </div>
    )
  }

  const isDirty = dirtyKeys.length > 0

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900">System settings</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Fine-tune availability, team creation policies, messaging capabilities, and safety guardrails.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Reset changes
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save settings
          </button>
        </div>
      </header>

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-48 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {Object.entries(groupedDefinitions).map(([category, definitions]) => (
            <section key={category} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <header className="mb-4">
                <h2 className="text-lg font-semibold text-slate-900">{category}</h2>
                <p className="text-sm text-slate-500">
                  {definitions.length} setting{definitions.length === 1 ? '' : 's'} in this section.
                </p>
              </header>

              <div className="space-y-6">
                {definitions.map((definition) => {
                  const currentValue = values[definition.key]
                  const meta = metadata[definition.key]
                  const lastUpdated = formatTimestamp(meta?.updated_at ?? null)

                  return (
                    <article key={definition.key} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-sm font-semibold text-slate-900">{definition.label}</span>
                            {definition.type === 'boolean' ? (
                              <label className="relative inline-flex cursor-pointer items-center">
                                <input
                                  type="checkbox"
                                  className="peer sr-only"
                                  checked={Boolean(currentValue)}
                                  onChange={handleBooleanToggle(definition.key)}
                                />
                                <span className="block h-5 w-10 rounded-full bg-slate-300 transition peer-checked:bg-primary-600"></span>
                                <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white transition peer-checked:translate-x-5" />
                              </label>
                            ) : null}
                          </div>
                          {definition.description ? (
                            <p className="text-xs text-slate-600">{definition.description}</p>
                          ) : null}
                          {definition.helper ? (
                            <p className="text-xs text-slate-500">{definition.helper}</p>
                          ) : null}
                        </div>

                        {definition.type !== 'boolean' ? (
                          <div>
                            <input
                              type={definition.type === 'number' ? 'number' : 'text'}
                              min={definition.min}
                              max={definition.max}
                              step={definition.step}
                              value={typeof currentValue === 'string' ? currentValue : ''}
                              onChange={handleInputChange(definition.key)}
                              placeholder={definition.placeholder}
                              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
                            />
                          </div>
                        ) : null}

                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span className="font-mono text-[11px] text-slate-500">{definition.key}</span>
                          {lastUpdated ? (
                            <span>
                              Updated {lastUpdated}
                              {meta?.updated_by ? ` · by ${meta.updated_by.slice(0, 8)}` : ''}
                            </span>
                          ) : (
                            <span>Not updated yet</span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export default AdminSettingsPage
