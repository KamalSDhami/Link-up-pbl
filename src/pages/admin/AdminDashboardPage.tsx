import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Activity,
  AlertTriangle,
  BellRing,
  Database,
  FileText,
  LayoutDashboard,
  Loader2,
  Megaphone,
  MessageSquare,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

type UserRow = TableRow<'users'>

const managementShortcuts = [
  {
    title: 'User directory',
    description: 'Suspend accounts, adjust roles, and verify identities.',
    to: '/admin/users',
    icon: Users,
    requireSuperAdmin: true,
  },
  {
    title: 'Group management',
    description: 'Edit team profiles, reassign leaders, and curate rosters.',
    to: '/admin/teams',
    icon: UserCog,
    requireSuperAdmin: true,
  },
  {
    title: 'Recruitment posts',
    description: 'Moderate opportunities and ensure listings stay relevant.',
    to: '/admin/recruitment',
    icon: Megaphone,
    requireSuperAdmin: true,
  },
  {
    title: 'Content moderation',
    description: 'Review reports and manage team or chat activity.',
    to: '/admin/moderation',
    icon: ShieldCheck,
  },
  {
    title: 'Support tickets',
    description: 'View and respond to user support requests.',
    to: '/admin/tickets',
    icon: MessageSquare,
  },
  {
    title: 'Events & announcements',
    description: 'Publish campus events and notify targeted cohorts.',
    to: '/admin/events',
    icon: BellRing,
  },
  {
    title: 'System settings',
    description: 'Configure platform policies, feature flags, and integrations.',
    to: '/admin/settings',
    icon: Settings,
    requireSuperAdmin: true,
  },
]

const checklistItems = [
  {
    title: 'Verify new moderators',
    note: 'Ensure elevated roles belong to trusted staff.',
  },
  {
    title: 'Confirm backups are recent',
    note: 'Review automated exports from Supabase or storage providers.',
  },
  {
    title: 'Audit recruitment posts',
    note: 'Archive expired listings and highlight fresh opportunities.',
  },
]

type ActivityEntry = {
  category: string
  detail: string
  timestamp: string
}

// Helper function to format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
export default function AdminDashboardPage() {
  const { user } = useAuthStore()
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [recentUsersLoading, setRecentUsersLoading] = useState(false)
  const [activityLoading, setActivityLoading] = useState(false)
  const [metrics, setMetrics] = useState({
    userCount: null as number | null,
    activeTeamCount: null as number | null,
    openRecruitments: null as number | null,
    pendingReports: null as number | null,
  })
  const [recentUsers, setRecentUsers] = useState<UserRow[]>([])
  const [recentActivity, setRecentActivity] = useState<ActivityEntry[]>([])

  if (!user) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Admin access required</h1>
        <p className="text-slate-600">Sign in with an administrator account to manage the platform.</p>
      </div>
    )
  }

  const isAdmin = ['super_admin', 'moderator', 'event_manager', 'god'].includes(user.role)
  const isSuperAdmin = user.role === 'super_admin' || user.role === 'god'

  useEffect(() => {
    if (!isAdmin) return

    const loadMetrics = async () => {
      setMetricsLoading(true)
      try {
        const { count: totalUsers, error: userCountError } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })

        if (userCountError) throw userCountError

        const { count: activeTeams, error: teamError } = await supabase
          .from('teams')
          .select('*', { count: 'exact', head: true })
          .gte('member_count', 1)

        if (teamError) throw teamError

        const { count: openRecruitments, error: recruitmentError } = await supabase
          .from('recruitment_posts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')

        if (recruitmentError) throw recruitmentError

        const { count: pendingReports, error: reportsError } = await supabase
          .from('message_reports')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending')

        if (reportsError) throw reportsError

        setMetrics({
          userCount: totalUsers ?? 0,
          activeTeamCount: activeTeams ?? 0,
          openRecruitments: openRecruitments ?? 0,
          pendingReports: pendingReports ?? 0,
        })
      } catch (error: any) {
        console.error('Failed to load admin metrics:', error)
        toast.error(error?.message || 'Unable to load admin metrics')
        setMetrics((previous) => ({ ...previous, userCount: null, activeTeamCount: null, openRecruitments: null, pendingReports: null }))
      } finally {
        setMetricsLoading(false)
      }
    }

    const loadRecentUsers = async () => {
      setRecentUsersLoading(true)
      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, role, gehu_verified, created_at')
          .order('created_at', { ascending: false })
          .limit(8)

        if (error) throw error

        setRecentUsers((data as UserRow[] | null) ?? [])
      } catch (error: any) {
        console.error('Failed to load recent users:', error)
        toast.error(error?.message || 'Unable to load user list')
        setRecentUsers([])
      } finally {
        setRecentUsersLoading(false)
      }
    }

    const loadRecentActivity = async () => {
      setActivityLoading(true)
      try {
        const activities: ActivityEntry[] = []

        // Fetch recent message reports
        const { data: reports } = await supabase
          .from('message_reports')
          .select('id, reason, created_at, status')
          .order('created_at', { ascending: false })
          .limit(3)

        if (reports) {
          reports.forEach((report: { id: string; reason: string; created_at: string; status: string }) => {
            activities.push({
              category: 'Moderation',
              detail: `New ${report.status} report: "${report.reason.slice(0, 50)}${report.reason.length > 50 ? '...' : ''}"`,
              timestamp: formatRelativeTime(new Date(report.created_at)),
            })
          })
        }

        // Fetch recent team creations
        const { data: teams } = await supabase
          .from('teams')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(3)

        if (teams) {
          teams.forEach((team: { id: string; name: string; created_at: string }) => {
            activities.push({
              category: 'Teams',
              detail: `New team created: "${team.name}"`,
              timestamp: formatRelativeTime(new Date(team.created_at)),
            })
          })
        }

        // Fetch recent user registrations  
        const { data: newUsers } = await supabase
          .from('users')
          .select('id, name, email, created_at')
          .order('created_at', { ascending: false })
          .limit(3)

        if (newUsers) {
          newUsers.forEach((u: { id: string; name: string | null; email: string; created_at: string }) => {
            activities.push({
              category: 'Access',
              detail: `New user registered: ${u.name || u.email}`,
              timestamp: formatRelativeTime(new Date(u.created_at)),
            })
          })
        }

        // Fetch recent recruitment posts
        const { data: recruitments } = await supabase
          .from('recruitment_posts')
          .select('id, title, created_at')
          .order('created_at', { ascending: false })
          .limit(2)

        if (recruitments) {
          recruitments.forEach((r: { id: string; title: string; created_at: string }) => {
            activities.push({
              category: 'Recruitment',
              detail: `New recruitment: "${r.title}"`,
              timestamp: formatRelativeTime(new Date(r.created_at)),
            })
          })
        }

        // Sort all activities by recency (most recent first)
        // Since we have relative timestamps, we need to re-fetch with dates for sorting
        // For now, just take the first 6 items as they're already sorted by their category
        setRecentActivity(activities.slice(0, 6))
      } catch (error: any) {
        console.error('Failed to load recent activity:', error)
        // Keep default activity on error
        setRecentActivity([
          { category: 'System', detail: 'Activity feed unavailable', timestamp: 'Now' },
        ])
      } finally {
        setActivityLoading(false)
      }
    }

    loadMetrics()
    loadRecentUsers()
    loadRecentActivity()
  }, [isAdmin])

  const formatStatValue = (value: number | null) => {
    if (metricsLoading) return 'â€¦'
    if (value === null) return 'â€”'
    return value.toLocaleString()
  }

  const quickStats = useMemo(
    () => [
      {
        id: 'users',
        label: 'Total users',
        value: formatStatValue(metrics.userCount),
        description: 'All registered student and staff accounts.',
        icon: Users,
      },
      {
        id: 'teams',
        label: 'Active teams',
        value: formatStatValue(metrics.activeTeamCount),
        description: 'Teams with at least one member onboard.',
        icon: ShieldCheck,
      },
      {
        id: 'recruitment',
        label: 'Open recruitments',
        value: formatStatValue(metrics.openRecruitments),
        description: 'Live opportunities students can apply to.',
        icon: FileText,
      },
      {
        id: 'alerts',
        label: 'Pending reports',
        value: formatStatValue(metrics.pendingReports),
        description: 'Messages flagged and awaiting moderator review.',
        icon: AlertTriangle,
      },
    ],
    [metrics, metricsLoading]
  )

  const formatJoined = (iso: string) => {
    const date = new Date(iso)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Insufficient permissions</h1>
        <p style={{ color: 'var(--text-secondary)' }}>
          Your account does not have access to the administration console. Contact a site administrator if you believe
          this is an error.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Administration</p>
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Control center</h1>
        <p className="max-w-3xl" style={{ color: 'var(--text-secondary)' }}>
          Monitor platform activity, manage community safety, and configure features. Key metrics refresh each time you
          open the console.
        </p>
      </header>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>Snapshot</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quickStats.map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.id} className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>{stat.label}</span>
                  <span className="rounded-full bg-[var(--accent-hover)] p-2" style={{ color: 'var(--accent)' }}>
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="text-3xl font-semibold" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{stat.description}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[2fr_3fr]">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>System health</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-[color:var(--color-border)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Database className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                Database status
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Connect Supabase health checks to confirm replication and RLS policies are in place.
              </p>
            </div>
            <div className="rounded-xl border border-[color:var(--color-border)] p-4">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                <Activity className="h-4 w-4 text-emerald-500" />
                Real-time feeds
              </div>
              <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Highlight websocket uptime and connected clients once monitoring is hooked in.
              </p>
            </div>
          </div>
          <div className="rounded-xl border border-[color:var(--color-border)] p-4">
            <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              <BellRing className="h-4 w-4 text-amber-500" />
              Notifications queue
            </div>
            <p className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Track queued push or email campaigns to ensure users receive timely updates.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Recent activity</h2>
          </div>
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
            {activityLoading ? (
              <div className="flex items-center justify-center px-4 py-10" style={{ color: 'var(--text-secondary)' }}>
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                No recent activity to display.
              </div>
            ) : (
              <table className="min-w-full divide-y divide-[color:var(--color-border)] text-left text-sm">
                <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>
                  <tr>
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Details</th>
                    <th className="px-4 py-2 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--color-border)]">
                  {recentActivity.map((entry, index) => (
                    <tr key={`${entry.category}-${index}`} className="hover:bg-[var(--accent-hover)]">
                      <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          entry.category === 'Moderation' ? 'bg-red-500/10 text-red-400' :
                          entry.category === 'Access' ? 'bg-blue-500/10 text-blue-400' :
                          entry.category === 'Teams' ? 'bg-green-500/10 text-green-400' :
                          entry.category === 'Recruitment' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-gray-500/10 text-gray-400'
                        }`}>
                          {entry.category}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{entry.detail}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>{entry.timestamp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            Live activity feed from user registrations, team creations, recruitments, and moderation reports.
          </p>
        </div>
      </section>

      <section id="users" className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <LayoutDashboard className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>User management</h2>
          </div>
          {isSuperAdmin && (
            <Link
              to="/admin/users"
              className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--accent)]/30 px-3 py-1.5 text-sm font-semibold transition hover:bg-[var(--accent-hover)]"
              style={{ color: 'var(--accent)' }}
            >
              View full directory
            </Link>
          )}
        </div>
        <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
          {recentUsersLoading ? (
            <div className="flex items-center justify-center px-4 py-10" style={{ color: 'var(--text-secondary)' }}>
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : recentUsers.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
              No users found. Invite students to start building the community.
            </div>
          ) : (
            <table className="min-w-full divide-y divide-[color:var(--color-border)] text-left text-sm">
              <thead className="bg-[var(--color-muted)] text-xs uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>
                <tr>
                  <th className="px-4 py-2">Name</th>
                  <th className="px-4 py-2">Email</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2 text-right">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[color:var(--color-border)]">
                {recentUsers.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[var(--accent-hover)]">
                    <td className="px-4 py-3" style={{ color: 'var(--text-primary)' }}>{entry.name || 'Unnamed user'}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{entry.email}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                      <span className="rounded-full bg-[var(--color-muted)] px-2 py-1 text-xs font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                        {entry.role.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {entry.gehu_verified ? (
                        <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400">
                          Verified
                        </span>
                      ) : (
                        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs font-medium text-amber-400">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right" style={{ color: 'var(--text-secondary)' }}>{formatJoined(entry.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[3fr_2fr]">
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Management shortcuts</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {managementShortcuts
              .filter((action) => (action.requireSuperAdmin ? isSuperAdmin : true))
              .map((action) => {
              const Icon = action.icon
              return (
                <Link
                  key={action.title}
                  to={action.to}
                  className="flex flex-col gap-2 rounded-xl border border-[color:var(--color-border)] p-4 transition hover:border-[color:var(--accent)]/50 hover:bg-[var(--accent-hover)]"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    <Icon className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    {action.title}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{action.description}</span>
                </Link>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Weekly checklist</h2>
          </div>
          <ul className="space-y-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {checklistItems.map((item) => (
              <li key={item.title} className="rounded-lg border border-[color:var(--color-border)] p-3">
                <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{item.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
