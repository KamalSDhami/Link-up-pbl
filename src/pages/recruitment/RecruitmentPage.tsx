import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Briefcase, Users, TrendingUp, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface RecruitmentPost {
  id: string
  title: string
  description: string
  required_skills: string[]
  positions_available: number
  status: 'open' | 'closed' | 'archived'
  expires_at: string | null
  created_at: string
  teams: {
    id: string
    name: string
    year: number
  } | null
  users: {
    name: string
  } | null
  applications?: { id: string }[]
}

const YEARS = [1, 2, 3, 4]

export default function RecruitmentPage() {
  const [recruitments, setRecruitments] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({ year: '', skill: '', status: 'open' as '' | 'open' | 'closed' | 'archived' })

  useEffect(() => {
    loadRecruitments()
  }, [filters.status])

  const loadRecruitments = async () => {
    setLoading(true)
    try {
      await supabase.rpc('mark_expired_recruitments')
      // Ignore errors from the maintenance RPC and continue with the query
    } catch (rpcError: any) {
      console.warn('Failed to mark expired recruitments:', rpcError?.message || rpcError)
    }

    try {
      let query = supabase
        .from('recruitment_posts')
        .select(`
          id,
          title,
          description,
          required_skills,
          positions_available,
          status,
          expires_at,
          created_at,
          team_id,
          posted_by,
          teams:team_id (
            id,
            name,
            year
          ),
          users:posted_by (
            name
          ),
          applications:applications (
            id
          )
        `)

      if (filters.status) {
        query = query.eq('status', filters.status)
      }

      const { data, error } = await query

      if (error) {
        throw error
      }

      const rawData = (data || []) as RecruitmentPost[]
      const sortedData = [...rawData]
        .map((post) => {
          const expiresAt = post.expires_at ? new Date(post.expires_at) : null
          const isExpired = expiresAt ? expiresAt.getTime() <= Date.now() : false
          return isExpired && post.status === 'open'
            ? { ...post, status: 'archived' as const }
            : post
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

      setRecruitments(sortedData)
    } catch (error: any) {
      console.error('Error loading recruitments:', error)
      toast.error('Failed to load recruitments')
      setRecruitments([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRecruitments = useMemo(() => {
    return recruitments
      .filter((post) =>
        filters.year ? post.teams?.year === Number(filters.year) : true
      )
      .filter((post) =>
        filters.skill
          ? post.required_skills.some((skill) =>
              skill.toLowerCase().includes(filters.skill.toLowerCase())
            )
          : true
      )
      .filter((post) => {
        if (!searchQuery.trim()) return true
        const query = searchQuery.toLowerCase()
        return (
          post.title.toLowerCase().includes(query) ||
          post.description.toLowerCase().includes(query) ||
          post.teams?.name.toLowerCase().includes(query) ||
          post.required_skills.some((skill) => skill.toLowerCase().includes(query))
        )
      })
  }, [filters.skill, filters.year, recruitments, searchQuery])

  const allSkills = useMemo(() => {
    return Array.from(new Set(recruitments.flatMap((post) => post.required_skills))).sort()
  }, [recruitments])

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3">
        <h1 className="flex items-center gap-3 text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          <Briefcase className="h-10 w-10" style={{ color: 'var(--accent)' }} />
          Browse Recruitments
        </h1>
        <p style={{ color: 'var(--text-secondary)' }}>Find the perfect opportunity to join a project-ready team.</p>
      </div>

      <div className="card space-y-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Search by title, team, or skills"
                className="input-field pl-10"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </div>
          <div>
            <select
              className="input-field"
              value={filters.year}
              onChange={(event) => setFilters((prev) => ({ ...prev, year: event.target.value }))}
            >
              <option value="">All Years</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              className="input-field"
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as '' | 'open' | 'closed' | 'archived',
                }))
              }
            >
              <option value="">All Statuses</option>
              <option value="open">Open</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <select
              className="input-field"
              value={filters.skill}
              onChange={(event) => setFilters((prev) => ({ ...prev, skill: event.target.value }))}
            >
              <option value="">All Skills</option>
              {allSkills.map((skill) => (
                <option key={skill} value={skill}>
                  {skill}
                </option>
              ))}
            </select>
          </div>
        </div>

        {allSkills.length > 0 && (
          <div className="border-t border-[color:var(--color-border)] pt-4">
            <p className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Filter className="h-4 w-4" />
              Quick skill filters
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setFilters((prev) => ({ ...prev, skill: '' }))}
                className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                  filters.skill === ''
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--color-muted)] hover:bg-[var(--accent-hover)]'
                }`}
                style={filters.skill !== '' ? { color: 'var(--text-primary)' } : {}}
              >
                All Skills
              </button>
              {allSkills.slice(0, 10).map((skill) => (
                <button
                  key={skill}
                  onClick={() => setFilters((prev) => ({ ...prev, skill }))}
                  className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    filters.skill === skill
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-[var(--color-muted)] hover:bg-[var(--accent-hover)]'
                  }`}
                  style={filters.skill !== skill ? { color: 'var(--text-primary)' } : {}}
                >
                  {skill}
                </button>
              ))}
              {allSkills.length > 10 && (
                <span className="rounded-full bg-[var(--color-muted)] px-3 py-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  +{allSkills.length - 10} more
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
        <span className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4" />
          {filteredRecruitments.length} opportunities found
        </span>
        {filters.year && (
          <span className="rounded-full bg-[var(--accent-hover)] px-3 py-1" style={{ color: 'var(--accent)' }}>
            Year {filters.year}
          </span>
        )}
        {filters.skill && (
          <span className="rounded-full bg-[var(--accent-hover)] px-3 py-1" style={{ color: 'var(--accent)' }}>
            {filters.skill}
          </span>
        )}
        {filters.status && (
          <span className="rounded-full bg-green-500/20 px-3 py-1 text-green-400 capitalize">
            {filters.status}
          </span>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="card animate-pulse">
              <div className="mb-4 h-6 w-3/4 rounded bg-[var(--color-muted)]"></div>
              <div className="mb-2 h-4 w-full rounded bg-[var(--color-muted)]"></div>
              <div className="mb-4 h-4 w-2/3 rounded bg-[var(--color-muted)]"></div>
              <div className="h-8 w-full rounded bg-[var(--color-muted)]"></div>
            </div>
          ))}
        </div>
      ) : filteredRecruitments.length === 0 ? (
        <div className="card text-center">
          <Briefcase className="mx-auto mb-4 h-16 w-16" style={{ color: 'var(--text-disabled)' }} />
          <h3 className="mb-2 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>No recruitments found</h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            {searchQuery || filters.year || filters.skill
              ? 'Try adjusting your search or filters.'
              : 'Check back soon for new opportunities.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredRecruitments.map((recruitment) => {
            const expiresAt = recruitment.expires_at ? new Date(recruitment.expires_at) : null
            const expired = expiresAt ? expiresAt.getTime() <= Date.now() : false
            const status = expired ? 'archived' : recruitment.status
            const applicantCount = recruitment.applications?.length ?? 0
            const title = recruitment.title?.trim() ? recruitment.title.trim() : 'Untitled role'
            const rawDescription = recruitment.description?.trim() ?? ''
            const showDescription = rawDescription.length > 0
            const teamName = recruitment.teams?.name?.trim() || 'Unknown team'
            const teamYear = recruitment.teams?.year
            const requiredSkills = recruitment.required_skills ?? []
            const expiryLabel = expiresAt
              ? expiresAt.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
              : null

            return (
              <Link
                key={recruitment.id}
                to={`/recruitment/${recruitment.id}`}
                className="card group transition-shadow hover:shadow-2xl"
              >
                <div className="mb-4 flex items-start justify-between">
                  <h3 className="text-lg font-semibold transition-colors group-hover:text-[var(--accent)]" style={{ color: 'var(--text-primary)' }}>
                    {title}
                  </h3>
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-semibold ${
                      status === 'open'
                        ? 'bg-green-500/20 text-green-400'
                        : status === 'closed'
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-[var(--color-muted)]'
                    }`}
                    style={status === 'archived' ? { color: 'var(--text-secondary)' } : {}}
                  >
                    {status}
                  </span>
                </div>
                <div className="mb-3 flex flex-wrap items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <Users className="h-4 w-4" />
                  <span className="font-medium">{teamName}</span>
                  {teamYear ? <span>·</span> : null}
                  {teamYear ? <span>Year {teamYear}</span> : null}
                </div>
                {showDescription && (
                  <p className="mb-4 line-clamp-2 text-sm" style={{ color: 'var(--text-secondary)' }}>{rawDescription}</p>
                )}
                {!showDescription && (
                  <p className="mb-4 text-sm" style={{ color: 'var(--text-disabled)' }}>No description provided.</p>
                )}
                {requiredSkills.length > 0 && (
                  <div className="mb-4 flex flex-wrap gap-2">
                    {requiredSkills.slice(0, 3).map((skill) => (
                      <span key={skill} className="rounded-full bg-[var(--accent-hover)] px-2 py-1 text-xs font-medium" style={{ color: 'var(--accent)' }}>
                        {skill}
                      </span>
                    ))}
                    {requiredSkills.length > 3 && (
                      <span className="rounded-full bg-[var(--color-muted)] px-2 py-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                        +{requiredSkills.length - 3}
                      </span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 border-t border-[color:var(--color-border)] pt-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <span>{recruitment.positions_available} position(s)</span>
                  <span className="flex items-center gap-1 text-xs">
                    <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
                    {applicantCount} applied
                  </span>
                  <span className={`text-xs ${expired ? 'text-red-400' : ''}`} style={!expired ? { color: 'var(--text-disabled)' } : {}}>
                    {expiryLabel
                      ? expired
                        ? `Expired ${expiryLabel}`
                        : `Expires ${expiryLabel}`
                      : 'No expiry set'}
                  </span>
                  <span className="ml-auto font-medium" style={{ color: 'var(--accent)' }}>View details →</span>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
