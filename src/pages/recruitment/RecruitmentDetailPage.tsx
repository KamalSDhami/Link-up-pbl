import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  Briefcase,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { TableInsert, TableRow, TableUpdate } from '@/types/database'

interface RecruitmentDetails {
  id: string
  title: string
  description: string
  required_skills: string[]
  positions_available: number
  preferred_gender: 'male' | 'female' | 'any'
  status: 'open' | 'closed' | 'archived'
  created_at: string
  updated_at: string
  expires_at: string | null
  posted_by: string
  team_id: string
  teams: {
    id: string
    name: string
    description: string | null
    year: number
    member_count: number
    is_full: boolean
    max_size: number
    purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
  } | null
  users: {
    id: string
    name: string
    email: string
    section: string | null
    year: number | null
    profile_picture_url: string | null
  } | null
  applications?: { id: string }[]
}

type ApplicationRow = TableRow<'applications'>
type ApplicationInsert = TableInsert<'applications'>
type ApplicationUpdate = TableUpdate<'applications'>

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[ab89][0-9a-f]{3}-[0-9a-f]{12}$/i

const PURPOSE_LABELS: Record<'hackathon' | 'college_event' | 'pbl' | 'other', string> = {
  hackathon: 'Hackathon',
  college_event: 'College Event',
  pbl: 'Project Based Learning',
  other: 'Other',
}

export default function RecruitmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [recruitment, setRecruitment] = useState<RecruitmentDetails | null>(null)
  const [application, setApplication] = useState<ApplicationRow | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const expiresAt = recruitment?.expires_at ? new Date(recruitment.expires_at) : null
  const hasExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false
  const isRecruitmentOpen = recruitment?.status === 'open' && !hasExpired
  const statusLabel = recruitment
    ? hasExpired && recruitment.status === 'open'
      ? 'archived'
      : recruitment.status
    : 'archived'
  const isOwner = user?.id === recruitment?.posted_by
  const applicantCount = recruitment?.applications?.length ?? 0

  useEffect(() => {
    if (!id) return
    loadRecruitment()
  }, [id, user?.id])

  const loadRecruitment = async () => {
    if (!id) return

    if (!UUID_PATTERN.test(id)) {
      toast.error('That recruitment link looks incorrect. Redirecting you back to the listings.')
      navigate('/recruitment', { replace: true })
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      try {
        await supabase.rpc('mark_expired_recruitments')
      } catch (rpcError: any) {
        console.warn('Failed to refresh recruitment expiration:', rpcError?.message || rpcError)
      }

      const { data, error } = await supabase
        .from('recruitment_posts')
        .select(`
          id,
          title,
          description,
          required_skills,
          positions_available,
          preferred_gender,
          status,
          expires_at,
          created_at,
          updated_at,
          posted_by,
          team_id,
          teams:team_id (
            id,
            name,
            description,
            year,
            member_count,
            is_full,
            max_size,
            purpose
          ),
          users:posted_by (
            id,
            name,
            email,
            section,
            year,
            profile_picture_url
          ),
          applications:applications (
            id
          )
        `)
        .eq('id', id)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Recruitment not found')
          navigate('/recruitment')
          return
        }
        throw error
      }

      setRecruitment(data as RecruitmentDetails)

      if (user) {
        const { data: existingApplications, error: applicationError } = await supabase
          .from('applications')
          .select('*')
          .eq('recruitment_post_id', id)
          .eq('applicant_id', user.id)

        if (!applicationError) {
          const applications = (existingApplications ?? []) as ApplicationRow[]
          const currentApplication = applications[0] ?? null
          setApplication(currentApplication)
          setMessage(currentApplication?.message ?? '')
        }
      }
    } catch (error: any) {
      console.error('Error loading recruitment:', error)
      toast.error('Failed to load recruitment details')
      navigate('/recruitment')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!user || !recruitment) {
      toast.error('You must be signed in to apply')
      return
    }

    if (!isRecruitmentOpen) {
      toast.error('This recruitment is not accepting applications right now')
      return
    }

    if (isOwner) {
      toast.error('You cannot apply to your own recruitment post')
      return
    }

    if (application && application.status !== 'pending') {
      toast.error('This application has already been reviewed')
      return
    }

     if (!application && recruitment.teams?.purpose === 'pbl') {
       try {
         const { data: pendingPblApplications, error: pendingError } = await supabase
           .from('applications')
           .select(
             `id, status, recruitment_post_id,
              recruitment_posts:recruitment_post_id (
                team_id,
                teams:team_id (purpose)
              )`
           )
           .eq('applicant_id', user.id)
           .eq('status', 'pending')

         if (pendingError) throw pendingError

         const pendingCount = (pendingPblApplications ?? []).filter((record: any) => {
           const purpose = record.recruitment_posts?.teams?.purpose
           return purpose === 'pbl' && record.recruitment_post_id !== recruitment.id
         }).length

         if (pendingCount >= 2) {
           toast.error('You already have two pending PBL applications.')
           return
         }
       } catch (error: any) {
         console.error('Error validating PBL application limit:', error)
         toast.error('Failed to validate application limits. Please try again later.')
         return
       }
     }

    setSubmitting(true)
    try {
      if (application) {
        const updatePayload: ApplicationUpdate = {
          message: message.trim() || null,
        }

        const { error } = await supabase
          .from('applications')
          .update(updatePayload as never)
          .eq('id', application.id)

        if (error) throw error

        toast.success('Application updated')
      } else {
        const insertPayload: ApplicationInsert = {
          recruitment_post_id: recruitment.id,
          applicant_id: user.id,
          message: message.trim() || null,
          status: 'pending',
        }

        const { error } = await supabase
          .from('applications')
          .insert([insertPayload] as never)

        if (error) {
          if (error.code === '23505') {
            toast.error('You have already applied to this recruitment')
          } else {
            throw error
          }
        } else {
          toast.success('Application submitted')
        }
      }

      await loadRecruitment()
    } catch (error: any) {
      console.error('Error submitting application:', error)
      toast.error(error.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!recruitment) {
    return null
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <button
        onClick={() => navigate('/recruitment')}
        className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to recruitments
      </button>

      <div className="card space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{recruitment.title}</h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                  statusLabel === 'open'
                    ? 'bg-green-100 text-green-700'
                    : statusLabel === 'closed'
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {statusLabel}
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-600">
              <div className="h-10 w-10 flex-shrink-0">
                {recruitment.users?.profile_picture_url ? (
                  <img
                    src={recruitment.users.profile_picture_url}
                    alt={recruitment.users?.name ?? 'Recruitment owner'}
                    className="h-10 w-10 rounded-full object-cover shadow-sm"
                  />
                ) : (
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-base font-semibold text-primary-700">
                    {(recruitment.users?.name ?? 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Posted by {recruitment.users?.name ?? 'Unknown'}
                </p>
                <p className="text-xs text-slate-500">
                  Posted on {new Date(recruitment.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {isOwner && (
            <Link
              to="/recruitment/applications"
              className="btn-primary flex items-center gap-2"
            >
              <MessageSquare className="h-4 w-4" />
              Manage applications
            </Link>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-slate-600">
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            {recruitment.positions_available} position(s)
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Team {recruitment.teams?.name ?? 'N/A'} (Year {recruitment.teams?.year ?? '-'})
          </span>
          <span className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary-600" />
            {applicantCount} applicant{applicantCount === 1 ? '' : 's'} so far
          </span>
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-primary-600" />
            Preference:{' '}
            {recruitment.preferred_gender === 'any'
              ? 'Open to everyone'
              : recruitment.preferred_gender === 'male'
                ? 'Male candidates only'
                : 'Female candidates only'}
          </span>
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Updated {new Date(recruitment.updated_at).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {expiresAt
              ? hasExpired
                ? `Expired ${expiresAt.toLocaleString()}`
                : `Expires ${expiresAt.toLocaleString()}`
              : 'No expiry set'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">About the role</h2>
            <p className="whitespace-pre-line leading-relaxed text-slate-700">
              {recruitment.description}
            </p>
          </div>

          {recruitment.required_skills.length > 0 && (
            <div className="card space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Required skills</h2>
              <div className="flex flex-wrap gap-2">
                {recruitment.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {recruitment.teams && (
            <div className="card space-y-4">
              <h2 className="text-xl font-semibold text-slate-900">Team overview</h2>
              <div className="space-y-3 text-slate-700">
                <p>{recruitment.teams.description || 'No team description provided yet.'}</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                  <span>Members: {recruitment.teams.member_count}/{recruitment.teams.max_size}</span>
                  <span>Status: {recruitment.teams.is_full ? 'Full' : 'Accepting members'}</span>
                  <span>Purpose: {PURPOSE_LABELS[recruitment.teams.purpose]}</span>
                  <span>Year: {recruitment.teams.year}</span>
                </div>
                <Link
                  to={`/teams/${recruitment.teams.id}`}
                  className="inline-flex items-center gap-2 text-primary-600 hover:text-primary-700"
                >
                  View team profile →
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="card space-y-4">
            <h2 className="text-xl font-semibold text-slate-900">Apply to this role</h2>

            {isOwner ? (
              <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
                <CheckCircle2 className="h-4 w-4" />
                You posted this recruitment. Manage applications below.
              </div>
            ) : !isRecruitmentOpen ? (
              <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
                {hasExpired ? <Clock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                {hasExpired
                  ? 'This recruitment has expired.'
                  : 'Applications are currently closed for this role.'}
              </div>
            ) : application && application.status !== 'pending' ? (
              <div
                className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${
                  application.status === 'accepted'
                    ? 'bg-green-50 text-green-700'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {application.status === 'accepted' ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Your application was {application.status}.
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmitApplication}>
                <label className="block text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Message to the team (optional)
                </label>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={5}
                  placeholder="Share why you are a great fit, highlight relevant experience, or mention availability."
                  className="textarea-field"
                  disabled={submitting}
                  maxLength={600}
                />
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>{message.length}/600 characters</span>
                  {application && application.status === 'pending' && (
                    <span>Updating your note keeps the request pending.</span>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary w-full justify-center"
                >
                  {submitting ? 'Submitting…' : application ? 'Update application' : 'Submit application'}
                </button>
              </form>
            )}
          </div>

          <div className="card space-y-3 text-sm text-slate-600">
            <h3 className="text-base font-semibold text-slate-900">Need help?</h3>
            <p>
              After submitting, the team leader will review your application. You can monitor your
              status here or reach out via messages if invited.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
