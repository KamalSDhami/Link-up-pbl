import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Crown,
  Loader2,
  RefreshCcw,
  Save,
  Trash2,
  UserMinus,
  UserPlus,
  Users as UsersIcon,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

const TEAM_PURPOSE_OPTIONS: TableRow<'teams'>['purpose'][] = ['pbl', 'hackathon', 'college_event', 'other']
const TEAM_YEAR_OPTIONS = [1, 2, 3, 4] as const

type TeamRow = TableRow<'teams'>
type UserRow = TableRow<'users'>

type TeamMemberEntry = {
  id: string
  joined_at: string | null
  user: Pick<UserRow, 'id' | 'name' | 'email' | 'role'> | null
}

type TeamWithMembers = TeamRow & {
  leader: Pick<UserRow, 'id' | 'name' | 'email'> | null
  team_members: TeamMemberEntry[]
}

type TeamFormState = {
  name: string
  description: string
  purpose: TeamRow['purpose']
  max_size: number
  is_full: boolean
  year: number
}

const defaultTeamForm: TeamFormState = {
  name: '',
  description: '',
  purpose: 'pbl',
  max_size: 4,
  is_full: false,
  year: 1,
}

export default function AdminTeamsPage() {
  const { user } = useAuthStore()
  const actorRole = user?.role ?? 'student'
  const actorIsAdmin = actorRole === 'super_admin' || actorRole === 'god'

  const [teams, setTeams] = useState<TeamWithMembers[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null)
  const [teamForm, setTeamForm] = useState<TeamFormState>(defaultTeamForm)
  const [savingInfo, setSavingInfo] = useState(false)
  const [changingLeader, setChangingLeader] = useState(false)
  const [newLeaderId, setNewLeaderId] = useState('')
  const [removingMemberId, setRemovingMemberId] = useState<string | null>(null)
  const [memberSearchTerm, setMemberSearchTerm] = useState('')
  const [memberSearchResults, setMemberSearchResults] = useState<Pick<UserRow, 'id' | 'name' | 'email' | 'role'>[]>([])
  const [searchingMembers, setSearchingMembers] = useState(false)
  const [addingMemberId, setAddingMemberId] = useState<string | null>(null)
  const [deletingTeam, setDeletingTeam] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')

  useEffect(() => {
    if (!actorIsAdmin) return
    loadTeams()
  }, [actorIsAdmin])

  useEffect(() => {
    if (!selectedTeamId && teams.length > 0) {
      setSelectedTeamId(teams[0].id)
    }
  }, [teams, selectedTeamId])

  const selectedTeam = useMemo(
    () => teams.find((team) => team.id === selectedTeamId) ?? null,
    [teams, selectedTeamId]
  )

  useEffect(() => {
    if (!selectedTeam) {
      setTeamForm(defaultTeamForm)
      setNewLeaderId('')
      return
    }

    setTeamForm({
      name: selectedTeam.name ?? '',
      description: selectedTeam.description ?? '',
      purpose: selectedTeam.purpose ?? 'pbl',
      max_size: selectedTeam.max_size ?? 4,
      is_full: Boolean(selectedTeam.is_full),
      year: selectedTeam.year ?? 1,
    })
    setNewLeaderId(selectedTeam.leader_id ?? '')
    setMemberSearchResults([])
    setMemberSearchTerm('')
  }, [selectedTeam])

  const loadTeams = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('teams')
        .select(`
          id,
          name,
          description,
          purpose,
          year,
          leader_id,
          max_size,
          is_full,
          member_count,
          created_at,
          updated_at,
          team_members (
            id,
            joined_at,
            user:users ( id, name, email, role )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      // Fetch leader information separately
      const teamsData = data as any[] ?? []
      const leaderIds = teamsData.map((team: any) => team.leader_id).filter(Boolean)
      const { data: leaders } = await supabase
        .from('users')
        .select('id, name, email')
        .in('id', leaderIds)

      const leadersMap = new Map((leaders ?? []).map((leader: any) => [leader.id, leader]))

      const normalized: TeamWithMembers[] = teamsData.map((entry: any) => ({
        ...entry,
        leader: entry.leader_id ? leadersMap.get(entry.leader_id) ?? null : null,
        team_members: (entry.team_members ?? []).filter(Boolean) as TeamMemberEntry[],
      }))

      setTeams(normalized)
    } catch (error: any) {
      console.error('Failed to load teams:', error)
      toast.error(error?.message || 'Unable to load teams')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadTeams()
  }

  const handleUpdateTeamInfo = async () => {
    if (!selectedTeam) return
    if (!teamForm.name.trim()) {
      toast.error('Team name cannot be empty')
      return
    }

    setSavingInfo(true)
    try {
      const payload = {
        name: teamForm.name.trim(),
        description: teamForm.description.trim() || null,
        purpose: teamForm.purpose,
        max_size: Math.max(1, teamForm.max_size),
        is_full: teamForm.is_full,
        year: Math.min(4, Math.max(1, teamForm.year)),
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase
        .from('teams')
        .update(payload as never)
        .eq('id', selectedTeam.id)

      if (error) throw error

      setTeams((previous) =>
        previous.map((team) =>
          team.id === selectedTeam.id
            ? { ...team, ...payload }
            : team
        )
      )

      toast.success('Team details updated')
    } catch (error: any) {
      console.error('Failed to update team:', error)
      toast.error(error?.message || 'Unable to update team')
    } finally {
      setSavingInfo(false)
    }
  }

  const handleChangeLeader = async () => {
    if (!selectedTeam) return
    if (!newLeaderId) {
      toast.error('Select a member to assign as leader')
      return
    }

    if (!selectedTeam.team_members.some((member) => member.user?.id === newLeaderId)) {
      toast.error('Leader must be an existing team member')
      return
    }

    setChangingLeader(true)
    try {
      const { error } = await supabase
        .from('teams')
        .update({ leader_id: newLeaderId, updated_at: new Date().toISOString() } as never)
        .eq('id', selectedTeam.id)

      if (error) throw error

      const nextLeader = selectedTeam.team_members.find((entry) => entry.user?.id === newLeaderId)?.user ?? null

      setTeams((previous) =>
        previous.map((team) =>
          team.id === selectedTeam.id
            ? { ...team, leader_id: newLeaderId, leader: nextLeader }
            : team
        )
      )

      toast.success('Team leader updated')
    } catch (error: any) {
      console.error('Failed to update leader:', error)
      toast.error(error?.message || 'Unable to update leader')
    } finally {
      setChangingLeader(false)
    }
  }

  const openDeleteModal = () => {
    if (!selectedTeam) return
    setDeleteConfirmation('')
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    setShowDeleteModal(false)
    setDeleteConfirmation('')
    setDeletingTeam(false)
  }

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return
    if (deleteConfirmation.trim().toUpperCase() !== 'DELETE') {
      toast.error('Type DELETE to confirm removal')
      return
    }

    setDeletingTeam(true)
    try {
      const teamId = selectedTeam.id

      // Use RPC function to delete team (bypasses RLS and handles constraints)
      const { error } = await (supabase.rpc as any)('admin_delete_team', {
        p_team_id: teamId
      })

      if (error) {
        console.error('RPC delete failed:', error)
        throw new Error(error.message)
      }

      setTeams((previous) => {
        const filtered = previous.filter((team) => team.id !== teamId)
        setSelectedTeamId((previousId) => {
          if (previousId !== teamId) return previousId
          return filtered.length > 0 ? filtered[0].id : null
        })
        return filtered
      })
      toast.success('Team deleted successfully')
      closeDeleteModal()
    } catch (error: any) {
      console.error('Failed to delete team:', error)
      toast.error(error?.message || 'Unable to delete team')
    } finally {
      setDeletingTeam(false)
    }
  }

  const handleRemoveMember = async (membershipId: string) => {
    if (!selectedTeam) return
    const membership = selectedTeam.team_members.find((entry) => entry.id === membershipId)
    if (!membership?.user) {
      toast.error('Member record not found')
      return
    }

    if (membership.user.id === selectedTeam.leader_id) {
      toast.error('Assign a new leader before removing the current one')
      return
    }

    setRemovingMemberId(membershipId)
    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', membershipId)

      if (error) throw error

      setTeams((previous) =>
        previous.map((team) => {
          if (team.id !== selectedTeam.id) return team

          const nextCount = Math.max(0, (team.member_count ?? 0) - 1)
          const maxSize = team.max_size ?? nextCount

          return {
            ...team,
            member_count: nextCount,
            is_full: nextCount >= maxSize,
            team_members: team.team_members.filter((entry) => entry.id !== membershipId),
          }
        })
      )

      toast.success('Member removed from team')
    } catch (error: any) {
      console.error('Failed to remove member:', error)
      toast.error(error?.message || 'Unable to remove member')
    } finally {
      setRemovingMemberId(null)
    }
  }

  const handleSearchMembers = async () => {
    if (!selectedTeam) return
    const term = memberSearchTerm.trim()
    if (term.length < 2) {
      toast.error('Enter at least 2 characters to search')
      return
    }

    setSearchingMembers(true)
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, role')
        .or(`email.ilike.%${term}%,name.ilike.%${term}%`)
        .limit(10)

      if (error) throw error

      const existingMemberIds = new Set((selectedTeam.team_members ?? []).map((member) => member.user?.id).filter(Boolean))

      const filtered = (data as any[] ?? []).filter((candidate: any) => !existingMemberIds.has(candidate.id))
      setMemberSearchResults(filtered)

      if ((data ?? []).length === 0) {
        toast.error('No users found for that search')
      }
    } catch (error: any) {
      console.error('Failed to search users:', error)
      toast.error(error?.message || 'Unable to search users')
    } finally {
      setSearchingMembers(false)
    }
  }

  const handleAddMember = async (userId: string) => {
    if (!selectedTeam) return

    const currentCount = selectedTeam.member_count ?? 0
    const maxAllowed = selectedTeam.max_size ?? Number.POSITIVE_INFINITY
    if (currentCount >= maxAllowed) {
      toast.error('Increase the team size before adding more members')
      return
    }

    setAddingMemberId(userId)
    try {
      const { data, error } = await supabase
        .from('team_members')
        .insert({ team_id: selectedTeam.id, user_id: userId } as any)
        .select(`
          id,
          joined_at,
          user:users ( id, name, email, role )
        `)
        .single()

      if (error) throw error

      if (!(data as any)?.user) {
        toast.success('Member added')
        await loadTeams()
        return
      }

      setTeams((previous) =>
        previous.map((team) => {
          if (team.id !== selectedTeam.id) return team

          const nextCount = (team.member_count ?? 0) + 1
          const maxSize = team.max_size ?? nextCount

          return {
            ...team,
            member_count: nextCount,
            is_full: nextCount >= maxSize,
            team_members: [...team.team_members, data as TeamMemberEntry],
          }
        })
      )

      setMemberSearchResults((previous) => previous.filter((candidate) => candidate.id !== userId))
      toast.success('Member added to team')
    } catch (error: any) {
      console.error('Failed to add member:', error)
      toast.error(error?.message || 'Unable to add member')
    } finally {
      setAddingMemberId(null)
    }
  }

  if (!user || !actorIsAdmin) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">You need elevated administrator access to manage teams.</p>
      </div>
    )
  }

  const memberOptions = selectedTeam?.team_members.filter((entry) => Boolean(entry.user)) ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Administration</p>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Group management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Review every team, adjust rosters, and keep project leadership accurate across the platform.
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

      <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
        <section className="card space-y-4">
          <header className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Teams</h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-slate-400" />}
          </header>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : teams.length === 0 ? (
            <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
              No teams found. Teams will appear here as students create them.
            </p>
          ) : (
            <ul className="space-y-2">
              {teams.map((team) => (
                <li key={team.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedTeamId(team.id)}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      team.id === selectedTeamId
                        ? 'border-[var(--accent)] bg-[var(--accent-hover)]'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                      <span>{team.name || 'Untitled team'}</span>
                      <span className="text-xs font-medium text-slate-500">{team.member_count ?? 0} members</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Purpose: {team.purpose?.replace(/_/g, ' ') ?? 'n/a'} · Leader: {team.leader?.name || 'Unassigned'}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card space-y-6">
          {!selectedTeam ? (
            <div className="flex min-h-[240px] items-center justify-center text-sm text-slate-500">
              Select a team to manage its details.
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <header className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <UsersIcon className="h-5 w-5 text-[var(--accent)]" />
                    <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Team details</h2>
                  </div>
                  <button
                    type="button"
                    onClick={openDeleteModal}
                    className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:border-red-300 hover:text-red-700"
                    disabled={deletingTeam}
                  >
                    {deletingTeam ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete team
                  </button>
                </header>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Team name</label>
                    <input
                      className="input-field mt-1"
                      value={teamForm.name}
                      onChange={(event) => setTeamForm((previous) => ({ ...previous, name: event.target.value }))}
                      placeholder="Enter team name"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</label>
                    <textarea
                      className="input-field mt-1 h-24 resize-none"
                      value={teamForm.description}
                      onChange={(event) => setTeamForm((previous) => ({ ...previous, description: event.target.value }))}
                      placeholder="What is this team working on?"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Purpose</label>
                    <select
                      className="input-field mt-1"
                      value={teamForm.purpose}
                      onChange={(event) =>
                        setTeamForm((previous) => ({ ...previous, purpose: event.target.value as TeamRow['purpose'] }))
                      }
                    >
                      {TEAM_PURPOSE_OPTIONS.map((option) => (
                        <option key={option} value={option} className="capitalize">
                          {option.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Year</label>
                    <select
                      className="input-field mt-1"
                      value={teamForm.year}
                      onChange={(event) =>
                        setTeamForm((previous) => ({ ...previous, year: Number(event.target.value) || previous.year }))
                      }
                    >
                      {TEAM_YEAR_OPTIONS.map((year) => (
                        <option key={year} value={year}>
                          Year {year}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Max size</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      className="input-field mt-1"
                      value={teamForm.max_size}
                      onChange={(event) =>
                        setTeamForm((previous) => ({ ...previous, max_size: Number(event.target.value) || 1 }))
                      }
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      id="team-is-full"
                      type="checkbox"
                      checked={teamForm.is_full}
                      onChange={(event) =>
                        setTeamForm((previous) => ({ ...previous, is_full: event.target.checked }))
                      }
                      className="h-4 w-4 rounded border-slate-300 text-[var(--accent)] focus:ring-[var(--accent)]"
                    />
                    <label htmlFor="team-is-full" className="text-sm text-slate-600">
                      Mark team as full
                    </label>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUpdateTeamInfo}
                  className="btn-primary inline-flex items-center gap-2"
                  disabled={savingInfo}
                >
                  {savingInfo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save changes
                </button>
              </div>

              <div className="space-y-3">
                <header className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-500" />
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Team leader</h2>
                </header>
                <div className="grid gap-3 sm:grid-cols-[minmax(200px,320px),auto]">
                  <select
                    className="input-field"
                    value={newLeaderId}
                    onChange={(event) => setNewLeaderId(event.target.value)}
                  >
                    <option value="">Select leader</option>
                    {memberOptions.map((member) => (
                      <option key={member.id} value={member.user?.id ?? ''}>
                        {member.user?.name || 'Unnamed member'}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleChangeLeader}
                    className="btn-secondary inline-flex items-center gap-2"
                    disabled={changingLeader}
                  >
                    {changingLeader ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                    Update leader
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Leaders can manage their own team. Assigning a new leader updates permissions immediately.
                </p>
              </div>

              <div className="space-y-3">
                <header className="flex items-center gap-2">
                  <UsersIcon className="h-5 w-5 text-[var(--accent)]" />
                  <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Members</h2>
                </header>

                <div className="grid gap-3 rounded-lg border border-slate-200 p-4">
                  <div className="grid gap-2 sm:grid-cols-[minmax(200px,1fr),auto] sm:items-center">
                    <div>
                      <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Find member by name or email</label>
                      <input
                        className="input-field mt-1"
                        value={memberSearchTerm}
                        onChange={(event) => setMemberSearchTerm(event.target.value)}
                        placeholder="Search students to add"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSearchMembers}
                      className="btn-secondary inline-flex items-center gap-2"
                      disabled={searchingMembers}
                    >
                      {searchingMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                      Search
                    </button>
                  </div>
                  {memberSearchResults.length > 0 && (
                    <ul className="space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
                      {memberSearchResults.map((candidate) => (
                        <li key={candidate.id} className="flex items-center justify-between gap-2">
                          <div>
                            <p className="font-medium text-slate-800">{candidate.name || 'Unnamed user'}</p>
                            <p className="text-xs text-slate-500">{candidate.email}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddMember(candidate.id)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[var(--accent)]/30 px-2 py-1 text-xs font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-hover)]"
                            disabled={addingMemberId === candidate.id}
                          >
                            {addingMemberId === candidate.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
                            Add
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {memberOptions.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-500">
                    This team has no members yet.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {memberOptions.map((member) => (
                      <li key={member.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                        <div>
                          <p className="font-medium text-slate-800">{member.user?.name || 'Unnamed member'}</p>
                          <p className="text-xs text-slate-500">{member.user?.email || 'No email on file'}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-red-200 hover:text-red-600"
                          disabled={removingMemberId === member.id}
                        >
                          {removingMemberId === member.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <UserMinus className="h-3.5 w-3.5" />
                          )}
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && selectedTeam && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-[var(--color-surface)] p-6 shadow-2xl border border-[color:var(--color-border)]">
            <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Delete Team</h3>
            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4">
                <p className="text-sm font-semibold text-red-400">This action is permanent.</p>
                <p className="mt-1 text-xs text-red-300/80">
                  Deleting <span className="font-semibold text-red-200">{selectedTeam.name || 'Unnamed team'}</span> will remove all team members and cannot be undone.
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>
                  Type DELETE to confirm
                </label>
                <input
                  value={deleteConfirmation}
                  onChange={(event) => setDeleteConfirmation(event.target.value)}
                  placeholder="DELETE"
                  className="mt-2 w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30"
                  style={{ color: 'var(--text-primary)' }}
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="rounded-xl border border-[color:var(--color-border)] px-4 py-2 text-sm font-semibold transition hover:bg-[var(--accent-hover)]"
                  style={{ color: 'var(--text-secondary)' }}
                  disabled={deletingTeam}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTeam}
                  className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #f87171, #dc2626)' }}
                  disabled={deletingTeam || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
                >
                  {deletingTeam ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  Delete Team
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
