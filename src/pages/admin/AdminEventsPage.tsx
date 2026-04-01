import { AlertCircle, CalendarClock, Sparkles, Clock3 } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'

export default function AdminEventsPage() {
  const { user } = useAuthStore()
  const isEventManager = user && ['event_manager', 'super_admin', 'god'].includes(user.role)

  if (!isEventManager) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 py-20 text-center">
        <AlertCircle className="h-12 w-12" style={{ color: 'var(--accent)' }} />
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>
          Restricted area
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Event management tools are available to event managers and platform administrators.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
          Admin Panel
        </p>
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Event Management
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          The admin event workspace is being redesigned for a more reliable and focused workflow.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-bg)] p-4">
            <CalendarClock className="h-8 w-8" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            Event admin section is coming soon
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Create, moderation, participant control, and poll tools are being consolidated into a new interface.
          </p>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Sparkles className="h-4 w-4" />
            <Clock3 className="h-4 w-4" />
            Coming soon
          </div>
        </div>
      </section>
    </div>
  )
}
