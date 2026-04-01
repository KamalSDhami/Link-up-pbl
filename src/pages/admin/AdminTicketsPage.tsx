import { LifeBuoy, Sparkles, Clock3 } from 'lucide-react'

export default function AdminTicketsPage() {
  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
          Admin Panel
        </p>
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Support Tickets
        </h1>
        <p className="max-w-2xl text-sm" style={{ color: 'var(--text-secondary)' }}>
          Ticket management tools are being refined for moderators and administrators.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-8">
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-bg)] p-4">
            <LifeBuoy className="h-8 w-8" style={{ color: 'var(--accent)' }} />
          </div>
          <h2 className="text-2xl font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
            My Tickets and New Ticket are coming soon
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            A unified admin ticket workspace is on the way with better assignment, reply, and tracking flows.
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
