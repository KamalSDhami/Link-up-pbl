import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Search, Users, UserCheck, Plus, TrendingUp, Briefcase } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'

interface Team {
  id: string
  name: string
  description: string | null
  year: number
  member_count: number
  is_full: boolean
  leader_id: string
  purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
  max_size: number
  users?: {
    name: string
    section: string
  }
}

interface DiscoverTeam extends Team {
  joinStatus: 'none' | 'pending' | 'approved' | 'rejected'
  joinRequestId?: string
}

const YEARS = [1, 2, 3, 4]

const PURPOSE_LABELS: Record<Team['purpose'], string> = {
  hackathon: 'Hackathon',
  college_event: 'College Event',
  pbl: 'Project Based Learning',
  other: 'Other',
}
const SECTIONS = (() => {
  const sections = []
  for (let letter = 65; letter <= 90; letter++) { // A-Z
    for (let num = 1; num <= 2; num++) {
      sections.push(`${String.fromCharCode(letter)}${num}`)
    }
  }
  return sections
})()

export default function TeamsPage() {
  const { user } = useAuthStore()
  const [teams, setTeams] = useState<Team[]>([])
  const [discoverTeams, setDiscoverTeams] = useState<DiscoverTeam[]>([])
  const [activeTab, setActiveTab] = useState<'my' | 'discover'>('my')
  const [myTeamsLoading, setMyTeamsLoading] = useState(true)
  const [discoverLoading, setDiscoverLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [filters, setFilters] = useState({
    year: '',
    section: '',
    showFull: true,
  })

  const loadMyTeams = useCallback(async () => {
    setMyTeamsLoading(true)
    try {
      if (!user?.id) {
        setTeams([])
        return
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)

      if (membershipError) throw membershipError

      const teamIds = membershipData?.map((member: any) => member.team_id) || []

      if (teamIds.length === 0) {
        setTeams([])
        return
      }

      let query = supabase
        .from('teams')
        .select('*')
        .in('id', teamIds)
        .order('created_at', { ascending: false })

      if (filters.year) {
        query = query.eq('year', parseInt(filters.year))
      }

      if (!filters.showFull) {
        query = query.eq('is_full', false)
      }

      const { data: teamsData, error: teamsError } = await query

      if (teamsError) throw teamsError

      const leaderIds = [...new Set(teamsData.map((team: any) => team.leader_id))]

      let leadersData: any[] = []
      if (leaderIds.length) {
        const { data, error: leadersError } = await supabase
          .from('users')
          .select('id, name, section')
          .in('id', leaderIds)

        if (leadersError) throw leadersError
        leadersData = data ?? []
      }

      const leadersMap = new Map(leadersData.map((leader: any) => [leader.id, leader]))

      const teamsWithLeaders = teamsData.map((team: any) => ({
        ...team,
        users: leadersMap.get(team.leader_id) ?? null,
      }))

      let filteredData = teamsWithLeaders
      if (filters.section) {
        filteredData = filteredData.filter(
          (team) => team.users?.section === filters.section
        )
      }

      setTeams(filteredData)
    } catch (error: any) {
      console.error('Error loading teams:', error)
      toast.error('Failed to load teams')
    } finally {
      setMyTeamsLoading(false)
    }
  }, [filters, user?.id])

  const loadDiscoverTeams = useCallback(async () => {
    setDiscoverLoading(true)
    try {
      if (!user?.id) {
        setDiscoverTeams([])
        return
      }

      const { data: membershipData, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id')
        .eq('user_id', user.id)

      if (membershipError) throw membershipError

      const myTeamIds = new Set(
        (membershipData || []).map((member: any) => member.team_id as string)
      )

      const { data: joinRequestRows, error: joinRequestsError } = await supabase
        .from('team_join_requests')
        .select('id, team_id, status')
        .eq('requester_id', user.id)

      if (joinRequestsError) throw joinRequestsError

      let query = supabase
        .from('teams')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100)

      if (filters.year) {
        query = query.eq('year', parseInt(filters.year))
      }

      if (!filters.showFull) {
        query = query.eq('is_full', false)
      }

      const { data: teamsData, error: teamsError } = await query

      if (teamsError) throw teamsError

      const discoverCandidates = (teamsData || []).filter(
        (team: any) => !myTeamIds.has(team.id)
      )

      if (discoverCandidates.length === 0) {
        setDiscoverTeams([])
        return
      }

      const leaderIds = [...new Set(discoverCandidates.map((team: any) => team.leader_id))]

      let leadersData: any[] = []
      if (leaderIds.length) {
        const { data, error: leadersError } = await supabase
          .from('users')
          .select('id, name, section')
          .in('id', leaderIds)

        if (leadersError) throw leadersError
        leadersData = data ?? []
      }

      const leadersMap = new Map(leadersData.map((leader: any) => [leader.id, leader]))
      const statusMap = new Map(
        (joinRequestRows || []).map((row: any) => [row.team_id, row.status as DiscoverTeam['joinStatus']])
      )
      const requestIdMap = new Map(
        (joinRequestRows || []).map((row: any) => [row.team_id, row.id as string])
      )

      let teamsWithMeta: DiscoverTeam[] = discoverCandidates.map((team: any) => ({
        ...team,
        users: leadersMap.get(team.leader_id) ?? null,
        joinStatus: statusMap.get(team.id) ?? 'none',
        joinRequestId: requestIdMap.get(team.id),
      }))

      if (filters.section) {
        teamsWithMeta = teamsWithMeta.filter(
          (team) => team.users?.section === filters.section
        )
      }

      setDiscoverTeams(teamsWithMeta)
    } catch (error: any) {
      console.error('Error loading discoverable teams:', error)
      toast.error('Failed to load available teams')
    } finally {
      setDiscoverLoading(false)
    }
  }, [filters, user?.id])

  useEffect(() => {
    loadMyTeams()
  }, [loadMyTeams])

  useEffect(() => {
    loadDiscoverTeams()
  }, [loadDiscoverTeams])

  const filteredMyTeams = useMemo(
    () =>
      teams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          team.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [teams, searchQuery]
  )

  const filteredDiscoverTeams = useMemo(
    () =>
      discoverTeams.filter(
        (team) =>
          team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          team.description?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    [discoverTeams, searchQuery]
  )

  const teamsToRender = activeTab === 'discover' ? filteredDiscoverTeams : filteredMyTeams
  const activeLoading = activeTab === 'discover' ? discoverLoading : myTeamsLoading

  const tabButtonClass = (tab: 'my' | 'discover') =>
    `px-4 py-2 text-sm font-semibold rounded-md transition-all ${
      activeTab === tab
        ? 'bg-white text-slate-900 shadow'
        : 'text-slate-600 hover:text-slate-900'
    }`

  const getJoinStatusMeta = (status: DiscoverTeam['joinStatus']) => {
    switch (status) {
      case 'pending':
        return { label: 'Request pending', className: 'bg-amber-100 text-amber-700' }
      case 'approved':
        return { label: 'Approved', className: 'bg-emerald-100 text-emerald-700' }
      case 'rejected':
        return { label: 'Request rejected', className: 'bg-red-100 text-red-700' }
      default:
        return null
    }
  }

  const heading = activeTab === 'discover' ? 'Find Teammates' : 'Browse Teams'
  const subheading =
    activeTab === 'discover'
      ? 'Explore teams looking for members and send a request to join'
      : 'Find the perfect team for your next project'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900 mb-2">{heading}</h1>
          <p className="text-slate-600">{subheading}</p>
        </div>
        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1 shadow-inner">
            <button
              type="button"
              onClick={() => setActiveTab('my')}
              className={tabButtonClass('my')}
            >
              My Teams
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('discover')}
              className={tabButtonClass('discover')}
            >
              Find Teammates
            </button>
          </div>
          <Link to="/teams/create" className="btn-primary whitespace-nowrap">
            <Plus className="w-5 h-5 mr-2" />
            Create Team
          </Link>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Search */}
          <div className="lg:col-span-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search teams..."
                className="input-field pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Year Filter */}
          <div>
            <select
              className="input-field"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: e.target.value })}
            >
              <option value="">All Years</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  Year {year}
                </option>
              ))}
            </select>
          </div>

          {/* Section Filter */}
          <div>
            <select
              className="input-field"
              value={filters.section}
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
            >
              <option value="">All Sections</option>
              {SECTIONS.map((section) => (
                <option key={section} value={section}>
                  Section {section}
                </option>
              ))}
            </select>
          </div>

          {/* Show Full Teams Toggle */}
          <div>
            <label className="flex items-center gap-2 cursor-pointer h-full px-4 py-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
              <input
                type="checkbox"
                checked={filters.showFull}
                onChange={(e) =>
                  setFilters({ ...filters, showFull: e.target.checked })
                }
                className="w-4 h-4 text-primary-600 rounded"
              />
              <span className="text-sm text-slate-700">Show Full Teams</span>
            </label>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex items-center gap-4 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4" />
          <span>{teamsToRender.length} teams found</span>
        </div>
        {filters.year && (
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full">
            Year {filters.year}
          </span>
        )}
        {filters.section && (
          <span className="px-3 py-1 bg-primary-100 text-primary-700 rounded-full">
            Section {filters.section}
          </span>
        )}
        {!filters.showFull && (
          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full">
            Available only
          </span>
        )}
      </div>

      {/* Teams Grid */}
      {activeLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card animate-pulse">
              <div className="h-6 bg-slate-200 rounded w-3/4 mb-3"></div>
              <div className="h-4 bg-slate-200 rounded w-full mb-2"></div>
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
            </div>
          ))}
        </div>
      ) : teamsToRender.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-slate-900 mb-2">No teams found</h3>
          <p className="text-slate-600 mb-6">
            {searchQuery || filters.year || filters.section
              ? 'Try adjusting your search filters'
              : activeTab === 'discover'
                ? 'No eligible teams are currently available.'
                : 'You have not joined any teams yet.'}
          </p>
          {activeTab === 'discover' ? (
            <Link to="/recruitment" className="btn-outline inline-flex items-center justify-center gap-2">
              <Search className="w-5 h-5" />
              Browse recruitment posts
            </Link>
          ) : (
            <Link to="/teams/create" className="btn-primary inline-flex">
              <Plus className="w-5 h-5 mr-2" />
              Create Team
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamsToRender.map((team) => {
            const isDiscoverCard = activeTab === 'discover'
            const discoverMeta = isDiscoverCard ? (team as DiscoverTeam) : null
            const joinStatusMeta = discoverMeta ? getJoinStatusMeta(discoverMeta.joinStatus) : null

            return (
              <div key={team.id} className="card hover:shadow-xl transition-all">
                {/* Team Header */}
                <div className="flex items-start justify-between mb-3">
                  <h3 className="text-lg font-display font-bold text-slate-900">
                    {team.name}
                  </h3>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      team.is_full
                        ? 'bg-red-100 text-red-700'
                        : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {team.is_full ? 'Full' : 'Open'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-slate-600 text-sm mb-4 line-clamp-2">
                  {team.description || 'No description provided'}
                </p>

                {/* Team Info */}
                <div className="flex items-center gap-4 text-sm text-slate-600 mb-4">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>
                      {team.member_count}/{team.max_size} members
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Briefcase className="w-4 h-4" />
                    <span>{PURPOSE_LABELS[team.purpose]}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-medium">Year {team.year}</span>
                  </div>
                </div>

                {/* Leader Info */}
                <div className="flex items-center gap-2 pt-4 border-t border-slate-100">
                  <UserCheck className="w-4 h-4 text-primary-600" />
                  <span className="text-sm text-slate-700">
                    Led by{' '}
                    <span className="font-medium">{team.users?.name}</span>
                    {team.users?.section && (
                      <span className="text-slate-500">
                        {' '}
                        · Section {team.users.section}
                      </span>
                    )}
                  </span>
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <Link
                    to={`/teams/${team.id}`}
                    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold rounded-md transition ${
                      isDiscoverCard && discoverMeta?.joinStatus === 'none'
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'border border-slate-200 text-slate-700 hover:border-primary-300 hover:text-primary-700'
                    }`}
                  >
                    {isDiscoverCard && discoverMeta?.joinStatus === 'none'
                      ? 'View & apply'
                      : 'View team'}
                  </Link>
                  {joinStatusMeta && (
                    <span className={`inline-flex items-center justify-center rounded-full px-3 py-1 text-xs font-medium ${joinStatusMeta.className}`}>
                      {joinStatusMeta.label}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

