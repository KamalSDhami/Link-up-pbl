import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Users,
  ArrowLeft,
  UserPlus,
  UserMinus,
  Briefcase,
  Plus,
  Crown,
  Trash2,
  CheckCircle2,
  XCircle,
  Settings,
  Save,
  X,
  AlertTriangle,
  Eye,
  EyeOff,
  Mail,
  Search,
  Loader2,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import CreateRecruitmentModal from '@/components/CreateRecruitmentModal'
import { sendNotification } from '@/utils/notifications'
import { ensureTeamChatroom, removeMemberFromTeamChat } from '@/utils/chatrooms'

interface Team {
  id: string
  name: string
  description: string | null
  year: number
  leader_id: string
  purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
  max_size: number
  member_count: number
  is_full: boolean
  created_at: string
}

interface TeamMember {
  id: string
  user_id: string
  joined_at: string
  users: {
    id: string
    name: string
    email: string
    section: string
    year: number
    skills: string[]
    profile_picture_url: string | null
  }
}

interface RecruitmentPost {
  id: string
  title: string
  description: string
  required_skills: string[]
  positions_available: number
  status: 'open' | 'closed' | 'archived'
  created_at: string
}

interface JoinRequest {
  id: string
  team_id: string
  requester_id: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  created_at: string
  reviewed_at: string | null
  users?: {
    id: string
    name: string
    email: string
    section: string
    year: number
    profile_picture_url: string | null
  }
}

interface JoinRequestConflictInfo {
  hasMemberConflict: boolean
  conflictingMemberName: string | null
  conflictingMemberSection: string | null
  conflictingMemberYear: number | null
  hasPendingSameSection: boolean
}

type PendingJoinRequest = JoinRequest & {
  conflictInfo: JoinRequestConflictInfo
}

interface SearchedUser {
  id: string
  name: string
  email: string
  section: string | null
  year: number | null
  profile_picture_url: string | null
}

interface TeamInvitation {
  id: string
  team_id: string
  invited_user_id: string | null
  invited_email: string | null
  status: 'pending' | 'accepted' | 'declined' | 'expired'
  created_at: string
  users?: {
    id: string
    name: string
    email: string
    profile_picture_url: string | null
  } | null
}

const PURPOSE_LABELS: Record<Team['purpose'], string> = {
  hackathon: 'Hackathon',
  college_event: 'College Event',
  pbl: 'Project Based Learning',
  other: 'Other',
}

export default function TeamDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [recruitments, setRecruitments] = useState<RecruitmentPost[]>([])
  const [loading, setLoading] = useState(true)
  const [isMember, setIsMember] = useState(false)
  const [isLeader, setIsLeader] = useState(false)
  const [showRecruitmentModal, setShowRecruitmentModal] = useState(false)
  const [joining, setJoining] = useState(false)
  const [joinRequest, setJoinRequest] = useState<JoinRequest | null>(null)
  const [pendingRequests, setPendingRequests] = useState<PendingJoinRequest[]>([])
  const [processingRequests, setProcessingRequests] = useState<Record<string, 'approve' | 'reject'>>({})
  const [joinMessage, setJoinMessage] = useState('')
  const [settingsDraft, setSettingsDraft] = useState<{ purpose: Team['purpose']; max_size: number } | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [memberPendingRemoval, setMemberPendingRemoval] = useState<TeamMember | null>(null)
  const [removalMessage, setRemovalMessage] = useState('')
  const [removalSubmitting, setRemovalSubmitting] = useState(false)
  const [showConflictRequests, setShowConflictRequests] = useState(false)
  
  // Invite members state
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [inviteSearchTerm, setInviteSearchTerm] = useState('')
  const [inviteSearchResults, setInviteSearchResults] = useState<SearchedUser[]>([])
  const [inviteSearching, setInviteSearching] = useState(false)
  const [sendingInvite, setSendingInvite] = useState<string | null>(null)
  const [pendingInvitations, setPendingInvitations] = useState<TeamInvitation[]>([])

  const normalizeSectionValue = (value?: string | null) => (value ? value.trim().toUpperCase() : null)

  const findMemberConflict = (section?: string | null, year?: number | null) => {
    const normalizedSection = normalizeSectionValue(section)
    if (!normalizedSection) return null

    const normalizedYear = year ?? null
    return (
      members.find((member) => {
        const memberSection = normalizeSectionValue(member.users.section)
        const memberYear = member.users.year ?? null
        return memberSection === normalizedSection && memberYear === normalizedYear
      }) ?? null
    )
  }

  const getExistingTeamId = async (userId: string) => {
    const { data, error } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', userId)
      .maybeSingle<{ team_id: string }>()

    if (error && error.code !== 'PGRST116') {
      throw error
    }

    return data?.team_id ?? null
  }

  useEffect(() => {
    if (id) {
      loadTeamData()
    }
  }, [id, user])

  const loadTeamData = async () => {
    if (!id) return

    setLoading(true)
    try {
      // Load team details
      const { data: teamData, error: teamError } = await supabase
        .from('teams')
        .select('*')
        .eq('id', id)
        .single()

      if (teamError) throw teamError
      const teamRecord = teamData as any
      setTeam(teamData)
      setIsLeader(user?.id === teamRecord.leader_id)
      setSettingsDraft({
        purpose: (teamRecord.purpose ?? 'pbl') as Team['purpose'],
        max_size: Number(teamRecord.max_size ?? 4),
      })

      // Load team members - using explicit foreign key relationship
      console.log('Loading members for team:', id)
      const { data: membersData, error: membersError } = await supabase
        .from('team_members')
        .select(`
          id,
          user_id,
          joined_at,
          users:user_id (
            id,
            name,
            email,
            section,
            year,
            skills,
            profile_picture_url
          )
        `)
        .eq('team_id', id)

      console.log('Members query result:', { membersData, membersError })

  let userIsMember = false
  let sortedMembers: TeamMember[] = []

      if (membersError) {
        console.error('Error loading members:', membersError)
        console.error('Full error details:', JSON.stringify(membersError, null, 2))
        toast.error('Failed to load team members')
        // Don't throw - try to show team at least
        setMembers([])
        setIsMember(false)
      } else {
        console.log('Members loaded successfully:', membersData)
        // Sort manually
        sortedMembers = ((membersData || []) as TeamMember[]).sort((a, b) =>
          new Date(a.joined_at).getTime() - new Date(b.joined_at).getTime()
        )
        userIsMember = sortedMembers.some((member) => member.user_id === user?.id)
        setMembers(sortedMembers)
        setIsMember(userIsMember)

        if (user && user.id === teamRecord.leader_id) {
          const memberIds = sortedMembers.map((member) => member.user_id)
          try {
            await ensureTeamChatroom({
              teamId: teamRecord.id,
              teamName: teamRecord.name,
              leaderId: teamRecord.leader_id,
              memberIds,
            })
          } catch (chatError) {
            console.error('Failed to sync team chatroom:', chatError)
          }
        }
      }

      // Load join requests so leaders can approve them and members see pending status
      try {
        const { data: joinRequestsData, error: joinRequestsError } = await supabase
          .from('team_join_requests')
          .select(`
            id,
            team_id,
            requester_id,
            status,
            message,
            created_at,
            reviewed_at,
            users:requester_id (
              id,
              name,
              email,
              section,
              year,
              profile_picture_url
            )
          `)
          .eq('team_id', id)

        if (joinRequestsError) {
          console.error('Error loading join requests:', joinRequestsError)
          setPendingRequests([])
          setJoinRequest(null)
        } else {
          const requests = (joinRequestsData as unknown as JoinRequest[]) || []
          const rosterForConflicts = sortedMembers.length ? sortedMembers : members
          const pendingWithConflicts: PendingJoinRequest[] = requests
            .filter((request) => request.status === 'pending')
            .map((request) => {
              const requestSection = normalizeSectionValue(request.users?.section)
              const requestYear = request.users?.year ?? null

              const conflictingMember = requestSection
                ? rosterForConflicts.find((member) => {
                    const memberSection = normalizeSectionValue(member.users?.section)
                    const memberYear = member.users?.year ?? null
                    return memberSection === requestSection && memberYear === requestYear
                  })
                : null

              const hasPendingSameSection = requests.some(
                (other) =>
                  other.id !== request.id &&
                  other.status === 'pending' &&
                  normalizeSectionValue(other.users?.section) === requestSection &&
                  (other.users?.year ?? null) === requestYear
              )

              const conflictInfo: JoinRequestConflictInfo = {
                hasMemberConflict: Boolean(conflictingMember),
                conflictingMemberName: conflictingMember?.users?.name ?? null,
                conflictingMemberSection: conflictingMember?.users?.section ?? null,
                conflictingMemberYear: conflictingMember?.users?.year ?? null,
                hasPendingSameSection,
              }

              return {
                ...request,
                conflictInfo,
              }
            })

          setPendingRequests(pendingWithConflicts)
          setShowConflictRequests((previous) =>
            pendingWithConflicts.some((request) => request.conflictInfo.hasMemberConflict) ? previous : false
          )

          if (user && !userIsMember) {
            const currentRequest = requests.find(
              (request) => request.requester_id === user.id
            )
            setJoinRequest(
              currentRequest && currentRequest.status !== 'approved'
                ? currentRequest
                : null
            )
            setJoinMessage(
              currentRequest && currentRequest.status !== 'approved'
                ? currentRequest.message ?? ''
                : ''
            )
          } else {
            setJoinRequest(null)
            setJoinMessage('')
          }
        }
      } catch (joinRequestsCatchError: any) {
        console.warn('Join requests unavailable:', joinRequestsCatchError?.message || joinRequestsCatchError)
        setPendingRequests([])
        setJoinRequest(null)
        setJoinMessage('')
      }

      // Load recruitment posts (optional - don't fail if table doesn't exist)
      try {
        console.log('Loading recruitment posts for team:', id)
        const { data: recruitmentsData, error: recruitmentsError } = await supabase
          .from('recruitment_posts')
          .select('*')
          .eq('team_id', id)

        console.log('Recruitment query result:', { recruitmentsData, recruitmentsError })

        if (!recruitmentsError && recruitmentsData) {
          // Sort manually by created_at desc
          const sortedRecruitments = recruitmentsData.sort((a: any, b: any) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
          setRecruitments(sortedRecruitments)
        } else {
          setRecruitments([])
        }
      } catch (recruitError) {
        console.log('Recruitment posts not available:', recruitError)
        setRecruitments([])
      }
    } catch (error: any) {
      console.error('Error loading team:', error)
      console.error('Full error:', JSON.stringify(error, null, 2))
      
      // Only navigate away if the team itself failed to load
      if (!team) {
        toast.error('Failed to load team details')
        navigate('/teams')
      } else {
        toast.error('Some team data failed to load')
      }
    } finally {
      setLoading(false)
    }
  }

  // Load pending invitations for this team
  const loadPendingInvitations = async () => {
    if (!id || !isLeader) return
    
    try {
      const { data, error } = await supabase
        .from('team_invitations')
        .select(`
          id,
          team_id,
          invited_user_id,
          invited_email,
          status,
          created_at,
          users:invited_user_id (
            id,
            name,
            email,
            profile_picture_url
          )
        `)
        .eq('team_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setPendingInvitations((data as unknown as TeamInvitation[]) || [])
    } catch (error: any) {
      console.error('Failed to load invitations:', error)
    }
  }

  // Search users to invite
  const searchUsersToInvite = async (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) {
      setInviteSearchResults([])
      return
    }

    setInviteSearching(true)
    try {
      const term = searchTerm.trim().toLowerCase()
      
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, section, year, profile_picture_url')
        .or(`name.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(10)
      
      if (error) throw error
      
      // Filter out existing members and users with pending invitations
      const memberIds = new Set(members.map(m => m.user_id))
      const invitedUserIds = new Set(pendingInvitations.map(inv => inv.invited_user_id))
      
      const filtered = (data || []).filter((u: SearchedUser) => 
        !memberIds.has(u.id) && !invitedUserIds.has(u.id) && u.id !== user?.id
      )
      
      setInviteSearchResults(filtered as SearchedUser[])
    } catch (error: any) {
      console.error('Search failed:', error)
      toast.error('Failed to search users')
    } finally {
      setInviteSearching(false)
    }
  }

  // Send invitation to a user
  const handleSendInvite = async (invitedUser: SearchedUser) => {
    if (!team || !user) return
    
    setSendingInvite(invitedUser.id)
    try {
      // Check if user is already a member of another team
      const existingTeamId = await getExistingTeamId(invitedUser.id)
      if (existingTeamId && existingTeamId !== team.id) {
        toast.error(`${invitedUser.name} is already in another team`)
        return
      }
      
      // Create invitation
      const { error: insertError } = await supabase
        .from('team_invitations')
        .insert([{
          team_id: team.id,
          invited_user_id: invitedUser.id,
          invited_by: user.id,
          status: 'pending',
        }] as never)
      
      if (insertError) throw insertError
      
      // Send notification
      await sendNotification({
        userId: invitedUser.id,
        type: 'team_invite',
        title: `Team Invitation`,
        message: `You've been invited to join ${team.name}`,
        link: `/teams/${team.id}`,
      })
      
      toast.success(`Invitation sent to ${invitedUser.name}`)
      
      // Remove from search results
      setInviteSearchResults(prev => prev.filter(u => u.id !== invitedUser.id))
      
      // Reload pending invitations
      await loadPendingInvitations()
    } catch (error: any) {
      console.error('Failed to send invite:', error)
      if (error.code === '23505') {
        toast.error('An invitation has already been sent to this user')
      } else {
        toast.error(error.message || 'Failed to send invitation')
      }
    } finally {
      setSendingInvite(null)
    }
  }

  // Cancel a pending invitation
  const handleCancelInvite = async (invitationId: string) => {
    try {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', invitationId)
      
      if (error) throw error
      
      toast.success('Invitation cancelled')
      setPendingInvitations(prev => prev.filter(inv => inv.id !== invitationId))
    } catch (error: any) {
      console.error('Failed to cancel invite:', error)
      toast.error('Failed to cancel invitation')
    }
  }

  // Load invitations when leader opens modal
  useEffect(() => {
    if (showInviteModal && isLeader && id) {
      loadPendingInvitations()
    }
  }, [showInviteModal, isLeader, id])

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (inviteSearchTerm) {
        searchUsersToInvite(inviteSearchTerm)
      }
    }, 300)
    
    return () => clearTimeout(timeoutId)
  }, [inviteSearchTerm])

  const handleRequestToJoin = async () => {
    if (!user || !team) return

    if (team.is_full || team.member_count >= team.max_size) {
      toast.error('This team is full')
      return
    }

    if (joinRequest?.status === 'pending') {
      toast.error('Your join request is already pending review')
      return
    }

    if (team.purpose === 'pbl') {
      try {
        const { data: pendingPblRequests, error: pendingError } = await supabase
          .from('team_join_requests')
          .select(
            `id, status, team_id, teams:team_id(purpose)`
          )
          .eq('requester_id', user.id)
          .eq('status', 'pending')

        if (pendingError) throw pendingError

        const pendingCount = (pendingPblRequests ?? []).filter(
          (request: any) => request.teams?.purpose === 'pbl' && request.team_id !== team.id
        ).length

        if (pendingCount >= 2) {
          toast.error('You already have two pending PBL team requests.')
          return
        }
      } catch (error: any) {
        console.error('Error checking PBL requests:', error)
        toast.error('Failed to verify request limits. Try again later.')
        return
      }
    }

    const userSection = normalizeSectionValue(user.section)
    const userYear = user.year ?? null

    if (userSection) {
      const conflictingMember = findMemberConflict(user.section, userYear)
      const conflictingPending = pendingRequests.some(
        (request) =>
          request.requester_id !== user.id &&
          normalizeSectionValue(request.users?.section) === userSection &&
          (request.users?.year ?? null) === userYear
      )

      let warningMessage: string | null = null

      if (conflictingMember) {
        warningMessage = `A member from section ${conflictingMember.users.section} (year ${conflictingMember.users.year ?? '-'}) is already part of this team. Do you still want to send a join request?`
      } else if (conflictingPending) {
        warningMessage = `Another student from section ${user.section} already has a pending join request. Do you still want to send yours?`
      }

      if (warningMessage) {
        const proceed = confirm(`${warningMessage}\n\nSelect OK to continue or Cancel to abort.`)
        if (!proceed) {
          return
        }
      }
    }

    setJoining(true)
    try {
      const messageValue = joinMessage.trim() || null

      if (joinRequest && joinRequest.status === 'rejected') {
        const { error: updateError } = await supabase
          .from('team_join_requests')
          // @ts-expect-error - Supabase type definition needs regeneration
          .update({
            status: 'pending',
            reviewed_at: null,
            message: messageValue,
          })
          .eq('id', joinRequest.id)

        if (updateError) throw updateError
      } else {
        const { error: insertError } = await supabase
          .from('team_join_requests')
          // @ts-expect-error - Supabase type definition needs regeneration
          .insert({
            team_id: team.id,
            requester_id: user.id,
            message: messageValue,
          })

        if (insertError) throw insertError
      }

      toast.success(
        joinRequest && joinRequest.status === 'rejected'
          ? 'Join request resubmitted to the team leader'
          : 'Join request sent to the team leader'
      )
      loadTeamData()
    } catch (error: any) {
      console.error('Error requesting to join team:', error)
      const message =
        error?.code === '23505'
          ? 'You already have a pending join request for this team'
          : error.message || 'Failed to send join request'
      toast.error(message)
    } finally {
      setJoining(false)
    }
  }

  const handleLeaveTeam = async () => {
    if (!user || !team || isLeader) return

    if (
      !confirm(
        'Are you sure you want to leave this team? This action cannot be undone.'
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('team_id', team.id)
        .eq('user_id', user.id)

      if (error) throw error

      try {
        await removeMemberFromTeamChat(team.id, user.id)
      } catch (chatError) {
        console.error('Failed to remove user from team chat:', chatError)
      }

      toast.success('You have left the team')
      navigate('/teams')
    } catch (error: any) {
      console.error('Error leaving team:', error)
      toast.error('Failed to leave team')
    }
  }

  const handleApproveRequest = async (request: PendingJoinRequest) => {
    if (!team || !isLeader) return

    if (team.is_full || team.member_count >= team.max_size) {
      toast.error('This team is already at capacity')
      return
    }

    if (request.conflictInfo?.hasMemberConflict) {
      toast.error('Resolve the section conflict before approving this request.')
      return
    }

    setProcessingRequests((state) => ({ ...state, [request.id]: 'approve' }))

    try {
      const existingTeamId = await getExistingTeamId(request.requester_id)

      if (existingTeamId && existingTeamId !== team.id) {
        toast.error('This student already belongs to another team.')
        return
      }

      let membershipAdded = false

      if (!existingTeamId) {
        const { error: memberError } = await supabase
          .from('team_members')
          // @ts-expect-error - Supabase type definition needs regeneration
          .insert([
            {
              team_id: team.id,
              user_id: request.requester_id,
            },
          ])

        if (memberError) throw memberError

        membershipAdded = true
      }

      await supabase
        .from('team_join_requests')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      await sendNotification({
        userId: request.requester_id,
        type: 'team_invite',
        title: 'Join request approved',
        message: `You have been added to ${team.name}.`,
        link: `/teams/${team.id}`,
      })

      if (membershipAdded) {
        try {
          await ensureTeamChatroom({
            teamId: team.id,
            teamName: team.name,
            leaderId: team.leader_id,
            memberIds: [request.requester_id],
          })
        } catch (chatError) {
          console.error('Failed to sync team chat after approval:', chatError)
          toast.error('Member added but team chat is out of sync. Refresh and try again.')
        }

        setTeam((previous) =>
          previous
            ? {
                ...previous,
                member_count: previous.member_count + 1,
                is_full: previous.member_count + 1 >= previous.max_size,
              }
            : previous
        )
      }

      toast.success(`${request.users?.name || 'Member'} added to the team`)
      loadTeamData()
    } catch (error: any) {
      console.error('Error approving join request:', error)
      const message =
        error?.code === '23505'
          ? 'This student already belongs to another team'
          : error.message || 'Failed to approve join request'
      toast.error(message)
    } finally {
      setProcessingRequests((state) => {
        const next = { ...state }
        delete next[request.id]
        return next
      })
    }
  }

  const handleRejectRequest = async (request: PendingJoinRequest) => {
    if (!team || !isLeader) return

    setProcessingRequests((state) => ({ ...state, [request.id]: 'reject' }))

    try {
      const { error } = await supabase
        .from('team_join_requests')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          status: 'rejected',
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) throw error

      toast.success('Join request rejected')
      loadTeamData()
    } catch (error: any) {
      console.error('Error rejecting join request:', error)
      toast.error(error.message || 'Failed to reject request')
    } finally {
      setProcessingRequests((state) => {
        const next = { ...state }
        delete next[request.id]
        return next
      })
    }
  }

  const renderJoinRequestCard = (request: PendingJoinRequest, options: { conflict?: boolean } = {}) => {
    const isConflict = Boolean(options.conflict && request.conflictInfo.hasMemberConflict)
    const approving = processingRequests[request.id] === 'approve'
    const rejecting = processingRequests[request.id] === 'reject'
    const disableApprove = isConflict || approving
    const approveLabel = approving ? 'Approving...' : isConflict ? 'Resolve conflict' : 'Approve'
    const approveTitle = isConflict
      ? 'Another member from this section and year already belongs to the team.'
      : undefined

    return (
      <>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 flex-shrink-0">
              {request.users?.profile_picture_url ? (
                <img
                  src={request.users.profile_picture_url}
                  alt={request.users.name ?? 'Requesting student'}
                  className="h-12 w-12 rounded-full object-cover shadow-sm"
                />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-600">
                  {(request.users?.name ?? 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div>
              <p className="font-medium text-slate-900">{request.users?.name || 'Unknown student'}</p>
              <p className="text-sm text-slate-500">{request.users?.email}</p>
              {request.users?.section && request.users?.year && (
                <p className="text-xs text-slate-500">
                  Year {request.users.year} · Section {request.users.section}
                </p>
              )}
              {request.message && (
                <p className="mt-2 text-sm text-slate-600">"{request.message}"</p>
              )}
            </div>
          </div>
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Requested {new Date(request.created_at).toLocaleDateString()}
          </span>
        </div>

        {request.conflictInfo.hasMemberConflict && (
          <div className="mt-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700 sm:text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Section conflict</p>
              <p>
                {request.conflictInfo.conflictingMemberName || 'A member'} from section
                {' '}
                {request.conflictInfo.conflictingMemberSection ?? '—'}
                {request.conflictInfo.conflictingMemberYear ? ` (year ${request.conflictInfo.conflictingMemberYear})` : ''}{' '}
                is already part of the team. Remove them before approving this request.
              </p>
            </div>
          </div>
        )}

        {!request.conflictInfo.hasMemberConflict && request.conflictInfo.hasPendingSameSection && (
          <div className="mt-3 flex items-center gap-2 text-xs text-amber-600 sm:text-sm">
            <AlertTriangle className="h-4 w-4" />
            Another request from this section is already pending.
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            onClick={() => handleApproveRequest(request)}
            disabled={disableApprove}
            className="btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            title={approveTitle}
          >
            {approveLabel}
            {!approving && !isConflict && <CheckCircle2 className="h-4 w-4" />}
          </button>
          <button
            onClick={() => handleRejectRequest(request)}
            disabled={rejecting}
            className="btn-outline flex items-center gap-2 border-red-300 px-4 py-2 text-sm text-red-600 hover:border-red-400 hover:bg-red-50 disabled:opacity-60"
          >
            {rejecting ? 'Rejecting...' : 'Reject'}
            {!rejecting && <XCircle className="h-4 w-4" />}
          </button>
        </div>
      </>
    )
  }

  const openRemoveMemberModal = (member: TeamMember) => {
    if (!isLeader) return
    setMemberPendingRemoval(member)
    setRemovalMessage('')
  }

  const closeRemoveMemberModal = () => {
    setMemberPendingRemoval(null)
    setRemovalMessage('')
    setRemovalSubmitting(false)
  }

  const handleConfirmRemoveMember = async () => {
    if (!isLeader || !team || !memberPendingRemoval) return

    setRemovalSubmitting(true)
    const note = removalMessage.trim()

    try {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', memberPendingRemoval.id)

      if (error) throw error

      try {
        await removeMemberFromTeamChat(team.id, memberPendingRemoval.user_id)
      } catch (chatError) {
        console.error('Failed to remove member from team chat:', chatError)
      }

      await sendNotification({
        userId: memberPendingRemoval.user_id,
        type: 'team_invite',
        title: `Removed from ${team.name}`,
        message: note || `You have been removed from ${team.name}.`,
        link: `/teams/${team.id}`,
      })

      setTeam((previous) =>
        previous
          ? {
              ...previous,
              member_count: Math.max(previous.member_count - 1, 0),
              is_full: false,
            }
          : previous
      )

      toast.success(`${memberPendingRemoval.users.name} has been removed from the team`)
      await loadTeamData()
    } catch (error: any) {
      console.error('Error removing member:', error)
      toast.error('Failed to remove member')
    } finally {
      setRemovalSubmitting(false)
      closeRemoveMemberModal()
    }
  }

  const handleSaveSettings = async () => {
    if (!team || !isLeader || !settingsDraft) return

    const sanitizedSize = Math.min(10, Math.max(1, Math.round(settingsDraft.max_size)))

    if (sanitizedSize < team.member_count) {
      toast.error(`Team size cannot be smaller than the current member count (${team.member_count}).`)
      return
    }

    const hasChanges =
      sanitizedSize !== team.max_size || settingsDraft.purpose !== team.purpose

    if (!hasChanges) {
      toast('No changes to save')
      return
    }

    setSavingSettings(true)
    try {
      const { error } = await supabase
        .from('teams')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          purpose: settingsDraft.purpose,
          max_size: sanitizedSize,
          is_full: team.member_count >= sanitizedSize,
        })
        .eq('id', team.id)

      if (error) throw error

      toast.success('Team settings updated')
      await loadTeamData()
    } catch (error: any) {
      console.error('Error updating team settings:', error)
      toast.error(error.message || 'Failed to update team settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleDeleteTeam = async () => {
    if (!isLeader || !team) return

    if (
      !confirm(
        `Are you sure you want to delete "${team.name}"? This action cannot be undone and will remove all team data including recruitment posts.`
      )
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('teams')
        .delete()
        .eq('id', team.id)

      if (error) throw error

      toast.success('Team deleted successfully')
      navigate('/teams')
    } catch (error: any) {
      console.error('Error deleting team:', error)
      toast.error('Failed to delete team')
    }
  }

  const handleDeleteRecruitment = async (recruitmentId: string, title: string) => {
    if (!isLeader) return

    if (
      !confirm(`Are you sure you want to delete the recruitment post "${title}"?`)
    ) {
      return
    }

    try {
      const { error } = await supabase
        .from('recruitment_posts')
        .delete()
        .eq('id', recruitmentId)

      if (error) throw error

      toast.success('Recruitment post deleted successfully')
      loadTeamData()
    } catch (error: any) {
      console.error('Error deleting recruitment:', error)
      toast.error('Failed to delete recruitment post')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <h2 className="text-2xl font-bold text-slate-900">Team not found</h2>
        <button
          onClick={() => navigate('/teams')}
          className="text-primary-600 hover:text-primary-700"
        >
          Back to Teams
        </button>
      </div>
    )
  }

  const teamAtCapacity = team.is_full || team.member_count >= team.max_size
  const remainingSlots = Math.max(team.max_size - team.member_count, 0)
  const standardRequests = pendingRequests.filter((request) => !request.conflictInfo.hasMemberConflict)
  const conflictRequests = pendingRequests.filter((request) => request.conflictInfo.hasMemberConflict)

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-8">
      <button
        onClick={() => navigate('/teams')}
        className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="h-5 w-5" />
        Back to Teams
      </button>

      <div className="card">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>
              <span
                className={`badge ${
                  team.is_full ? 'badge-error' : 'badge-success'
                } text-xs uppercase tracking-wide`}
              >
                {team.is_full ? 'Full' : 'Open'}
              </span>
            </div>
            <p className="text-slate-600">
              {team.description || 'No description provided'}
            </p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-slate-600">
              <span className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                {team.member_count}/{team.max_size} members
              </span>
              <span className="flex items-center gap-2">
                <Briefcase className="h-4 w-4" />
                {PURPOSE_LABELS[team.purpose]}
              </span>
              <span>Year {team.year}</span>
              {!teamAtCapacity && (
                <span className="flex items-center gap-2 text-green-600">
                  <UserPlus className="h-4 w-4" />
                  {remainingSlots} spot{remainingSlots === 1 ? '' : 's'} left
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            {!isMember && (
              <div className="flex w-full max-w-sm flex-col gap-3">
                <button
                  onClick={handleRequestToJoin}
                  disabled={joining || teamAtCapacity || joinRequest?.status === 'pending'}
                  className="btn-primary flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {joining ? (
                    <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-white"></div>
                  ) : (
                    <UserPlus className="h-5 w-5" />
                  )}
                  {teamAtCapacity
                    ? 'Team Full'
                    : joinRequest?.status === 'pending'
                      ? 'Request Pending'
                      : joinRequest?.status === 'rejected'
                        ? 'Resubmit Request'
                        : 'Request To Join'}
                </button>
                <div className="space-y-2">
                  <label className="text-xs font-medium uppercase tracking-wide text-slate-600">
                    Message for the team leader
                  </label>
                  <textarea
                    value={joinMessage}
                    onChange={(event) => setJoinMessage(event.target.value)}
                    placeholder="Share why you'd be a great fit…"
                    maxLength={300}
                    disabled={joining || teamAtCapacity || joinRequest?.status === 'pending'}
                    className="min-h-[96px] w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm transition focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Let the leader know what you bring to the team.</span>
                    <span>{joinMessage.length}/300</span>
                  </div>
                </div>
              </div>
            )}

            {isMember && !isLeader && (
              <button
                onClick={handleLeaveTeam}
                className="btn-outline flex items-center gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300"
              >
                <UserMinus className="h-5 w-5" />
                Leave Team
              </button>
            )}

            {isLeader && (
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="btn-primary flex items-center gap-2"
                  disabled={team.is_full}
                >
                  <Mail className="h-5 w-5" />
                  Invite Members
                </button>
                <button
                  onClick={() => setShowRecruitmentModal(true)}
                  className="btn-outline flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" />
                  Post Recruitment
                </button>
                <button
                  onClick={handleDeleteTeam}
                  className="btn-outline flex items-center gap-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                  title="Delete Team"
                >
                  <Trash2 className="h-5 w-5" />
                  Delete Team
                </button>
              </div>
            )}
          </div>
        </div>

        {!isMember && joinRequest?.status === 'pending' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-50 px-4 py-2 text-sm text-primary-700">
            <CheckCircle2 className="h-4 w-4" />
            Waiting for the team leader to review your request.
          </div>
        )}

        {!isMember && joinRequest?.status === 'rejected' && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            <XCircle className="h-4 w-4" />
            Your previous request was declined. Update your profile and try again.
          </div>
        )}

        {teamAtCapacity && !isMember && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm text-slate-600">
            <XCircle className="h-4 w-4" />
            This team is currently full.
          </div>
        )}
      </div>

      {isLeader && settingsDraft && (
        <div className="card space-y-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-slate-900">
              <Settings className="h-5 w-5 text-primary-600" />
              <h2 className="text-lg font-semibold">Team settings</h2>
            </div>
            <button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="btn-primary inline-flex items-center gap-2 self-start sm:self-auto disabled:opacity-60"
            >
              {savingSettings ? (
                'Saving...'
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Save changes
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Team purpose
              </label>
              <select
                value={settingsDraft.purpose}
                onChange={(event) =>
                  setSettingsDraft((prev) => (
                    prev
                      ? { ...prev, purpose: event.target.value as Team['purpose'] }
                      : prev
                  ))
                }
                className="input-field"
                disabled={savingSettings}
              >
                <option value="hackathon">Hackathon</option>
                <option value="college_event">College Event</option>
                <option value="pbl">Project Based Learning</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Team capacity
              </label>
              <input
                type="number"
                min={team.member_count}
                max={10}
                value={settingsDraft.max_size}
                onChange={(event) =>
                  setSettingsDraft((prev) => (
                    prev
                      ? {
                          ...prev,
                          max_size: Number.isNaN(Number(event.target.value))
                            ? prev.max_size
                            : Number(event.target.value),
                        }
                      : prev
                  ))
                }
                className="input-field"
                disabled={savingSettings}
              />
              <p className="mt-1 text-xs text-slate-500">
                Must be between {team.member_count} and 10 members.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <Users className="h-6 w-6" />
              Team Members ({members.length})
            </h2>
            <div className="space-y-4">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12">
                      {member.users.profile_picture_url ? (
                        <img
                          src={member.users.profile_picture_url}
                          alt={member.users.name}
                          className="h-12 w-12 rounded-full object-cover shadow-sm"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-600">
                          {member.users.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-slate-900">{member.users.name}</p>
                        {member.user_id === team.leader_id && (
                          <Crown className="h-4 w-4 text-amber-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600">
                        Year {member.users.year} · Section {member.users.section}
                      </p>
                      {member.users.skills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {member.users.skills.slice(0, 3).map((skill) => (
                            <span
                              key={skill}
                              className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-600"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  {isLeader && member.user_id !== team.leader_id && (
                    <button
                      onClick={() => openRemoveMemberModal(member)}
                      className="rounded-lg border border-red-200 p-2 text-red-600 transition-colors hover:bg-red-50"
                      title="Remove member"
                    >
                      <UserMinus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {isLeader && (
            <div className="card">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
                <UserPlus className="h-6 w-6" />
                Pending Join Requests
              </h2>
              {standardRequests.length === 0 ? (
                <p className="text-sm text-slate-600">
                  {conflictRequests.length
                    ? 'No pending requests without conflicts. Resolve or review the conflict list below.'
                    : 'No pending requests right now.'}
                </p>
              ) : (
                <div className="space-y-4">
                  {standardRequests.map((request) => (
                    <div key={request.id} className="rounded-lg border border-slate-200 p-4">
                      {renderJoinRequestCard(request)}
                    </div>
                  ))}
                </div>
              )}

              {conflictRequests.length > 0 && (
                <div className="mt-6 rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm text-amber-700">
                      <AlertTriangle className="h-4 w-4" />
                      {conflictRequests.length} conflicting request{conflictRequests.length === 1 ? '' : 's'} hidden by default
                    </div>
                    <button
                      onClick={() => setShowConflictRequests((previous) => !previous)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 transition hover:text-amber-800"
                    >
                      {showConflictRequests ? (
                        <>
                          <EyeOff className="h-4 w-4" /> Hide conflicts
                        </>
                      ) : (
                        <>
                          <Eye className="h-4 w-4" /> Show conflicts
                        </>
                      )}
                    </button>
                  </div>

                  {showConflictRequests ? (
                    <div className="mt-4 space-y-4">
                      {conflictRequests.map((request) => (
                        <div key={request.id} className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm">
                          {renderJoinRequestCard(request, { conflict: true })}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm text-amber-700">
                      Conflicting requests stay pending so you can adjust your roster before taking action.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="card">
            <h2 className="mb-6 flex items-center gap-2 text-xl font-bold text-slate-900">
              <Briefcase className="h-6 w-6" />
              Recruitments
            </h2>
            {recruitments.length === 0 ? (
              <div className="py-8 text-center">
                <Briefcase className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                <p className="text-sm text-slate-600">No recruitment posts yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recruitments.map((recruitment) => (
                  <div key={recruitment.id} className="rounded-lg border border-slate-200 p-4">
                    <div className="mb-2 flex items-start justify-between">
                      <Link
                        to={`/recruitment/${recruitment.id}`}
                        className="flex-1 font-medium text-slate-900 transition-colors hover:text-primary-600"
                      >
                        {recruitment.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            recruitment.status === 'open'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {recruitment.status}
                        </span>
                        {isLeader && (
                          <button
                            onClick={(e) => {
                              e.preventDefault()
                              handleDeleteRecruitment(recruitment.id, recruitment.title)
                            }}
                            className="rounded border border-red-200 p-1 text-red-600 transition-colors hover:bg-red-50"
                            title="Delete recruitment post"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                    <Link to={`/recruitment/${recruitment.id}`} className="block">
                      <p className="mb-2 text-sm text-slate-600 line-clamp-2">
                        {recruitment.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {recruitment.positions_available} position(s) available
                      </p>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

        {showRecruitmentModal && (
          <CreateRecruitmentModal
            teamId={team.id}
            onClose={() => setShowRecruitmentModal(false)}
            onSuccess={loadTeamData}
          />
        )}
      </div>

      {memberPendingRemoval && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold">Remove team member</h3>
                <p className="mt-1 text-sm text-slate-300">
                  Removing <span className="font-medium">{memberPendingRemoval.users.name}</span> will revoke their access to team chats and recruitments.
                </p>
              </div>
              <button
                onClick={closeRemoveMemberModal}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close removal dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-slate-200">
                Optional message to the member
              </label>
              <textarea
                value={removalMessage}
                onChange={(event) => setRemovalMessage(event.target.value)}
                placeholder="Explain why they are being removed or leave empty."
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 text-sm text-white placeholder-slate-400 outline-none transition focus:border-red-400 focus:ring-2 focus:ring-red-500/30"
                disabled={removalSubmitting}
              />
              <p className="text-xs text-slate-400">
                They will receive this note in their notification.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={closeRemoveMemberModal}
                disabled={removalSubmitting}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmRemoveMember}
                disabled={removalSubmitting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {removalSubmitting ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-b-2 border-white"></span>
                    Removing…
                  </span>
                ) : (
                  <>
                    <UserMinus className="h-4 w-4" />
                    Remove member
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Members Modal */}
      {showInviteModal && team && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-slate-900/90 p-6 text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-semibold flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary-400" />
                  Invite Members
                </h3>
                <p className="mt-1 text-sm text-slate-300">
                  Search for students to invite to {team.name}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteSearchTerm('')
                  setInviteSearchResults([])
                }}
                className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                aria-label="Close invite modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Search Input */}
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={inviteSearchTerm}
                onChange={(e) => setInviteSearchTerm(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-xl border border-white/10 bg-slate-900/60 pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30"
              />
              {inviteSearching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 animate-spin" />
              )}
            </div>

            {/* Search Results */}
            {inviteSearchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Search Results</p>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {inviteSearchResults.map((searchedUser) => (
                    <div
                      key={searchedUser.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-slate-800/50 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {searchedUser.profile_picture_url ? (
                          <img
                            src={searchedUser.profile_picture_url}
                            alt={searchedUser.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-500/20 text-sm font-semibold text-primary-400">
                            {searchedUser.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{searchedUser.name}</p>
                          <p className="text-xs text-slate-400 truncate">{searchedUser.email}</p>
                          {searchedUser.year && searchedUser.section && (
                            <p className="text-xs text-slate-500">
                              Year {searchedUser.year} · Section {searchedUser.section}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleSendInvite(searchedUser)}
                        disabled={sendingInvite === searchedUser.id}
                        className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-primary-500 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary-400 disabled:opacity-60"
                      >
                        {sendingInvite === searchedUser.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <UserPlus className="h-3 w-3" />
                        )}
                        Invite
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {inviteSearchTerm && !inviteSearching && inviteSearchResults.length === 0 && (
              <div className="mt-4 text-center py-6">
                <Users className="mx-auto h-8 w-8 text-slate-500" />
                <p className="mt-2 text-sm text-slate-400">No users found matching "{inviteSearchTerm}"</p>
              </div>
            )}

            {/* Pending Invitations */}
            {pendingInvitations.length > 0 && (
              <div className="mt-6 space-y-2">
                <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Pending Invitations</p>
                <div className="space-y-2">
                  {pendingInvitations.map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {invitation.users?.profile_picture_url ? (
                          <img
                            src={invitation.users.profile_picture_url}
                            alt={invitation.users.name}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500/20 text-sm font-semibold text-amber-400">
                            {(invitation.users?.name || invitation.invited_email || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">
                            {invitation.users?.name || invitation.invited_email || 'Unknown'}
                          </p>
                          <p className="text-xs text-amber-400">Invitation pending</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleCancelInvite(invitation.id)}
                        className="flex-shrink-0 inline-flex items-center gap-1 rounded-lg border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/10"
                      >
                        <XCircle className="h-3 w-3" />
                        Cancel
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowInviteModal(false)
                  setInviteSearchTerm('')
                  setInviteSearchResults([])
                }}
                className="rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
