import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ChevronLeft,
  Loader2,
  ClipboardList,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Vote,
  Radio,
  Tag,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type {
  Event,
  EventForm,
  EventPoll,
  EventPollOption,
  EventPollVote,
  EventRegistration,
} from '@/types'
import type { Json, TableInsert } from '@/types/database'

interface FormField {
  id: string
  label: string
  type: 'short_text' | 'paragraph' | 'select' | 'multi_select'
  required?: boolean
  placeholder?: string | null
  options?: string[]
}

interface RegistrationFormSchema {
  version: number
  fields: FormField[]
}

interface PollWithRelations extends EventPoll {
  event_poll_options: EventPollOption[]
  event_poll_votes: EventPollVote[]
}

type EventState = 'upcoming' | 'live' | 'ended' | 'cancelled'

const EVENT_STATE_LABELS: Record<EventState, { label: string; accent: string }> = {
  upcoming: { label: 'Upcoming', accent: 'bg-blue-100 text-blue-700' },
  live: { label: 'Live now', accent: 'bg-emerald-100 text-emerald-700' },
  ended: { label: 'Ended', accent: 'bg-slate-200 text-slate-700' },
  cancelled: { label: 'Cancelled', accent: 'bg-red-100 text-red-700' },
}

function computeEventState(evt: Event): EventState {
  if (evt.status === 'cancelled') {
    return 'cancelled'
  }

  const now = new Date()
  const start = new Date(evt.start_at)
  const end = new Date(evt.end_at)

  if (end.getTime() < now.getTime()) {
    return 'ended'
  }

  if (start.getTime() <= now.getTime() && end.getTime() >= now.getTime()) {
    return 'live'
  }

  return 'upcoming'
}

function formatDateRange(startISO: string, endISO: string) {
  const start = new Date(startISO)
  const end = new Date(endISO)
  const sameDay = start.toDateString() === end.toDateString()

  if (sameDay) {
    const dayPart = new Intl.DateTimeFormat('en', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }).format(start)

    const timeFormatter = new Intl.DateTimeFormat('en', {
      hour: 'numeric',
      minute: '2-digit',
    })

    return `${dayPart} · ${timeFormatter.format(start)} – ${timeFormatter.format(end)}`
  }

  const formatter = new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

  return `${formatter.format(start)} → ${formatter.format(end)}`
}

function parseFormSchema(schema: EventForm | null): RegistrationFormSchema | null {
  if (!schema?.form_schema || typeof schema.form_schema !== 'object') {
    return null
  }

  const raw = schema.form_schema as { version?: number; fields?: FormField[] }

  if (!Array.isArray(raw.fields)) {
    return null
  }

  const fields = raw.fields
    .filter((field) => field && typeof field.id === 'string' && typeof field.label === 'string')
    .map((field) => ({
      id: field.id,
      label: field.label,
      type: field.type ?? 'short_text',
      required: field.required ?? false,
      placeholder: field.placeholder ?? null,
      options: Array.isArray(field.options) ? field.options : [],
    }))

  if (!fields.length) {
    return null
  }

  return {
    version: raw.version ?? 1,
    fields,
  }
}

function isRegistrationOpen(evt: Event): boolean {
  if (evt.registration_type === 'open' || evt.status === 'cancelled') {
    return false
  }

  const now = new Date()

  if (evt.registration_opens_at && new Date(evt.registration_opens_at).getTime() > now.getTime()) {
    return false
  }

  if (evt.registration_closes_at && new Date(evt.registration_closes_at).getTime() < now.getTime()) {
    return false
  }

  if (new Date(evt.end_at).getTime() < now.getTime()) {
    return false
  }

  return true
}

function registrationWindowSummary(evt: Event): string {
  if (evt.registration_type === 'open') {
    return 'This event is open to everyone without registration.'
  }

  if (!evt.registration_opens_at && !evt.registration_closes_at) {
    return 'Registration is open until the event begins.'
  }

  const opens = evt.registration_opens_at
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(evt.registration_opens_at))
    : 'now'
  const closes = evt.registration_closes_at
    ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(evt.registration_closes_at))
    : 'event start'

  return `Registration window: ${opens} → ${closes}`
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [event, setEvent] = useState<Event | null>(null)
  const [registration, setRegistration] = useState<EventRegistration | null>(null)
  const [formSchema, setFormSchema] = useState<RegistrationFormSchema | null>(null)
  const [polls, setPolls] = useState<PollWithRelations[]>([])
  const [formValues, setFormValues] = useState<Record<string, string | string[]>>({})
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const eventId = params.id
    if (!eventId) return

    setLoading(true)

    try {
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .maybeSingle()

      if (eventError) throw eventError

      if (!eventData) {
        toast.error('Event not found')
        navigate('/events', { replace: true })
        return
      }

      const typedEvent = eventData as Event
      setEvent(typedEvent)

      if (user?.id) {
        const { data: registrationData, error: registrationError } = await supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', eventId)
          .eq('user_id', user.id)
          .maybeSingle()

        if (registrationError && registrationError.code !== 'PGRST116') {
          throw registrationError
        }

        setRegistration(registrationData as EventRegistration | null)
      } else {
        setRegistration(null)
      }

      if (typedEvent.registration_flow === 'form_review') {
        const { data: formData, error: formError } = await supabase
          .from('event_forms')
          .select('*')
          .eq('event_id', eventId)
          .maybeSingle()

        if (formError && formError.code !== 'PGRST116') {
          throw formError
        }

        const parsed = parseFormSchema(formData as EventForm | null)
        setFormSchema(parsed)

        if (parsed) {
          const initialValues = parsed.fields.reduce<Record<string, string | string[]>>((acc, field) => {
            acc[field.id] = field.type === 'multi_select' ? [] : ''
            return acc
          }, {})
          setFormValues(initialValues)
        }
      } else {
        setFormSchema(null)
      }

      const { data: pollsData, error: pollsError } = await supabase
        .from('event_polls')
        .select('*, event_poll_options(*), event_poll_votes(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false })

      if (pollsError) throw pollsError

      setPolls((pollsData || []) as PollWithRelations[])
    } catch (error: any) {
      console.error('Failed to load event', error)
      toast.error('Unable to fetch event details right now')
    } finally {
      setLoading(false)
    }
  }, [navigate, params.id, user?.id])

  useEffect(() => {
    loadData()
  }, [loadData])

  const state = useMemo(() => (event ? computeEventState(event) : 'upcoming'), [event])
  const registrationOpen = useMemo(() => (event ? isRegistrationOpen(event) : false), [event])

  const canVote = useMemo(() => {
    if (!event || !user) return false
    if (!user.gehu_verified) return false
    if (event.registration_type === 'open') return true
    if (!registration) return false
    return ['approved', 'pending'].includes(registration.status)
  }, [event, registration, user])

  const handleAutoRegistration = async () => {
    if (!event || !user) return

    if (!user.gehu_verified) {
      toast.error('Verify your GEHU email to register for events')
      return
    }

    if (!registrationOpen) {
      toast.error('Registration window is closed')
      return
    }

    setSubmitting(true)
    try {
      const nowISO = new Date().toISOString()
      const payload: TableInsert<'event_registrations'> = {
        event_id: event.id,
        user_id: user.id,
        status: 'approved',
        answers: null,
        submitted_at: nowISO,
        reviewed_at: nowISO,
        reviewed_by: event.created_by ?? null,
      }

      const { error } = await supabase
        .from('event_registrations')
        .upsert(payload as any, { onConflict: 'event_id,user_id' })

      if (error) throw error

      toast.success('You are registered for this event!')
      await loadData()
    } catch (error: any) {
      console.error('Registration failed', error)
      toast.error('Could not register for this event. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFormSubmit = async (eventObject: React.FormEvent<HTMLFormElement>) => {
    eventObject.preventDefault()
    if (!event || !user || !formSchema) return

    if (!user.gehu_verified) {
      toast.error('Only GEHU verified students can submit event applications')
      return
    }

    if (!registrationOpen) {
      toast.error('Registration window is closed')
      return
    }

    for (const field of formSchema.fields) {
      if (!field.required) continue
      const value = formValues[field.id]
      const isEmptyArray = Array.isArray(value) && value.length === 0
      if (value === '' || value == null || isEmptyArray) {
        toast.error(`Please complete the "${field.label}" field`)
        return
      }
    }

    const answersPayload: Json = {
      version: formSchema.version,
      submitted_at: new Date().toISOString(),
      responses: formSchema.fields.map((field) => ({
        id: field.id,
        label: field.label,
        value: (formValues[field.id] ?? (field.type === 'multi_select' ? [] : '')) as Json,
      })),
    }

    setSubmitting(true)
    try {
      const payload: TableInsert<'event_registrations'> = {
        event_id: event.id,
        user_id: user.id,
        status: 'pending',
        answers: answersPayload,
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        reviewed_by: null,
      }

      const { error } = await supabase
        .from('event_registrations')
        .upsert(payload as any, { onConflict: 'event_id,user_id' })

      if (error) throw error

      toast.success('Your application has been submitted for review')
      await loadData()
    } catch (error: any) {
      console.error('Failed to submit registration', error)
      toast.error('Could not submit your application. Please try again later.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelRegistration = async () => {
    if (!event || !user || !registration) return

    const confirmed = window.confirm('Are you sure you want to withdraw from this event?')
    if (!confirmed) return

    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('event_id', event.id)
        .eq('user_id', user.id)

      if (error) throw error

      toast.success('Your registration has been withdrawn')
      await loadData()
    } catch (error: any) {
      console.error('Failed to cancel registration', error)
      toast.error('Could not cancel your registration')
    }
  }

  const handleVote = async (pollId: string, optionId: string) => {
    if (!user) {
      toast.error('Sign in to vote in polls')
      return
    }

    if (!canVote) {
      toast.error('You must be registered for this event to vote')
      return
    }

    setVoting(pollId)
    try {
      await supabase
        .from('event_poll_votes')
        .delete()
        .eq('poll_id', pollId)
        .eq('user_id', user.id)

      const votePayload: TableInsert<'event_poll_votes'> = {
        poll_id: pollId,
        option_id: optionId,
        user_id: user.id,
      }

      const { error } = await supabase
        .from('event_poll_votes')
        .insert(votePayload as any)

      if (error) throw error

      await loadData()
    } catch (error: any) {
      console.error('Failed to submit vote', error)
      toast.error('Could not submit your vote right now')
    } finally {
      setVoting(null)
    }
  }

  const renderField = (field: FormField) => {
    const value = formValues[field.id]

    switch (field.type) {
      case 'paragraph':
        return (
          <textarea
            id={field.id}
            className="input-field min-h-[120px]"
            placeholder={field.placeholder ?? 'Your answer'}
            value={(value as string) ?? ''}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                [field.id]: event.target.value,
              }))
            }
          />
        )
      case 'select':
        return (
          <select
            id={field.id}
            className="input-field"
            value={(value as string) ?? ''}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                [field.id]: event.target.value,
              }))
            }
          >
            <option value="">Select an option</option>
            {(field.options ?? []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )
      case 'multi_select':
        return (
          <div className="space-y-2">
            {(field.options ?? []).map((option) => {
              const current = Array.isArray(value) ? value : []
              const checked = current.includes(option)

              return (
                <label key={option} className="flex items-center gap-2 text-sm text-slate-600">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300 text-primary-600"
                    checked={checked}
                    onChange={(event) => {
                      setFormValues((prev) => {
                        const existing = Array.isArray(prev[field.id]) ? [...(prev[field.id] as string[])] : []
                        if (event.target.checked) {
                          existing.push(option)
                        } else {
                          const idx = existing.indexOf(option)
                          if (idx !== -1) existing.splice(idx, 1)
                        }
                        return { ...prev, [field.id]: existing }
                      })
                    }}
                  />
                  {option}
                </label>
              )
            })}
          </div>
        )
      default:
        return (
          <input
            id={field.id}
            className="input-field"
            placeholder={field.placeholder ?? 'Your answer'}
            value={(value as string) ?? ''}
            onChange={(event) =>
              setFormValues((prev) => ({
                ...prev,
                [field.id]: event.target.value,
              }))
            }
          />
        )
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    )
  }

  if (!event) {
    return (
      <div className="card space-y-4 py-16 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-red-400" />
        <h2 className="text-xl font-semibold text-slate-900">Event unavailable</h2>
        <p className="text-sm text-slate-600">The event you are looking for could not be found.</p>
        <Link to="/events" className="btn-primary inline-flex items-center justify-center">
          <ChevronLeft className="mr-2 h-4 w-4" />
          Back to events
        </Link>
      </div>
    )
  }

  const stateMeta = EVENT_STATE_LABELS[state]

  const totalApproved = polls.reduce((acc, poll) => acc + (poll.event_poll_votes?.length ?? 0), 0)

  return (
    <div className="space-y-8">
      <Link to="/events" className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-700">
        <ChevronLeft className="mr-2 h-4 w-4" />
        Back to events
      </Link>

      <div className="card space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${stateMeta.accent}`}>
                {stateMeta.label}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {event.event_type.replace('_', ' ')}
              </span>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                {event.event_mode === 'online' ? 'Online' : event.event_mode === 'hybrid' ? 'Hybrid' : 'On campus'}
              </span>
            </div>
            <h1 className="text-3xl font-display font-bold text-slate-900">{event.title}</h1>
            {event.summary && <p className="text-base text-slate-600">{event.summary}</p>}
          </div>
          {event.banner_url && (
            <img
              src={event.banner_url}
              alt={event.title}
              className="h-32 w-32 flex-shrink-0 rounded-xl object-cover shadow-sm"
            />
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <Calendar className="mt-1 h-5 w-5 text-primary-500" />
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Schedule</div>
              <div className="text-sm font-medium text-slate-900">{formatDateRange(event.start_at, event.end_at)}</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <Clock className="mt-1 h-5 w-5 text-primary-500" />
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Registration</div>
              <div className="text-sm font-medium text-slate-900">{registrationWindowSummary(event)}</div>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <MapPin className="mt-1 h-5 w-5 text-primary-500" />
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Where</div>
              <div className="text-sm font-medium text-slate-900">
                {event.location || (event.event_mode === 'online' ? 'Online session' : 'Location to be announced')}
              </div>
              {event.meeting_link && (
                <a
                  href={event.meeting_link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary-600 hover:text-primary-700"
                >
                  Join link ↗
                </a>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 p-4">
            <Users className="mt-1 h-5 w-5 text-primary-500" />
            <div className="space-y-1">
              <div className="text-xs uppercase tracking-wide text-slate-500">Capacity</div>
              <div className="text-sm font-medium text-slate-900">
                {event.max_participants ? `${event.max_participants} participants` : 'No seat limit'}
              </div>
              <div className="text-xs text-slate-500">
                {event.allow_waitlist ? 'Waitlist enabled' : 'No waitlist'}
              </div>
            </div>
          </div>
        </div>

        {event.description && (
          <div className="prose prose-sm max-w-none text-slate-700" dangerouslySetInnerHTML={{ __html: event.description }} />
        )}
      </div>

      <div id="register" className="grid gap-6 lg:grid-cols-2">
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Registration</h2>
          </div>

          {event.registration_type === 'open' ? (
            <div className="rounded-lg bg-emerald-50 p-4 text-sm text-emerald-700">
              This event is open to all verified GEHU students. Join directly when the session starts.
            </div>
          ) : !user ? (
            <div className="rounded-lg bg-primary-50 p-4 text-sm text-primary-700">
              Sign in and verify your GEHU email to register.
            </div>
          ) : !user.gehu_verified ? (
            <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
              Only GEHU-verified students can register. Verify your email from the profile page.
            </div>
          ) : registration ? (
            <div className="rounded-lg border border-primary-200 bg-primary-50 p-4 text-sm text-primary-700">
              <div className="flex items-center gap-2 font-semibold">
                {registration.status === 'approved' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : registration.status === 'rejected' ? (
                  <XCircle className="h-5 w-5" />
                ) : (
                  <Radio className="h-5 w-5" />
                )}
                You are {registration.status} for this event.
              </div>
              <div className="mt-2 text-xs text-primary-600">
                Submitted on{' '}
                {new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
                  new Date(registration.submitted_at)
                )}
              </div>
              <button
                type="button"
                onClick={handleCancelRegistration}
                className="btn-ghost mt-4 inline-flex text-xs text-primary-700 hover:text-primary-800"
              >
                Withdraw registration
              </button>
            </div>
          ) : registrationOpen ? (
            event.registration_flow === 'auto_approval' ? (
              <div className="space-y-3">
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Registration is automatic. Seats will be confirmed instantly.
                </div>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleAutoRegistration}
                  className="btn-primary inline-flex items-center justify-center"
                >
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Tag className="mr-2 h-4 w-4" />}
                  Confirm my seat
                </button>
              </div>
            ) : formSchema ? (
              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
                  Complete the application form. The event manager will review your responses.
                </div>
                {formSchema.fields.map((field) => (
                  <div key={field.id} className="space-y-2">
                    <label htmlFor={field.id} className="text-sm font-medium text-slate-700">
                      {field.label}
                      {field.required && <span className="text-red-500"> *</span>}
                    </label>
                    {renderField(field)}
                  </div>
                ))}
                <button type="submit" className="btn-primary inline-flex items-center" disabled={submitting}>
                  {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ClipboardList className="mr-2 h-4 w-4" />}
                  Submit application
                </button>
              </form>
            ) : (
              <div className="rounded-lg bg-amber-50 p-4 text-sm text-amber-700">
                Registration form will be available soon.
              </div>
            )
          ) : (
            <div className="rounded-lg bg-slate-100 p-4 text-sm text-slate-600">
              Registration is currently closed for this event.
            </div>
          )}
        </div>

        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Vote className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-slate-900">Event polls</h2>
          </div>

          {polls.length === 0 ? (
            <div className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
              No polls have been published yet.
            </div>
          ) : (
            <div className="space-y-4">
              {polls.map((poll) => {
                const totalVotes = poll.event_poll_votes?.length ?? 0
                const userVote = poll.event_poll_votes?.find((vote) => vote.user_id === user?.id)

                return (
                  <div key={poll.id} className="rounded-xl border border-slate-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">{poll.question}</h3>
                        {poll.description && (
                          <p className="mt-1 text-xs text-slate-600">{poll.description}</p>
                        )}
                      </div>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${poll.is_published ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {poll.is_published ? 'Live' : 'Draft'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2">
                      {poll.event_poll_options.map((option) => {
                        const optionVotes = poll.event_poll_votes?.filter((vote) => vote.option_id === option.id) ?? []
                        const percent = totalVotes === 0 ? 0 : Math.round((optionVotes.length / totalVotes) * 100)
                        const isSelected = userVote?.option_id === option.id

                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => handleVote(poll.id, option.id)}
                            disabled={!poll.is_published || !canVote || voting === poll.id}
                            className={`relative w-full rounded-lg border px-3 py-2 text-left text-sm transition ${
                              isSelected ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 hover:border-primary-300'
                            }`}
                          >
                            <div className="flex items-start justify-between">
                              <span className="font-medium">{option.label}</span>
                              <span className="text-xs text-slate-500">{optionVotes.length} vote(s)</span>
                            </div>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                              <div
                                className="h-full rounded-full bg-primary-500 transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            {isSelected && <div className="mt-1 text-xs font-medium text-primary-600">You voted</div>}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="text-xs text-slate-500">
            Total votes recorded: {totalApproved}
          </div>
        </div>
      </div>
    </div>
  )
}
