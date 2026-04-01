import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { CalendarClock, Check, Loader2, RefreshCcw, Search, Trash2, UserPlus, XCircle } from "lucide-react";

import { formatDateTime } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

type RecruitmentRow = TableRow<'recruitment_posts'>
type TeamRow = TableRow<'teams'>
type UserRow = TableRow<'users'>

type RecruitmentPost = RecruitmentRow & {
  team: Pick<TeamRow, 'id' | 'name' | 'purpose'> | null
  poster: Pick<UserRow, 'id' | 'name' | 'email'> | null
}

type PostFormState = {
  title: string
  description: string
  requiredSkills: string
  positionsAvailable: number
  preferredGender: RecruitmentRow['preferred_gender']
  expiresAt: string
  status: RecruitmentRow['status']
  teamId: string
  postedBy: string
}

const defaultForm: PostFormState = {
  title: '',
  description: '',
  requiredSkills: '',
  positionsAvailable: 1,
  preferredGender: 'any',
  expiresAt: '',
  status: 'open',
  teamId: '',
  postedBy: '',
}

const isoToLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset()
  const local = new Date(date.getTime() - offset * 60000)
  return local.toISOString().slice(0, 16)
}

export default function AdminRecruitmentPage() {
  const { user } = useAuthStore()
  const actorRole = user?.role ?? 'student'
  const actorIsAdmin = actorRole === 'super_admin' || actorRole === 'god'

  const [posts, setPosts] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null)
  const [formState, setFormState] = useState<PostFormState>(defaultForm)
  const [saving, setSaving] = useState(false)
  const [closing, setClosing] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [teamOptions, setTeamOptions] = useState<Pick<TeamRow, 'id' | 'name' | 'purpose'>[]>([])
  const [loadingTeams, setLoadingTeams] = useState(false)
  const [selectedPoster, setSelectedPoster] = useState<Pick<UserRow, 'id' | 'name' | 'email'> | null>(null)
  const [posterSearchTerm, setPosterSearchTerm] = useState('')
  const [posterResults, setPosterResults] = useState<Pick<UserRow, 'id' | 'name' | 'email'>[]>([])
  const [searchingPoster, setSearchingPoster] = useState(false)

  useEffect(() => {
    if (!actorIsAdmin) return
    loadPosts()
    loadTeamOptions()
  }, [actorIsAdmin])

  useEffect(() => {
    if (!selectedPostId && posts.length > 0) {
      setSelectedPostId(posts[0].id)
    }
  }, [posts, selectedPostId])

  const selectedPost = useMemo(
    () => posts.find((post) => post.id === selectedPostId) ?? null,
    [posts, selectedPostId]
  )

  useEffect(() => {
    if (!selectedPost) {
      setFormState(defaultForm)
      setSelectedPoster(null)
      setPosterResults([])
      setPosterSearchTerm('')
      return
    }

    setFormState({
      title: selectedPost.title ?? '',
      description: selectedPost.description ?? '',
      requiredSkills: (selectedPost.required_skills ?? []).join(', '),
      positionsAvailable: selectedPost.positions_available ?? 1,
      preferredGender: selectedPost.preferred_gender ?? 'any',
      expiresAt: isoToLocalInput(selectedPost.expires_at ?? null),
      status: selectedPost.status ?? 'open',
      teamId: selectedPost.team_id ?? '',
      postedBy: selectedPost.posted_by ?? '',
    })
    setSelectedPoster(selectedPost.poster ?? null)
    setPosterResults([])
    setPosterSearchTerm('')
  }, [selectedPost])

  const loadPosts = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('recruitment_posts')
        .select(`
          id,
          team_id,
          posted_by,
          title,
          description,
          required_skills,
          positions_available,
          preferred_gender,
          expires_at,
          status,
          created_at,
          updated_at,
          team:team_id ( id, name, purpose ),
          poster:posted_by ( id, name, email )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const normalized = (data as any[] ?? []).map((entry: any) => ({
        ...entry,
        required_skills: entry.required_skills ?? [],
      })) as RecruitmentPost[]

      setPosts(normalized)

      setPosts(normalized)
    } catch (error: any) {
      console.error('Failed to load recruitment posts:', error)
      toast.error(error?.message || 'Unable to load recruitment posts')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const loadTeamOptions = async () => {
    setLoadingTeams(true)
    try {
      const { data, error } = await supabase
        .from('teams')
        .select('id, name, purpose')
        .order('name', { ascending: true })

      if (error) throw error
      setTeamOptions(data ?? [])
    } catch (error: any) {
      console.error('Failed to load team directory:', error)
      toast.error(error?.message || 'Unable to load team directory')
    } finally {
      setLoadingTeams(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await Promise.all([loadPosts(), loadTeamOptions()])
  }

  const handleSave = async () => {
    if (!selectedPost) return
    if (!formState.title.trim()) {
      toast.error('Title cannot be empty')
      return
    }
    if (!formState.description.trim()) {
      toast.error('Description cannot be empty')
      return
    }
    if (!formState.teamId) {
      toast.error('Select a team for this post')
      return
    }
    if (!formState.postedBy) {
      toast.error('Select a posting user')
      return
    }

    setSaving(true)
    try {
      const skillsArray = formState.requiredSkills
        .split(',')
        .map((skill) => skill.trim())
        .filter(Boolean)

      const payload = {
        title: formState.title.trim(),
        description: formState.description.trim(),
        required_skills: skillsArray,
        positions_available: Math.max(1, formState.positionsAvailable),
        preferred_gender: formState.preferredGender,
        expires_at: formState.expiresAt ? new Date(formState.expiresAt).toISOString() : null,
        status: formState.status,
        team_id: formState.teamId,
        posted_by: formState.postedBy,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('recruitment_posts')
        .update(payload as never)
        .eq('id', selectedPost.id)

      if (error) throw error

      setPosts((previous) =>
        previous.map((post) => {
          if (post.id !== selectedPost.id) return post

          const nextTeam = teamOptions.find((team) => team.id === payload.team_id) ?? post.team
          const nextPoster = selectedPoster ?? post.poster

          return {
            ...post,
            ...payload,
            required_skills: payload.required_skills ?? [],
            team: nextTeam,
            poster: nextPoster,
            expires_at: payload.expires_at || post.expires_at,
          } as RecruitmentPost
        })
      )

      toast.success('Recruitment post updated')
    } catch (error: any) {
      console.error('Failed to update recruitment post:', error)
      toast.error(error?.message || 'Unable to update recruitment post')
    } finally {
      setSaving(false)
    }
  }

  const handleClosePost = async () => {
    if (!selectedPost) return
    if (selectedPost.status !== 'open') {
      toast.error('Only open posts can be closed')
      return
    }

    setClosing(true)
    try {
      const closedAt = new Date().toISOString()
      const { error } = await supabase
        .from('recruitment_posts')
        .update({ status: 'closed', expires_at: closedAt, updated_at: closedAt } as never)
        .eq('id', selectedPost.id)

      if (error) throw error

      setPosts((previous) =>
        previous.map((post) =>
          post.id === selectedPost.id
            ? { ...post, status: 'closed', expires_at: closedAt, updated_at: closedAt }
            : post
        )
      )

      setFormState((previous) => ({ ...previous, status: 'closed', expiresAt: isoToLocalInput(closedAt) }))

      toast.success('Post closed')
    } catch (error: any) {
      console.error('Failed to close recruitment post:', error)
      toast.error(error?.message || 'Unable to close recruitment post')
    } finally {
      setClosing(false)
    }
  }

  const handleSearchPoster = async () => {
    if (!selectedPost) return
    const term = posterSearchTerm.trim()
    if (term.length < 2) {
      toast.error('Enter at least 2 characters to search')
      return
    }

    setSearchingPoster(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email')
        .or(`email.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(10)

      if (error) throw error

      const results = data ?? []
      if (results.length === 0) {
        toast.error('No matching users found')
      }
      setPosterResults(results)
    } catch (error: any) {
      console.error('Failed to search users:', error)
      toast.error(error?.message || 'Unable to search users')
    } finally {
      setSearchingPoster(false)
    }
  }

  const handleSelectPoster = (candidate: Pick<UserRow, 'id' | 'name' | 'email'>) => {
    setSelectedPoster(candidate)
    setFormState((previous) => ({ ...previous, postedBy: candidate.id }))
    setPosterResults([])
    toast.success('Poster assigned. Save changes to confirm.')
  }

  const handleResetPoster = () => {
    if (!selectedPost) return
    setSelectedPoster(selectedPost.poster ?? null)
    setFormState((previous) => ({ ...previous, postedBy: selectedPost.posted_by ?? '' }))
    setPosterResults([])
  }

  const handleDelete = async () => {
    if (!selectedPost) return

    if (!window.confirm('Delete this recruitment post? This action cannot be undone.')) {
      return
    }

    try {
      const { error } = await supabase
        .from('recruitment_posts')
        .delete()
        .eq('id', selectedPost.id)

      if (error) throw error

      setPosts((previous) => previous.filter((post) => post.id !== selectedPost.id))
      setSelectedPostId(null)

      toast.success('Recruitment post deleted')
    } catch (error: any) {
      console.error('Failed to delete recruitment post:', error)
      toast.error(error?.message || 'Unable to delete recruitment post')
    }
  }

  const filteredPosts = useMemo(() => {
    if (!searchQuery.trim()) return posts
    const terms = searchQuery.toLowerCase().split(/\s+/)
    return posts.filter((post) => {
      const target = [
        post.team?.name ?? '',
        post.title ?? '',
        post.description ?? '',
        post.poster?.name ?? '',
        post.poster?.email ?? '',
      ]
        .join(' ')
        .toLowerCase()
      return terms.every((term) => target.includes(term))
    })
  }, [posts, searchQuery])

  if (!user || !actorIsAdmin) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">You need elevated administrator access to manage recruitment posts.</p>
      </div>
    )
  }

  const statusBadge = (status: RecruitmentRow['status']) => {
    switch (status) {
      case 'open':
        return 'text-emerald-600'
      case 'closed':
        return 'text-slate-500'
      case 'archived':
        return 'text-slate-400'
      default:
        return 'text-slate-500'
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Administration</p>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Recruitment moderation</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Audit every call for collaborators, keep posts current, and close listings once teams find their members.
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          disabled={refreshing || loading}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[340px,1fr]">
        <section className="card space-y-4">
          <header className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Recruitment posts</h2>
              {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                className="input-field pl-9"
                placeholder="Search by team, author, or keyword"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
              />
            </div>
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : filteredPosts.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No recruitment posts found. Try adjusting your search or create new posts from the team dashboard.
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredPosts.map((post) => (
                <li key={post.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedPostId(post.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      post.id === selectedPostId
                        ? 'border-[var(--accent)] bg-[var(--accent-hover)]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                      <span>{post.title}</span>
                      <span className={`text-xs font-medium ${statusBadge(post.status)}`}>
                        {post.status.charAt(0).toUpperCase() + post.status.slice(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {post.team?.name || 'Unknown team'} · Posted by {post.poster?.name || 'unknown'}
                    </p>
                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">{post.description || 'No description provided'}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-6">
          {!selectedPost ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
              Select a post to review its contents and status.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <header className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Team</p>
                    <h2 className="text-xl font-semibold text-slate-900">{selectedPost.team?.name || 'Unknown team'}</h2>
                    <p className="text-xs text-slate-500">Purpose: {selectedPost.team?.purpose || 'n/a'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 px-3 py-2 text-right text-xs text-slate-500">
                    <p>Posted: {formatDateTime(selectedPost.created_at)}</p>
                    <p>Updated: {formatDateTime(selectedPost.updated_at)}</p>
                  </div>
                </header>

                <div className="grid gap-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Title</label>
                    <input
                      className="input-field mt-1"
                      value={formState.title}
                      onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))}
                      placeholder="What is this team looking for?"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                    <textarea
                      className="input-field mt-1 h-32"
                      value={formState.description}
                      onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))}
                      placeholder="Describe who the team needs, skill requirements, and participation details."
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team</label>
                      <select
                        className="input-field mt-1"
                        value={formState.teamId}
                        onChange={(event) =>
                          setFormState((previous) => ({ ...previous, teamId: event.target.value }))
                        }
                      >
                        <option value="">Select team</option>
                        {teamOptions.map((team) => (
                          <option key={team.id} value={team.id}>
                            {team.name}
                          </option>
                        ))}
                      </select>
                      {loadingTeams && <p className="mt-1 text-xs text-slate-500">Loading teams…</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Required skills</label>
                      <input
                        className="input-field mt-1"
                        value={formState.requiredSkills}
                        onChange={(event) => setFormState((previous) => ({ ...previous, requiredSkills: event.target.value }))}
                        placeholder="Comma separated list"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Positions available</label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        className="input-field mt-1"
                        value={formState.positionsAvailable}
                        onChange={(event) =>
                          setFormState((previous) => ({ ...previous, positionsAvailable: Number(event.target.value) || 1 }))
                        }
                      />
                    </div>
                  </div>

                    <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Posting user</p>
                          <p className="text-sm font-medium text-slate-700">
                            {selectedPoster?.name || 'Unknown user'}
                          </p>
                          <p className="text-xs text-slate-500">{selectedPoster?.email || 'No email available'}</p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleResetPoster}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
                            disabled={!selectedPost?.poster}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr),auto] sm:items-center">
                        <div>
                          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Find user</label>
                          <input
                            className="input-field mt-1"
                            value={posterSearchTerm}
                            onChange={(event) => setPosterSearchTerm(event.target.value)}
                            placeholder="Search by name or email"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={handleSearchPoster}
                          className="btn-secondary inline-flex items-center gap-2"
                          disabled={searchingPoster}
                        >
                          {searchingPoster ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                          Search
                        </button>
                      </div>
                      {posterResults.length > 0 && (
                        <ul className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                          {posterResults.map((candidate) => (
                            <li key={candidate.id} className="flex items-center justify-between gap-2">
                              <div>
                                <p className="font-medium text-slate-800">{candidate.name || 'Unnamed user'}</p>
                                <p className="text-xs text-slate-500">{candidate.email}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleSelectPoster(candidate)}
                                className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)]/30 px-2 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-hover)]"
                              >
                                Assign
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preferred gender</label>
                      <select
                        className="input-field mt-1 capitalize"
                        value={formState.preferredGender}
                        onChange={(event) =>
                          setFormState((previous) => ({
                            ...previous,
                            preferredGender: event.target.value as RecruitmentRow['preferred_gender'],
                          }))
                        }
                      >
                        <option value="any">Any</option>
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Expires at</label>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-slate-500" />
                        <input
                          type="datetime-local"
                          className="input-field"
                          value={formState.expiresAt}
                          onChange={(event) =>
                            setFormState((previous) => ({ ...previous, expiresAt: event.target.value }))
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</label>
                    <select
                      className="input-field mt-1 capitalize"
                      value={formState.status}
                      onChange={(event) =>
                        setFormState((previous) => ({
                          ...previous,
                          status: event.target.value as RecruitmentRow['status'],
                        }))
                      }
                    >
                      <option value="open">Open</option>
                      <option value="closed">Closed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="btn-primary inline-flex items-center gap-2"
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Save changes
                  </button>
                  <button
                    type="button"
                    onClick={handleClosePost}
                    className="btn-secondary inline-flex items-center gap-2"
                    disabled={closing || selectedPost.status !== 'open'}
                  >
                    {closing ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                    Close post
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete post
                  </button>
                </div>

                <div className="rounded-lg bg-slate-50 p-4 text-xs text-slate-500">
                  <p className="font-semibold text-slate-600">Audit log</p>
                  <p>Posted by: {selectedPost.poster?.name || 'Unknown'} ({selectedPost.poster?.email || 'no email'})</p>
                  <p>Post ID: {selectedPost.id}</p>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
