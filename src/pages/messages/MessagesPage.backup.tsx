import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js'
import {
  Loader2,
  MessageCircle,
  Send,
  UserPlus,
  UserMinus,
  Users,
  Plus,
  Shield,
  Lock,
  Hash,
  Crown,
  Ban,
  ChevronDown,
  ArrowLeft,
  Info,
  MoreVertical,
  Phone,
  Video,
  Reply,
  Forward,
  Laugh,
  Flag,
  X,
  Check,
  Search,
  LogOut,
  Trash2,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { provisionGroupChatroom } from '@/utils/chatrooms'
import { useAuthStore } from '@/store/authStore'
import { decryptMessage, encryptMessage, hasEncryptionKey } from '@/utils/encryption'
import type { TableInsert, TableRow } from '@/types/database'

type UserRow = TableRow<'users'>
type ChatroomRow = TableRow<'chatrooms'>
type MessageRow = TableRow<'messages'>
type FriendRequestRow = TableRow<'friend_requests'>
type ChatroomRoleRow = TableRow<'chatroom_roles'>
type ChatroomMemberRow = TableRow<'chatroom_members'>
type MessageReactionRow = TableRow<'message_reactions'>
type ContactRow = TableRow<'contacts'>
type BasicUserProfile = {
  id: string
  name: string | null
  email: string | null
  profile_picture_url: string | null
}

interface ChatroomRosterRow {
  chatroom_id: string
  user_id: string
  role: ChatroomRoleRow['role'] | null
  can_post: boolean | null
  can_manage_members: boolean | null
  can_manage_messages: boolean | null
  muted_until: string | null
  name: string | null
  email: string | null
  avatar: string | null
}

interface ConversationOverviewRow {
  chatroom_id: string
  chat_type: ChatroomRow['type']
  chat_name: string | null
  partner_id: string | null
  partner_name: string | null
  partner_email: string | null
  partner_avatar: string | null
  last_message_id: string | null
  last_message_sender_id: string | null
  last_message_content: string | null
  last_message_created_at: string | null
  unread_count: number | null
}
interface UserPreview {
  id: string
  name: string
  email: string
  avatar: string | null
}

interface ChatroomMember extends UserPreview {
  role: ChatroomRoleRow['role']
  canPost: boolean
  canManageMembers: boolean
  canManageMessages: boolean
  mute: { muted_until: string | null } | null
}

interface MessageWithMeta extends MessageRow {
  decryptedContent: string
  sender: UserPreview | null
  reactions: MessageReactionRow[]
}

interface ChatroomWithMeta extends ChatroomRow {
  members: ChatroomMember[]
  adminOnly: boolean
  lastMessage?: MessageWithMeta
  unreadCount: number
}

interface FriendRequestWithUser extends FriendRequestRow {
  peer: UserPreview | null
  direction: 'incoming' | 'outgoing'
}

const REACTIONS = ['👍', '🔥', '🎉', '😂', '❤️', '🙏']

interface FriendWithMeta extends UserPreview {
  contactId: string
}

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export default function MessagesPage() {
  const [searchParams] = useSearchParams()
  const { user } = useAuthStore()

  const [initializing, setInitializing] = useState(true)
  const [chatrooms, setChatrooms] = useState<ChatroomWithMeta[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequestWithUser[]>([])
  const [friends, setFriends] = useState<FriendWithMeta[]>([])
  const [userDirectory, setUserDirectory] = useState<UserPreview[]>([])

  const [selectedChatId, setSelectedChatId] = useState<string | null>(null)
  const [bulkSelectMode, setBulkSelectMode] = useState(false)
  const [selectedChatIds, setSelectedChatIds] = useState<string[]>([])
  const [messages, setMessages] = useState<MessageWithMeta[]>([])
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [composerValue, setComposerValue] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [replyingTo, setReplyingTo] = useState<MessageWithMeta | null>(null)
  const [forwardingMessage, setForwardingMessage] = useState<MessageWithMeta | null>(null)

  const [showCreateDm, setShowCreateDm] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [groupParticipants, setGroupParticipants] = useState<string[]>([])
  const [groupName, setGroupName] = useState('')
  const [conversationSearch, setConversationSearch] = useState('')

  const [selectedUserForDm, setSelectedUserForDm] = useState<string>('')
  const [dmSearchTerm, setDmSearchTerm] = useState('')
  const [groupSearchTerm, setGroupSearchTerm] = useState('')
  const [isSavingFriendRequest, setIsSavingFriendRequest] = useState(false)
  const [friendAction, setFriendAction] = useState<{ userId: string; type: 'chat' | 'remove' } | null>(
    null
  )

  const [forceReload, setForceReload] = useState(0)
  const [showChatDetails, setShowChatDetails] = useState(false)
  const [mobileListOpen, setMobileListOpen] = useState(true)
  const [showHeaderMenu, setShowHeaderMenu] = useState(false)

  const [adminOnlySyncing, setAdminOnlySyncing] = useState(false)
  const [mutingMemberId, setMutingMemberId] = useState<string | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const messageEndRef = useRef<HTMLDivElement | null>(null)
  const messagesRef = useRef<MessageWithMeta[]>([])
  const previewCacheRef = useRef<Map<string, UserPreview>>(new Map())
  const headerMenuRef = useRef<HTMLDivElement | null>(null)

  const selectedChat = useMemo(() => {
    return chatrooms.find((chat) => chat.id === selectedChatId) ?? null
  }, [chatrooms, selectedChatId])

  const selectedChatIdSet = useMemo(() => new Set(selectedChatIds), [selectedChatIds])

  const toggleBulkSelectionMode = useCallback(() => {
    setBulkSelectMode((active) => {
      if (active) {
        setSelectedChatIds([])
      }
      return !active
    })
  }, [])

  const cancelBulkSelection = useCallback(() => {
    setBulkSelectMode(false)
    setSelectedChatIds([])
  }, [])

  const toggleChatSelection = useCallback((chatroomId: string) => {
    setSelectedChatIds((current) => {
      if (current.includes(chatroomId)) {
        return current.filter((id) => id !== chatroomId)
      }
      return [...current, chatroomId]
    })
  }, [])

  useEffect(() => {
    setSelectedChatIds((current) => current.filter((id) => chatrooms.some((room) => room.id === id)))
  }, [chatrooms])

  useEffect(() => {
    if (!selectedChat) return
    selectedChat.members.forEach((member) => {
      previewCacheRef.current.set(member.id, member)
    })
  }, [selectedChat])

  useEffect(() => {
    setShowChatDetails(false)
    setShowHeaderMenu(false)
    if (selectedChatId) {
      setMobileListOpen(false)
    } else {
      setMobileListOpen(true)
    }
  }, [selectedChatId])

  useEffect(() => {
    if (!showHeaderMenu) return

    const handleClickOutside = (event: MouseEvent) => {
      if (!headerMenuRef.current) return
      if (!headerMenuRef.current.contains(event.target as Node)) {
        setShowHeaderMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showHeaderMenu])

  const currentMembership = useMemo(() => {
    if (!selectedChat || !user) return null
    return selectedChat.members.find((member) => member.id === user.id) ?? null
  }, [selectedChat, user])

  const dmPartner = useMemo(() => {
    if (!selectedChat || selectedChat.type !== 'dm' || !user) return null
    return selectedChat.members.find((member) => member.id !== user.id) ?? null
  }, [selectedChat, user])

  const canPost = useMemo(() => {
    if (!currentMembership) return false
    if (!selectedChat?.adminOnly) return true
    return currentMembership.canPost
  }, [currentMembership, selectedChat])

  const isMuted = useMemo(() => {
    if (!currentMembership) return false
    const mutedUntil = currentMembership.mute?.muted_until
    if (!mutedUntil) return false
    return new Date(mutedUntil).getTime() > Date.now()
  }, [currentMembership])

  const dmTargetOptions = useMemo(() => {
    if (!user) return []
    return userDirectory.filter((entry) => entry.id !== user.id)
  }, [userDirectory, user])

  const filteredDmOptions = useMemo(() => {
    const query = dmSearchTerm.trim().toLowerCase()
    if (!query) {
      return dmTargetOptions.slice(0, 25)
    }

    return dmTargetOptions.filter((option) => {
      const nameMatch = option.name?.toLowerCase().includes(query)
      const emailMatch = option.email?.toLowerCase().includes(query)
      return nameMatch || emailMatch
    })
  }, [dmSearchTerm, dmTargetOptions])

  const filteredGroupOptions = useMemo(() => {
    const query = groupSearchTerm.trim().toLowerCase()
    if (!query) {
      return dmTargetOptions.slice(0, 50)
    }

    return dmTargetOptions.filter((option) => {
      const nameMatch = option.name?.toLowerCase().includes(query)
      const emailMatch = option.email?.toLowerCase().includes(query)
      return nameMatch || emailMatch
    })
  }, [dmTargetOptions, groupSearchTerm])

  const selectedDmUser = useMemo(() => {
    if (!selectedUserForDm) return null
    return dmTargetOptions.find((option) => option.id === selectedUserForDm) ?? null
  }, [dmTargetOptions, selectedUserForDm])

  const groupSelectedUsers = useMemo(() => {
    if (!groupParticipants.length) return []
    const directoryMap = new Map(userDirectory.map((entry) => [entry.id, entry]))
    return groupParticipants
      .map((participantId) => directoryMap.get(participantId) ?? null)
      .filter((entry): entry is UserPreview => Boolean(entry))
  }, [groupParticipants, userDirectory])

  const conversationList = useMemo(() => {
    return [...chatrooms].sort((a, b) => {
      const aTime = new Date(a.lastMessage?.created_at ?? a.created_at).getTime()
      const bTime = new Date(b.lastMessage?.created_at ?? b.created_at).getTime()
      return bTime - aTime
    })
  }, [chatrooms])

  const getChatDisplayName = useCallback(
    (room: ChatroomWithMeta) => {
      if (room.name) return room.name

      if (room.type === 'dm') {
        const selfId = user?.id
        if (selfId) {
          const partner = room.members.find((member) => member.id !== selfId)
          if (partner?.name) return partner.name
          if (partner?.email) return partner.email
        }
        return 'Direct message'
      }

      if (room.type === 'team') {
        return 'Team chat'
      }

      if (room.type === 'recruitment') {
        return 'Recruitment chat'
      }

      return 'Group chat'
    },
    [user?.id]
  )

  const resolveChatAvatar = useCallback(
    (room: ChatroomWithMeta) => {
      const displayName = getChatDisplayName(room)

      if (room.type === 'dm') {
        const partner = user
          ? room.members.find((member) => member.id !== user.id)
          : room.members[0] ?? null

        if (partner?.avatar) {
          return {
            kind: 'image' as const,
            src: partner.avatar,
            alt: partner.name ?? partner.email ?? displayName,
          }
        }

        const label = partner?.name?.[0]?.toUpperCase() ?? displayName?.[0]?.toUpperCase() ?? 'C'
        return { kind: 'initial' as const, label }
      }

      const firstOtherAvatar = room.members.find(
        (member) => member.id !== user?.id && member.avatar
      )

      if (firstOtherAvatar?.avatar) {
        return {
          kind: 'image' as const,
          src: firstOtherAvatar.avatar,
          alt: firstOtherAvatar.name ?? displayName,
        }
      }

      const label = displayName?.[0]?.toUpperCase() ?? 'C'
      return room.type === 'group'
        ? ({ kind: 'icon' as const, label })
        : ({ kind: 'initial' as const, label })
    },
    [getChatDisplayName, user]
  )

  const filteredConversations = useMemo(() => {
    const query = conversationSearch.trim().toLowerCase()
    if (!query) return conversationList

    return conversationList.filter((room) => {
      const name = getChatDisplayName(room).toLowerCase()
      const snippet = room.lastMessage?.decryptedContent?.toLowerCase() ?? ''
      return name.includes(query) || snippet.includes(query)
    })
  }, [conversationList, conversationSearch, getChatDisplayName])

  const formatRelative = useCallback((iso: string | null | undefined) => {
    if (!iso) return ''
    const date = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const oneDay = 24 * 60 * 60 * 1000
    if (diff < oneDay) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
    if (diff < 7 * oneDay) {
      return date.toLocaleDateString([], { weekday: 'short' })
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
  }, [])

  const markChatAsRead = useCallback(
    async (chatroomId: string) => {
      if (!user) return

      try {
        await supabase
          .from('chatroom_members')
          .update({ last_read_at: new Date().toISOString() } as never)
          .eq('chatroom_id', chatroomId)
          .eq('user_id', user.id)
      } catch (error) {
        console.error('Failed to update read status:', error)
      }
    },
    [user]
  )

  const handleSelectChat = useCallback(
    (chatroomId: string) => {
      setSelectedChatId(chatroomId)
      setMobileListOpen(false)
      markChatAsRead(chatroomId)
    },
    [markChatAsRead]
  )

  const ensurePreviewForUser = useCallback(
    async (userId: string): Promise<UserPreview | null> => {
      if (!userId) return null

      const cached = previewCacheRef.current.get(userId)
      if (cached) {
        return cached
      }

      const fromSelected = selectedChat?.members.find((member) => member.id === userId)
      if (fromSelected) {
        previewCacheRef.current.set(userId, fromSelected)
        return fromSelected
      }

      const fromDirectory = userDirectory.find((entry) => entry.id === userId)
      if (fromDirectory) {
        const preview: UserPreview = {
          id: fromDirectory.id,
          name: fromDirectory.name,
          email: fromDirectory.email,
          avatar: fromDirectory.avatar,
        }
        previewCacheRef.current.set(userId, preview)
        return preview
      }

      const fromFriends = friends.find((entry) => entry.id === userId)
      if (fromFriends) {
        const preview: UserPreview = {
          id: fromFriends.id,
          name: fromFriends.name,
          email: fromFriends.email,
          avatar: fromFriends.avatar,
        }
        previewCacheRef.current.set(userId, preview)
        return preview
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('id, name, email, profile_picture_url')
          .eq('id', userId)
          .maybeSingle()

        if (error) throw error
    if (!data) return null

    const typed = data as BasicUserProfile

        const preview: UserPreview = {
          id: typed.id,
          name: typed.name ?? 'Unknown user',
          email: typed.email ?? '',
          avatar: typed.profile_picture_url ?? null,
        }
        previewCacheRef.current.set(userId, preview)
        return preview
      } catch (error) {
        console.error('Failed to resolve user preview:', error)
        return null
      }
    },
    [friends, selectedChat, userDirectory]
  )

  const hydrateMessage = useCallback(
    async (row: MessageRow): Promise<MessageWithMeta> => {
      let decryptedContent = ''
      try {
        decryptedContent = await decryptMessage(row.content)
      } catch (error) {
        console.error('Failed to decrypt realtime message payload:', error)
        decryptedContent = 'Unable to decrypt message'
      }

      const sender = await ensurePreviewForUser(row.sender_id)
      const existing = messagesRef.current.find((message) => message.id === row.id)

      return {
        ...row,
        decryptedContent,
        sender,
        reactions: existing?.reactions ?? [],
      }
    },
    [decryptMessage, ensurePreviewForUser]
  )

  const updateChatroomAfterMessage = useCallback(
    (incoming: MessageWithMeta, isActive: boolean, isFromSelf: boolean) => {
      setChatrooms((current) => {
        const index = current.findIndex((room) => room.id === incoming.chatroom_id)
        if (index === -1) {
          return current
        }

        const updated = [...current]
        const target = updated[index]
        const nextUnread = isActive || isFromSelf ? 0 : (target.unreadCount ?? 0) + 1

        updated[index] = {
          ...target,
          lastMessage: incoming,
          unreadCount: nextUnread,
        }

        updated.sort((a, b) => {
          const aTime = new Date(a.lastMessage?.created_at ?? a.created_at).getTime()
          const bTime = new Date(b.lastMessage?.created_at ?? b.created_at).getTime()
          return bTime - aTime
        })

        return updated
      })
    },
    []
  )

  const loadMessages = useCallback(
    async (chatroomId: string) => {
      if (!user) return

      setLoadingMessages(true)
      try {
        const { data: messageRows, error: messageError } = await supabase
          .from('messages')
          .select('*')
          .eq('chatroom_id', chatroomId)
          .order('created_at', { ascending: true })

        if (messageError) throw messageError

        const messageRowsData = (messageRows || []) as MessageRow[]
        const senderIds = Array.from(new Set(messageRowsData.map((row) => row.sender_id)))

        const senderMap = new Map<string, UserPreview>()
        if (senderIds.length) {
          const { data: senderProfiles, error: senderError } = await supabase
            .from('users')
            .select('id, name, email, profile_picture_url')
            .in('id', senderIds)

          if (senderError) throw senderError

          const senderProfileRows = (senderProfiles || []) as Pick<
            UserRow,
            'id' | 'name' | 'email' | 'profile_picture_url'
          >[]
          senderProfileRows.forEach((profile) => {
            const preview: UserPreview = {
              id: profile.id,
              name: profile.name,
              email: profile.email,
              avatar: profile.profile_picture_url,
            }
            senderMap.set(profile.id, preview)
            previewCacheRef.current.set(profile.id, preview)
          })
        }

        const messageIds = messageRowsData.map((row) => row.id)
        let reactions: MessageReactionRow[] = []

        if (messageIds.length) {
          const { data: reactionRows, error: reactionError } = await supabase
            .from('message_reactions')
            .select('*')
            .in('message_id', messageIds)

          if (reactionError) throw reactionError
          reactions = (reactionRows || []) as MessageReactionRow[]
        }

        const decryptedMessages = await Promise.all(
          messageRowsData.map(async (message) => {
            const decryptedContent = await decryptMessage(message.content)
            const sender = senderMap.get(message.sender_id) ?? null
            const messageReactions = reactions.filter((reaction) => reaction.message_id === message.id)

            return {
              ...message,
              decryptedContent,
              sender,
              reactions: messageReactions,
            }
          })
        )

        setMessages(decryptedMessages)
        await markChatAsRead(chatroomId)
      } catch (error: any) {
        console.error('Unable to load messages:', error)
        toast.error(error.message || 'Failed to load messages')
      } finally {
        setLoadingMessages(false)
      }
    },
    [decryptMessage, markChatAsRead, user]
  )

  const loadFriendRequests = useCallback(async () => {
    if (!user) {
      setFriendRequests([])
      return
    }

    try {
      const { data: friendRequestRowsRaw, error } = await supabase
        .from('friend_requests')
        .select('id, status, sender_id, receiver_id, created_at, responded_at, message')
        .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
        .order('created_at', { ascending: false })

      if (error) throw error

      const friendRequestRows = (friendRequestRowsRaw || []) as Pick<
        FriendRequestRow,
        'id' | 'status' | 'sender_id' | 'receiver_id' | 'created_at' | 'responded_at' | 'message'
      >[]

      const pendingRequests = friendRequestRows.filter((request) => request.status === 'pending')
      if (pendingRequests.length === 0) {
        setFriendRequests([])
        return
      }

      const peerIds = new Set<string>()
      pendingRequests.forEach((request) => {
        peerIds.add(request.sender_id === user.id ? request.receiver_id : request.sender_id)
      })

      const peerMap = new Map<string, UserPreview>()
      if (peerIds.size) {
        const { data: peerProfiles, error: peerError } = await supabase
          .from('users')
          .select('id, name, email, profile_picture_url')
          .in('id', Array.from(peerIds))

        if (peerError) throw peerError

        const peerRows = (peerProfiles || []) as Pick<
          UserRow,
          'id' | 'name' | 'email' | 'profile_picture_url'
        >[]

        peerRows.forEach((profile) => {
          peerMap.set(profile.id, {
            id: profile.id,
            name: profile.name,
            email: profile.email,
            avatar: profile.profile_picture_url,
          })
        })
      }

      setFriendRequests(
        pendingRequests.map<FriendRequestWithUser>((request) => ({
          ...request,
          peer:
            peerMap.get(request.sender_id === user.id ? request.receiver_id : request.sender_id) ?? null,
          direction: request.receiver_id === user.id ? 'incoming' : 'outgoing',
        }))
      )
    } catch (error: any) {
      console.error('Failed to load friend requests:', error)
      toast.error(error.message || 'Unable to load friend requests')
    }
  }, [user])

  const loadFriends = useCallback(async () => {
    if (!user) {
      setFriends([])
      return
    }

    const { data: contactRows, error } = await supabase
      .from('contacts')
      .select(
        `id, owner_id, contact_id, users:contact_id (id, name, email, profile_picture_url)`
      )
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) throw error

    const rows = (contactRows || []) as Array<{
      contact_id: string
      owner_id: string
      users: { id: string; name: string; email: string; profile_picture_url: string | null } | null
    }>

    setFriends(
      rows.map((row) => ({
        contactId: row.contact_id,
        id: row.users?.id ?? row.contact_id,
        name: row.users?.name ?? 'Unknown user',
        email: row.users?.email ?? '',
        avatar: row.users?.profile_picture_url ?? null,
      }))
    )
  }, [user])

  const loadChatrooms = useCallback(async () => {
    if (!user) return

    try {
      let attemptedRepair = false

      // Allow one repair iteration if we detect missing memberships
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const [membershipResult, overviewResult] = await Promise.all([
          supabase
            .from('chatroom_members')
            .select('chatroom_id, user_id, last_read_at')
            .eq('user_id', user.id),
          supabase.rpc('get_user_conversations', { p_user_id: user.id } as never),
        ])

        if (membershipResult.error && membershipResult.error.code !== 'PGRST116') {
          throw membershipResult.error
        }

        const membershipData = (membershipResult.data || []) as Pick<
          ChatroomMemberRow,
          'chatroom_id' | 'user_id' | 'last_read_at'
        >[]

        const membershipChatroomIds = new Set<string>(
          membershipData.map((row) => row.chatroom_id)
        )

        let overviewData: ConversationOverviewRow[] = []
        if (overviewResult.error) {
          const missingFn = overviewResult.error.message?.includes('schema cache')
          if (missingFn) {
            console.warn('Conversation overview RPC missing, falling back to basic metadata:', overviewResult.error)
          } else {
            throw overviewResult.error
          }
        } else {
          overviewData = ((overviewResult.data ?? []) as unknown as ConversationOverviewRow[]).filter(
            (row) => Boolean(row?.chatroom_id)
          )
        }

        const chatroomIdSet = new Set<string>()
        membershipChatroomIds.forEach((id) => chatroomIdSet.add(id))
        overviewData.forEach((row) => chatroomIdSet.add(row.chatroom_id))

        const missingDmMemberships = !attemptedRepair
          ? overviewData.filter(
              (row) =>
                row.chat_type === 'dm' &&
                Boolean(row.partner_id) &&
                !membershipChatroomIds.has(row.chatroom_id)
            )
          : []

        if (missingDmMemberships.length) {
          attemptedRepair = true
          const ensureResults = await Promise.allSettled(
            missingDmMemberships.map((row) =>
              supabase.rpc('ensure_dm_chatroom', { partner_id: row.partner_id } as never)
            )
          )

          const repairedCount = ensureResults.filter((entry) => entry.status === 'fulfilled').length
          if (repairedCount === 0) {
            console.warn('DM membership repair failed for current user:', ensureResults)
          }

          // Re-run the loop to pull fresh membership/overview data after repair attempt
          continue
        }

        const chatroomIds = Array.from(chatroomIdSet)

        if (!chatroomIds.length) {
          setChatrooms((current) => {
            if (selectedChatId) {
              const placeholder = current.find((room) => room.id === selectedChatId)
              return placeholder ? [placeholder] : []
            }
            return []
          })
          if (!selectedChatId) {
            setMessages([])
          }
          return
        }

        const [chatroomsResult, rosterResult] = await Promise.all([
          supabase
            .from('chatrooms')
            .select('*')
            .in('id', chatroomIds),
          supabase.rpc('get_chatroom_member_profiles', { p_chatroom_ids: chatroomIds } as never),
        ])

        if (chatroomsResult.error) throw chatroomsResult.error
        if (rosterResult.error) throw rosterResult.error

        const chatroomRows = (chatroomsResult.data || []) as ChatroomRow[]
        const rosterRows = (rosterResult.data || []) as ChatroomRosterRow[]

        const overviewMap = new Map<string, ConversationOverviewRow>()
        overviewData.forEach((row) => {
          overviewMap.set(row.chatroom_id, row)
        })
        const rosterByChatroom = new Map<string, ChatroomRosterRow[]>()
        rosterRows.forEach((row) => {
          const list = rosterByChatroom.get(row.chatroom_id) || []
          list.push(row)
          rosterByChatroom.set(row.chatroom_id, list)
        })

        const chatroomList = await Promise.all(
          chatroomRows.map<Promise<ChatroomWithMeta>>(async (room) => {
            const rosterEntries = rosterByChatroom.get(room.id) || []
            const members = rosterEntries.map<ChatroomMember>((entry) => ({
              id: entry.user_id,
              name: entry.name ?? 'Unknown user',
              email: entry.email ?? '',
              avatar: entry.avatar ?? null,
              role:
                (entry.role as ChatroomRoleRow['role'] | null) ??
                (room.type === 'dm' ? 'member' : entry.user_id === user.id ? 'owner' : 'member'),
              canPost: entry.can_post ?? true,
              canManageMembers: entry.can_manage_members ?? false,
              canManageMessages: entry.can_manage_messages ?? false,
              mute: entry.muted_until ? { muted_until: entry.muted_until } : null,
            }))

            const overview = overviewMap.get(room.id)
            if (overview?.partner_id) {
              const existing = members.find((member) => member.id === overview.partner_id)
              if (existing) {
                existing.avatar = overview.partner_avatar ?? existing.avatar
                existing.name = overview.partner_name ?? existing.name
                existing.email = overview.partner_email ?? existing.email
              } else {
                members.push({
                  id: overview.partner_id,
                  name: overview.partner_name ?? 'Contact',
                  email: overview.partner_email ?? '',
                  avatar: overview.partner_avatar,
                  role: 'member',
                  canPost: true,
                  canManageMembers: false,
                  canManageMessages: false,
                  mute: null,
                })
              }
            }

            const adminOnly = members.some((member) => !member.canPost && member.role !== 'owner' && member.role !== 'admin')

            let lastMessage: MessageWithMeta | undefined
            if (overview?.last_message_id && overview.last_message_content) {
              let decryptedPreview = ''
              try {
                decryptedPreview = await decryptMessage(overview.last_message_content)
              } catch (error) {
                console.error('Failed to decrypt last message preview:', error)
                decryptedPreview = 'New message'
              }

              const sender = members.find((member) => member.id === overview.last_message_sender_id) ?? null

              lastMessage = {
                id: overview.last_message_id,
                chatroom_id: room.id,
                sender_id: overview.last_message_sender_id ?? user.id,
                content: overview.last_message_content,
                decryptedContent: decryptedPreview,
                created_at: overview.last_message_created_at ?? room.created_at,
                edited_at: null,
                deleted: false,
                reply_to_message_id: null,
                forwarded_from_message_id: null,
                sender,
                reactions: [],
              }
            }

            const unreadCount = overview?.unread_count ? Number(overview.unread_count) : 0

            return {
              ...room,
              members,
              adminOnly,
              unreadCount,
              lastMessage,
            }
          })
        )

        const resolvedIds = new Set(chatroomList.map((room) => room.id))
        const fallbackOverviews = Array.from(
          overviewData
            .filter((row) => row.chatroom_id && !resolvedIds.has(row.chatroom_id))
            .reduce((map, row) => {
              if (!row.chatroom_id) return map
              if (!map.has(row.chatroom_id)) {
                map.set(row.chatroom_id, row)
              }
              return map
            }, new Map<string, ConversationOverviewRow>())
            .values()
        )

        if (fallbackOverviews.length) {
          // Ensure conversations still render while memberships are being repaired.
          const fallbackRooms = await Promise.all(
            fallbackOverviews.map(async (overview) => {
              const members: ChatroomMember[] = [
                {
                  id: user.id,
                  name: user.name ?? 'You',
                  email: user.email ?? '',
                  avatar: user.profile_picture_url ?? null,
                  role:
                    (overview.chat_type === 'group' ? 'owner' : 'member') as ChatroomRoleRow['role'],
                  canPost: true,
                  canManageMembers: overview.chat_type === 'group',
                  canManageMessages: overview.chat_type === 'group',
                  mute: null,
                },
              ]

              if (overview.partner_id) {
                members.push({
                  id: overview.partner_id,
                  name: overview.partner_name ?? 'Contact',
                  email: overview.partner_email ?? '',
                  avatar: overview.partner_avatar ?? null,
                  role: 'member' as ChatroomRoleRow['role'],
                  canPost: true,
                  canManageMembers: false,
                  canManageMessages: false,
                  mute: null,
                })
              }

              let lastMessage: MessageWithMeta | undefined
              if (overview.last_message_id && overview.last_message_content) {
                let decryptedPreview = ''
                try {
                  decryptedPreview = await decryptMessage(overview.last_message_content)
                } catch (error) {
                  console.error('Failed to decrypt fallback last message preview:', error)
                  decryptedPreview = 'New message'
                }

                const sender =
                  members.find((member) => member.id === overview.last_message_sender_id) ?? null

                lastMessage = {
                  id: overview.last_message_id,
                  chatroom_id: overview.chatroom_id,
                  sender_id: overview.last_message_sender_id ?? user.id,
                  content: overview.last_message_content,
                  decryptedContent: decryptedPreview,
                  created_at: overview.last_message_created_at ?? new Date().toISOString(),
                  edited_at: null,
                  deleted: false,
                  reply_to_message_id: null,
                  forwarded_from_message_id: null,
                  sender,
                  reactions: [],
                }
              }

              const fallbackCreatedAt =
                overview.last_message_created_at ??
                membershipData.find((entry) => entry.chatroom_id === overview.chatroom_id)?.last_read_at ??
                new Date().toISOString()

              return {
                id: overview.chatroom_id,
                type: ((overview.chat_type ?? 'dm') as ChatroomRow['type']),
                team_id: null,
                recruitment_post_id: null,
                name: overview.chat_name,
                created_at: fallbackCreatedAt,
                archived: false,
                members,
                adminOnly: false,
                unreadCount: overview.unread_count ? Number(overview.unread_count) : 0,
                lastMessage,
              }
            })
          )

          chatroomList.push(...fallbackRooms)
        }

        chatroomList.sort((a, b) => {
          const aTime = new Date(a.lastMessage?.created_at ?? a.created_at).getTime()
          const bTime = new Date(b.lastMessage?.created_at ?? b.created_at).getTime()
          return bTime - aTime
        })

        const hasSelected = selectedChatId
          ? chatroomList.some((room) => room.id === selectedChatId)
          : false

        setChatrooms((current) => {
          if (!selectedChatId) {
            return chatroomList
          }

          if (hasSelected) {
            return chatroomList
          }

          const placeholder = current.find((room) => room.id === selectedChatId)
          if (!placeholder) {
            return chatroomList
          }

          return [placeholder, ...chatroomList.filter((room) => room.id !== placeholder.id)]
        })

        break
      }
    } catch (error: any) {
      console.error('Unable to load chatrooms:', error)
      toast.error(error.message || 'Failed to load chats')
    }
  }, [decryptMessage, selectedChatId, user])

  useEffect(() => {
    if (!user) return

    const loadBootstrap = async () => {
      try {
        const [directoryResult] = await Promise.all([
          supabase
            .from('users')
            .select('id, name, email, profile_picture_url')
            .order('name', { ascending: true })
            .limit(200),
        ])

        if (directoryResult.error) throw directoryResult.error

        const directoryRows = (directoryResult.data || []) as Pick<
          UserRow,
          'id' | 'name' | 'email' | 'profile_picture_url'
        >[]

        const directory = directoryRows.map<UserPreview>((entry) => ({
          id: entry.id,
          name: entry.name,
          email: entry.email,
          avatar: entry.profile_picture_url,
        }))
        setUserDirectory(directory)

        await Promise.all([loadFriendRequests(), loadFriends()])

        await loadChatrooms()

        const preselect = searchParams.get('chat')
        if (preselect) {
          setSelectedChatId(preselect)
        }
      } catch (error: any) {
        console.error('Failed to bootstrap messaging view:', error)
        toast.error(error.message || 'Unable to load messages')
      } finally {
        setInitializing(false)
      }
    }

    loadBootstrap()
  }, [loadChatrooms, loadFriendRequests, loadFriends, searchParams, user, forceReload])

  useEffect(() => {
    if (!selectedChatId) return
    loadMessages(selectedChatId)
  }, [loadMessages, selectedChatId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    if (!user) return

    let chatroomRefreshTimer: ReturnType<typeof setTimeout> | null = null
    let messageRefreshTimer: ReturnType<typeof setTimeout> | null = null

    const queueRefresh = (payload?: RealtimePostgresChangesPayload<MessageRow>) => {
      if (!chatroomRefreshTimer) {
        chatroomRefreshTimer = setTimeout(async () => {
          chatroomRefreshTimer = null
          await loadChatrooms()
        }, 120)
      }

      const chatroomId = (payload?.new as MessageRow | null)?.chatroom_id ??
        (payload?.old as MessageRow | null)?.chatroom_id ??
        null

      if (chatroomId && chatroomId === selectedChatId) {
        if (messageRefreshTimer) return
        messageRefreshTimer = setTimeout(async () => {
          messageRefreshTimer = null
          await loadMessages(chatroomId)
        }, 80)
      }
    }

    const channel = supabase
      .channel(`user-conversations-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, queueRefresh)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chatroom_members', filter: `user_id=eq.${user.id}` },
        () => queueRefresh()
      )
      .subscribe()

    return () => {
      if (chatroomRefreshTimer) {
        clearTimeout(chatroomRefreshTimer)
      }
      if (messageRefreshTimer) {
        clearTimeout(messageRefreshTimer)
      }
      supabase.removeChannel(channel)
    }
  }, [loadChatrooms, loadMessages, selectedChatId, user])

  useEffect(() => {
    if (!user || !selectedChatId) return

    let isMounted = true

    const channel = supabase
      .channel(`chat-stream-${selectedChatId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `chatroom_id=eq.${selectedChatId}` }, async (payload) => {
        const messageRow = payload.new as MessageRow
        const hydrated = await hydrateMessage(messageRow)
        if (!isMounted) return

        const isFromSelf = messageRow.sender_id === user.id

        setMessages((current) => {
          const withoutPlaceholders = current.filter((msg) => {
            if (!msg.id.startsWith('temp-')) return true
            if (msg.chatroom_id !== messageRow.chatroom_id) return true
            if (msg.sender_id !== messageRow.sender_id) return true

            const optimisticTime = new Date(msg.created_at).getTime()
            const incomingTime = new Date(messageRow.created_at).getTime()
            return Math.abs(incomingTime - optimisticTime) > 5000
          })

          const exists = withoutPlaceholders.find((msg) => msg.id === messageRow.id)
          if (exists) {
            return withoutPlaceholders.map((msg) =>
              msg.id === messageRow.id ? { ...hydrated, reactions: msg.reactions } : msg
            )
          }

          const next = [...withoutPlaceholders, hydrated]
          next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
          return next
        })

        updateChatroomAfterMessage(hydrated, true, isFromSelf)

        if (!isFromSelf) {
          await markChatAsRead(messageRow.chatroom_id)
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chatroom_id=eq.${selectedChatId}` }, async (payload) => {
        const messageRow = payload.new as MessageRow
        const hydrated = await hydrateMessage(messageRow)
        if (!isMounted) return

        setMessages((current) =>
          current.map((message) =>
            message.id === messageRow.id ? { ...hydrated, reactions: message.reactions } : message
          )
        )

        updateChatroomAfterMessage(hydrated, true, messageRow.sender_id === user.id)
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages', filter: `chatroom_id=eq.${selectedChatId}` }, (payload) => {
        const messageRow = payload.old as MessageRow
        setMessages((current) => current.filter((message) => message.id !== messageRow.id))
        loadChatrooms()
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [hydrateMessage, loadChatrooms, markChatAsRead, selectedChatId, updateChatroomAfterMessage, user])

  const openChatroom = useCallback(
    (chatroomId: string, peerId?: string) => {
      if (!user) return

      setSelectedChatId(chatroomId)

      const peerPreview = peerId
        ? friends.find((friend) => friend.id === peerId) ??
          userDirectory.find((entry) => entry.id === peerId) ??
          null
        : null

      const selfMember: ChatroomMember = {
        id: user.id,
        name: user.name ?? 'You',
        email: user.email ?? '',
        avatar: user.profile_picture_url,
        role: 'member',
        canPost: true,
        canManageMembers: false,
        canManageMessages: false,
        mute: null,
      }

      const peerMember: ChatroomMember | null = peerId
        ? {
            id: peerId,
            name: peerPreview?.name ?? 'New friend',
            email: peerPreview?.email ?? '',
            avatar: peerPreview?.avatar ?? null,
            role: 'member',
            canPost: true,
            canManageMembers: false,
            canManageMessages: false,
            mute: null,
          }
        : null

      let nextChat: ChatroomWithMeta | null = null

      setChatrooms((current) => {
        const existingIndex = current.findIndex((room) => room.id === chatroomId)
        if (existingIndex !== -1) {
          const existing = current[existingIndex]
          const members = existing.members.slice()

          const selfIndex = members.findIndex((member) => member.id === user.id)
          if (selfIndex !== -1) {
            members[selfIndex] = { ...members[selfIndex], ...selfMember }
          } else {
            members.push(selfMember)
          }

          if (peerMember) {
            const peerIndex = members.findIndex((member) => member.id === peerMember.id)
            if (peerIndex !== -1) {
              members[peerIndex] = { ...members[peerIndex], ...peerMember }
            } else {
              members.push(peerMember)
            }
          }

          nextChat = {
            ...existing,
            members,
          }

          const others = current.filter((_, index) => index !== existingIndex)
          return [nextChat, ...others.filter((room) => room.id !== chatroomId)]
        }

        const members: ChatroomMember[] = [selfMember]
        if (peerMember) members.push(peerMember)

        nextChat = {
          id: chatroomId,
          type: 'dm',
          team_id: null,
          recruitment_post_id: null,
          name: null,
          created_at: new Date().toISOString(),
          archived: false,
          members,
          adminOnly: false,
          unreadCount: 0,
        }

        return [nextChat, ...current.filter((room) => room.id !== chatroomId)]
      })
    },
    [friends, user, userDirectory]
  )

  const startConversation = async (
    targetUserId: string,
    allowFriendRequest = true
  ): Promise<'dm' | 'request' | 'noop' | 'error'> => {
    if (!user) return 'error'

    if (targetUserId === user.id) {
      toast.error('You cannot start a conversation with yourself')
      return 'error'
    }

    const existingDm = chatrooms.find((chatroom) => {
      if (chatroom.type !== 'dm') return false
      const memberIds = chatroom.members.map((member) => member.id)
      return memberIds.length === 2 && memberIds.includes(targetUserId) && memberIds.includes(user.id)
    })

    if (existingDm) {
      openChatroom(existingDm.id, targetUserId)
      return 'dm'
    }

    try {
      const { data: contactData, error: contactError } = await supabase
        .from('contacts')
        .select('id, owner_id, contact_id')
        .or(
          `and(owner_id.eq.${user.id},contact_id.eq.${targetUserId}),and(owner_id.eq.${targetUserId},contact_id.eq.${user.id})`
        )
        .limit(1)
        .maybeSingle()

      const contactRecord =
        (contactData as Pick<ContactRow, 'id' | 'owner_id' | 'contact_id'> | null) ?? null

      if (contactError && contactError.code !== 'PGRST116') {
        throw contactError
      }

      if (contactRecord) {
        if (contactRecord.owner_id !== user.id) {
          const { error: mirrorError } = await supabase
            .from('contacts')
            .insert([{ owner_id: user.id, contact_id: targetUserId }] as never)

          if (mirrorError && mirrorError.code !== '23505') throw mirrorError
        }

        const dmRoomId = await ensureDmChatroom(targetUserId)
        if (dmRoomId) {
          await Promise.all([loadChatrooms(), loadFriends()])
          openChatroom(dmRoomId, targetUserId)
          toast.success('Conversation ready')
          return 'dm'
        }
      }

      const { data: requestData, error: requestLookupError } = await supabase
        .from('friend_requests')
        .select('id, status, sender_id, receiver_id')
        .or(
          `and(sender_id.eq.${user.id},receiver_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},receiver_id.eq.${user.id})`
        )
        .limit(1)
        .maybeSingle()

      const existingRequest =
        (requestData as Pick<FriendRequestRow, 'id' | 'status' | 'sender_id' | 'receiver_id'> | null) ?? null

      if (requestLookupError && requestLookupError.code !== 'PGRST116') {
        throw requestLookupError
      }

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          toast(
            existingRequest.sender_id === user.id
              ? 'Friend request pending acceptance'
              : 'You have an incoming friend request from this user'
          )
          if (existingRequest.sender_id !== user.id) {
            await loadFriendRequests()
          }
          return 'noop'
        }

        if (existingRequest.status === 'accepted') {
          const dmRoomId = await ensureDmChatroom(targetUserId)
          if (dmRoomId) {
            await Promise.all([loadChatrooms(), loadFriends()])
            openChatroom(dmRoomId, targetUserId)
            toast.success('Conversation ready')
            return 'dm'
          }
          return 'error'
        }

        if (existingRequest.status === 'declined') {
          if (existingRequest.sender_id === user.id) {
            const { error: resetError } = await supabase
              .from('friend_requests')
              .update({ status: 'pending', responded_at: null } as never)
              .eq('id', existingRequest.id)

            if (resetError) throw resetError
            await loadFriendRequests()
            toast.success('Friend request re-sent')
            return 'request'
          }

          toast('You previously declined their request. Ask them to send a new one when you are ready.')
          return 'noop'
        }

        if (existingRequest.status === 'blocked') {
          toast.error('This connection is blocked. You cannot message this user.')
          return 'noop'
        }
      }

      if (!allowFriendRequest) {
        toast.error('You must be friends before starting a new conversation')
        return 'noop'
      }

      const requestPayload: TableInsert<'friend_requests'> = {
        sender_id: user.id,
        receiver_id: targetUserId,
        status: 'pending',
      }

      const { error: requestError } = await supabase
        .from('friend_requests')
        .insert([requestPayload] as never)

      if (requestError) throw requestError

      await loadFriendRequests()
      toast.success('Friend request sent')
      return 'request'
    } catch (error: any) {
      console.error('Failed to start chat:', error)
      toast.error(error.message || 'Unable to start conversation')
      return 'error'
    }
  }

  const ensureDmChatroom = useCallback(
    async (peerId: string) => {
      if (!user) return null

      const existingDm = chatrooms.find((chatroom) => {
        if (chatroom.type !== 'dm') return false
        const memberIds = chatroom.members.map((member) => member.id)
        return memberIds.length === 2 && memberIds.includes(peerId) && memberIds.includes(user.id)
      })

      if (existingDm) {
        return existingDm.id
      }

      const { data, error } = await supabase.rpc<string>('ensure_dm_chatroom', {
        partner_id: peerId,
      } as any)

      if (error) throw error

      return data ?? null
    },
    [chatrooms, user]
  )

  const handleSendMessage = async () => {
    if (!user || !selectedChatId || !composerValue.trim()) return
    if (!canPost) {
      toast.error('You do not have permission to post in this chat')
      return
    }
    if (isMuted) {
      toast.error('You are muted in this conversation')
      return
    }

    setSendingMessage(true)
    try {
      const plaintext = composerValue.trim()
      const payload = await encryptMessage(plaintext)
      const insertPayload: TableInsert<'messages'> = {
        chatroom_id: selectedChatId,
        sender_id: user.id,
        content: payload,
        reply_to_message_id: replyingTo?.id ?? null,
        forwarded_from_message_id: forwardingMessage?.id ?? null,
      }

      const { error } = await supabase
        .from('messages')
        .insert([insertPayload] as never)

      if (error) throw error

      setComposerValue('')
      setReplyingTo(null)
      setForwardingMessage(null)

      const optimisticMessage: MessageWithMeta = {
        id: `temp-${Date.now()}`,
        chatroom_id: selectedChatId,
        sender_id: user.id,
        content: payload,
        created_at: new Date().toISOString(),
        edited_at: null,
        deleted: false,
        reply_to_message_id: replyingTo?.id ?? null,
        forwarded_from_message_id: forwardingMessage?.id ?? null,
        decryptedContent: plaintext,
        sender: {
          id: user.id,
          name: user.name ?? 'You',
          email: user.email ?? '',
          avatar: user.profile_picture_url ?? null,
        },
        reactions: [],
      }

      setMessages((current) => [...current, optimisticMessage])
      messagesRef.current = [...messagesRef.current, optimisticMessage]
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })

      await loadChatrooms()
    } catch (error: any) {
      console.error('Failed to send message:', error)
      toast.error(error.message || 'Unable to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  const handleCreateDm = async () => {
    if (!user || !selectedUserForDm) return

    setIsSavingFriendRequest(true)
    try {
      const outcome = await startConversation(selectedUserForDm, true)

      if (outcome === 'dm' || outcome === 'request') {
        setShowCreateDm(false)
        setSelectedUserForDm('')
        setDmSearchTerm('')
      }
    } catch (error: any) {
      console.error('Unable to create DM:', error)
      toast.error(error.message || 'Failed to start conversation')
    } finally {
      setIsSavingFriendRequest(false)
    }
  }

  const handleChatWithFriend = async (friendId: string) => {
    if (!friendId) return

    setFriendAction({ userId: friendId, type: 'chat' })
    try {
      await startConversation(friendId, false)
    } finally {
      setFriendAction(null)
    }
  }

  const handleUnfriend = async (friendId: string) => {
    if (!user) return

    setFriendAction({ userId: friendId, type: 'remove' })
    try {
      const { error: removeError } = await supabase.rpc('remove_contact_pair', {
        friend_id: friendId,
      } as any)

      if (removeError) throw removeError

      await Promise.all([loadFriends(), loadFriendRequests(), loadChatrooms()])

      if (selectedChat?.type === 'dm') {
        const isFriendInChat = selectedChat.members.some((member) => member.id === friendId)
        if (isFriendInChat) {
          setSelectedChatId(null)
        }
      }

      toast.success('Friend removed')
    } catch (error: any) {
      console.error('Failed to remove friend:', error)
      toast.error(error.message || 'Unable to remove friend')
    } finally {
      setFriendAction(null)
    }
  }

  const handleCreateGroup = async () => {
    if (!user) return
    if (!groupParticipants.length) {
      toast.error('Select at least one participant')
      return
    }

    setIsSavingFriendRequest(true)
    try {
      const groupRoomId = await provisionGroupChatroom({
        ownerId: user.id,
        name: groupName,
        participantIds: groupParticipants,
      })

      const trimmedName = groupName.trim()
      const optimisticMembers: ChatroomMember[] = [
        {
          id: user.id,
          name: user.name ?? 'You',
          email: user.email ?? '',
          avatar: user.profile_picture_url ?? null,
          role: 'owner' as ChatroomRoleRow['role'],
          canPost: true,
          canManageMembers: true,
          canManageMessages: true,
          mute: null,
        },
        ...groupSelectedUsers.map<ChatroomMember>((participant) => ({
          id: participant.id,
          name: participant.name,
          email: participant.email,
          avatar: participant.avatar,
          role: 'member' as ChatroomRoleRow['role'],
          canPost: true,
          canManageMembers: false,
          canManageMessages: false,
          mute: null,
        })),
      ]

      optimisticMembers.forEach((member) => {
        previewCacheRef.current.set(member.id, member)
      })

      const nowIso = new Date().toISOString()
      setChatrooms((current) => {
        if (current.some((room) => room.id === groupRoomId)) return current
        return [
          {
            id: groupRoomId,
            type: 'group',
            team_id: null,
            recruitment_post_id: null,
            name: trimmedName ? trimmedName : null,
            created_at: nowIso,
            archived: false,
            members: optimisticMembers,
            adminOnly: false,
            unreadCount: 0,
            lastMessage: undefined,
          },
          ...current,
        ]
      })

      setSelectedChatId(groupRoomId)
      setConversationSearch('')
      await loadChatrooms()
      toast.success('Group created')
    } catch (error: any) {
      console.error('Failed to create group chat:', error)
      toast.error(error.message || 'Unable to create group')
    } finally {
      setIsSavingFriendRequest(false)
      setShowCreateGroup(false)
      setGroupParticipants([])
      setGroupName('')
      setGroupSearchTerm('')
    }
  }

  const handleFriendRequest = async (
    request: FriendRequestWithUser,
    action: 'accept' | 'decline' | 'cancel'
  ) => {
    if (!user) return

    try {
      if (action === 'accept') {
        const { error: updateError } = await supabase
          .from('friend_requests')
          .update({ status: 'accepted', responded_at: new Date().toISOString() } as never)
          .eq('id', request.id)

        if (updateError) throw updateError

        const peerId = request.peer?.id
        if (peerId) {
          const contactPayloads: TableInsert<'contacts'>[] = [
            { owner_id: user.id, contact_id: peerId },
            { owner_id: peerId, contact_id: user.id },
          ]

          await Promise.allSettled(
            contactPayloads.map((payload) => supabase.from('contacts').insert([payload] as never))
          )

          try {
            const dmRoomId = await ensureDmChatroom(peerId)
            if (dmRoomId) {
              await loadChatrooms()
              openChatroom(dmRoomId, peerId)
            }
          } catch (chatError) {
            console.error('Failed to prepare DM after accepting request:', chatError)
          }
        }

        toast.success('Friend request accepted')
        await loadFriendRequests()
        await loadFriends()
      } else if (action === 'decline') {
        const { error } = await supabase
          .from('friend_requests')
          .update({ status: 'declined', responded_at: new Date().toISOString() } as never)
          .eq('id', request.id)

        if (error) throw error
        toast('Request declined')
        await loadFriendRequests()
        await loadFriends()
      } else {
        const { error } = await supabase.from('friend_requests').delete().eq('id', request.id)
        if (error) throw error
        toast('Request withdrawn')
        await loadFriendRequests()
        await loadFriends()
      }
    } catch (error: any) {
      console.error('Failed to update request:', error)
      toast.error(error.message || 'Unable to update request')
    } finally {
      setForceReload((value) => value + 1)
    }
  }

  const handleToggleAdminOnly = async () => {
    if (!selectedChat || !user || !currentMembership) return
    if (!currentMembership.canManageMembers) {
      toast.error('Only admins can manage chat permissions')
      return
    }

    setAdminOnlySyncing(true)
    try {
      const targetValue = !selectedChat.adminOnly
      const updates: TableInsert<'chatroom_roles'>[] = selectedChat.members
        .filter((member) => member.role !== 'owner' && member.role !== 'admin')
        .map<TableInsert<'chatroom_roles'>>((member) => ({
          chatroom_id: selectedChat.id,
          user_id: member.id,
          can_post: !targetValue,
        }))

      if (updates.length) {
        const { error } = await supabase
          .from('chatroom_roles')
          .upsert(updates as never, { onConflict: 'chatroom_id,user_id' })

        if (error) throw error
      }

      await loadChatrooms()
      toast.success(targetValue ? 'Members can no longer post' : 'Members can post again')
    } catch (error: any) {
      console.error('Failed to toggle admin-only mode:', error)
      toast.error(error.message || 'Unable to update permissions')
    } finally {
      setAdminOnlySyncing(false)
    }
  }

  const handleMuteMember = async (member: ChatroomMember, durationMinutes: number | null) => {
    if (!selectedChat || !user || !currentMembership?.canManageMembers) return

    setMutingMemberId(member.id)
    try {
      if (durationMinutes === null) {
        const { error } = await supabase
          .from('chatroom_mutes')
          .delete()
          .eq('chatroom_id', selectedChat.id)
          .eq('user_id', member.id)

        if (error) throw error
        toast.success(`${member.name} can post again`)
      } else {
        const until = new Date()
        until.setMinutes(until.getMinutes() + durationMinutes)

        const mutePayload: TableInsert<'chatroom_mutes'> = {
          chatroom_id: selectedChat.id,
          user_id: member.id,
          created_by: user.id,
          muted_until: until.toISOString(),
        }

        const { error } = await supabase
          .from('chatroom_mutes')
          .upsert(mutePayload as never)

        if (error) throw error
        toast.success(`${member.name} muted until ${until.toLocaleTimeString()}`)
      }
      await loadChatrooms()
    } catch (error: any) {
      console.error('Failed to update mute state:', error)
      toast.error(error.message || 'Unable to update mute state')
    } finally {
      setMutingMemberId(null)
    }
  }

  const handlePromoteMember = async (member: ChatroomMember, role: ChatroomRoleRow['role']) => {
    if (!selectedChat || !user || !currentMembership?.canManageMembers) return

    try {
      const roleInsert: TableInsert<'chatroom_roles'> = {
        chatroom_id: selectedChat.id,
        user_id: member.id,
        role,
        can_post: role !== 'member' ? true : member.canPost,
        can_manage_members: role === 'owner' || role === 'admin',
        can_manage_messages: role === 'owner' || role === 'admin' || role === 'moderator',
      }

  const { error } = await supabase.from('chatroom_roles').upsert(roleInsert as never)

      if (error) throw error
      await loadChatrooms()
      toast.success(`${member.name} is now ${role}`)
    } catch (error: any) {
      console.error('Failed to update member role:', error)
      toast.error(error.message || 'Unable to update role')
    }
  }

  const handleLeaveChat = async () => {
    if (!selectedChat || !user) return

    const confirmation = window.confirm('Leave this conversation? You can rejoin if someone adds you back.')
    if (!confirmation) return

    try {
      const { error } = await supabase
        .from('chatroom_members')
        .delete()
        .eq('chatroom_id', selectedChat.id)
        .eq('user_id', user.id)

      if (error) throw error

    setSelectedChatId(null)
    setMobileListOpen(true)
      await loadChatrooms()
      toast.success('Conversation removed from your inbox')
    } catch (error: any) {
      console.error('Failed to leave chat:', error)
      toast.error(error.message || 'Unable to leave conversation')
    }
  }

  const handleDeleteChat = async () => {
    if (!selectedChat || !user) return
    if (!currentMembership?.canManageMembers) {
      toast.error('Only chat admins can delete this conversation')
      return
    }

    const confirmation = window.confirm('Delete this chat for everyone? This cannot be undone.')
    if (!confirmation) return

    try {
      const { error } = await supabase.rpc('delete_chatroom', {
        p_chatroom_id: selectedChat.id,
      } as never)

      if (error) throw error

    setSelectedChatId(null)
    setMobileListOpen(true)
      await loadChatrooms()
      toast.success('Chat deleted')
    } catch (error: any) {
      console.error('Failed to delete chatroom:', error)
      toast.error(error.message || 'Unable to delete chat')
    }
  }

  const handleBulkDeleteChats = useCallback(async () => {
    if (!user || !selectedChatIds.length) return

    const targetSet = new Set(selectedChatIds)
    const targetRooms = chatrooms.filter((room) => targetSet.has(room.id))

    if (!targetRooms.length) {
      toast.error('Select at least one chat to delete')
      return
    }

    const deletable = targetRooms.filter((room) => {
      const membership = room.members.find((member) => member.id === user.id)
      return membership?.canManageMembers
    })

    const skipped = targetRooms.length - deletable.length

    if (!deletable.length) {
      toast.error('You do not have permission to delete the selected chats')
      return
    }

    setBulkDeleting(true)
    try {
      let successCount = 0
      const failedRooms: string[] = []

      for (const room of deletable) {
        try {
          const { error } = await supabase.rpc('delete_chatroom', {
            p_chatroom_id: room.id,
          } as never)

          if (error) {
            console.error('Failed to delete chatroom:', room.id, error)
            failedRooms.push(room.id)
          } else {
            successCount += 1
          }
        } catch (error) {
          console.error('Unexpected error deleting chatroom:', room.id, error)
          failedRooms.push(room.id)
        }
      }

      if (successCount) {
        if (selectedChatId && targetSet.has(selectedChatId)) {
          setSelectedChatId(null)
          setMessages([])
        }

        await loadChatrooms()
        toast.success(`Deleted ${successCount} chat${successCount > 1 ? 's' : ''}`)
      }

      if (failedRooms.length) {
        toast.error(`Failed to delete ${failedRooms.length} chat${failedRooms.length > 1 ? 's' : ''}`)
      }

      if (skipped > 0) {
        toast(`Skipped ${skipped} chat${skipped > 1 ? 's' : ''} without admin permissions`, {
          icon: '⚠️',
        })
      }
    } finally {
      cancelBulkSelection()
      setBulkDeleting(false)
    }
  }, [cancelBulkSelection, chatrooms, loadChatrooms, selectedChatId, selectedChatIds, setMessages, user])

  const handleReaction = async (message: MessageWithMeta, reaction: string) => {
    if (!user) return

    try {
      const existing = message.reactions.find(
        (entry) => entry.user_id === user.id && entry.reaction === reaction
      )

      if (existing) {
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existing.id)

        if (error) throw error
        setMessages((current) =>
          current.map((entry) =>
            entry.id === message.id
              ? { ...entry, reactions: entry.reactions.filter((item) => item.id !== existing.id) }
              : entry
          )
        )
      } else {
        const { data, error } = await supabase
          .from('message_reactions')
          .insert([
            {
              message_id: message.id,
              user_id: user.id,
              reaction,
            },
          ] as never)
          .select('*')
          .single()

        if (error) throw error
        setMessages((current) =>
          current.map((entry) =>
            entry.id === message.id
              ? { ...entry, reactions: [...entry.reactions, data as MessageReactionRow] }
              : entry
          )
        )
      }
    } catch (error: any) {
      console.error('Failed to update reaction:', error)
      toast.error(error.message || 'Unable to react to message')
    }
  }

  const handleReportMessage = async (message: MessageWithMeta) => {
    if (!user) return
    const reason = window.prompt('Describe the issue with this message')
    if (!reason) return

    try {
      const { error } = await supabase
        .from('message_reports')
        .insert([
          {
            message_id: message.id,
            reporter_id: user.id,
            reason,
            decrypted_preview: message.decryptedContent.slice(0, 200),
          },
        ] as never)

      if (error) throw error
      toast.success('Report submitted for review')
    } catch (error: any) {
      console.error('Failed to report message:', error)
      toast.error(error.message || 'Unable to submit report')
    }
  }

  const handleForwardMessage = async (targetChatId: string) => {
    if (!forwardingMessage || !user) return

    try {
      const payload = await encryptMessage(forwardingMessage.decryptedContent)
      const insertPayload: TableInsert<'messages'> = {
        chatroom_id: targetChatId,
        sender_id: user.id,
        content: payload,
        forwarded_from_message_id: forwardingMessage.id,
        reply_to_message_id: null,
      }

      const { error } = await supabase
        .from('messages')
        .insert([insertPayload] as never)

      if (error) throw error
      toast.success('Message forwarded')
      setForwardingMessage(null)
    } catch (error: any) {
      console.error('Failed to forward message:', error)
      toast.error(error.message || 'Unable to forward message')
    }
  }

  if (!user) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    )
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] bg-[var(--color-bg)]">
      {mobileListOpen && (
        <div
          className="absolute inset-0 z-20 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileListOpen(false)}
        />
      )}

      <div
        className={classNames(
          'absolute inset-y-0 left-0 z-30 flex w-full max-w-md flex-col glass shadow-xl transition-transform duration-300 ease-in-out lg:static lg:h-full lg:max-w-sm lg:border-r lg:border-[color:var(--color-border)] lg:shadow-none',
          mobileListOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'rgba(20, 20, 20, 0.95)',
          backdropFilter: 'blur(20px)'
        }}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-4">
          <div>
            <h2 className="text-xl font-semibold text-primary">Messages</h2>
            <p className="text-xs text-secondary">Stay connected with friends and teams</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] text-secondary transition hover:bg-[var(--accent-hover)] lg:hidden"
              aria-label="Create group chat"
            >
              <Users className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
            </button>
            <button
              onClick={() => setShowCreateGroup(true)}
              className="hidden rounded-full border border-[color:var(--color-border)] px-3 py-2 text-xs font-semibold text-secondary transition hover:bg-[var(--accent-hover)] lg:inline-flex"
            >
              <Users className="mr-1 h-3 w-3" style={{ strokeWidth: 1.5 }} /> Group
            </button>
            <button
              onClick={() => setShowCreateDm(true)}
              className="inline-flex items-center gap-1 rounded-full bg-primary-500 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-primary-400"
            >
              <Plus className="h-3 w-3" /> New
            </button>
          </div>
        </div>

        <div className="px-4 pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" style={{ strokeWidth: 1.5 }} />
            {conversationSearch && (
              <button
                type="button"
                onClick={() => setConversationSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-secondary transition hover:bg-[var(--accent-hover)] hover:text-primary"
                aria-label="Clear chat search"
              >
                <X className="h-3 w-3" style={{ strokeWidth: 1.5 }} />
              </button>
            )}
            <input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search or start a chat"
              className="input-field w-full pl-9 pr-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-5">
          <section className="mt-4 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chats</h3>
              <div className="flex items-center gap-2">
                {bulkSelectMode && (
                  <button
                    onClick={handleBulkDeleteChats}
                    disabled={bulkDeleting || selectedChatIds.length === 0}
                    className={classNames(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                      selectedChatIds.length && !bulkDeleting
                        ? 'border-red-200 text-red-600 hover:bg-red-50'
                        : 'border-slate-200 text-slate-400'
                    )}
                  >
                    {bulkDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    Delete
                    {selectedChatIds.length > 0 && ` (${selectedChatIds.length})`}
                  </button>
                )}
                <button
                  onClick={toggleBulkSelectionMode}
                  className={classNames(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition',
                    bulkSelectMode
                      ? 'border-primary-200 text-primary-600 hover:bg-primary-50'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-100'
                  )}
                >
                  {bulkSelectMode ? 'Cancel' : 'Select' }
                </button>
              </div>
            </div>
            {bulkSelectMode && (
              <p className="text-[11px] text-slate-400">
                Choose chats to delete. Only conversations where you have admin rights can be removed.
              </p>
            )}
            {initializing ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-primary-500" />
              </div>
            ) : conversationList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <MessageCircle className="mx-auto h-8 w-8 text-slate-400" />
                <p className="mt-3 text-sm font-semibold text-slate-700">No conversations yet</p>
                <p className="text-xs text-slate-500">Start by inviting someone or create a new group chat.</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm">
                <Search className="mx-auto h-6 w-6 text-slate-400" />
                <p className="mt-2 text-sm font-semibold text-slate-700">No matches found</p>
                <p className="text-xs text-slate-500">Try a different name or keyword.</p>
              </div>
            ) : (
              filteredConversations.map((room) => {
                const isActive = !bulkSelectMode && room.id === selectedChatId
                const isSelected = selectedChatIdSet.has(room.id)
                const isRecruitment = Boolean(room.recruitment_post_id)
                const isTeam = Boolean(room.team_id)
                const displayName = getChatDisplayName(room)
                const typeBadge = room.type === 'group' ? 'Group' : isTeam ? 'Team' : isRecruitment ? 'Recruitment' : null
                const avatarMeta = resolveChatAvatar(room)

                return (
                  <button
                    key={room.id}
                    onClick={(event) => {
                      if (bulkSelectMode) {
                        event.preventDefault()
                        toggleChatSelection(room.id)
                      } else {
                        handleSelectChat(room.id)
                      }
                    }}
                    className={classNames(
                      'group relative flex w-full items-center gap-3 rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-primary-100 hover:bg-primary-50/60',
                      isActive
                        ? 'border-primary-500 bg-primary-500 text-white shadow-lg shadow-primary-500/40'
                        : isSelected
                          ? 'border-primary-200 bg-primary-50/60 text-primary-700'
                          : 'bg-white shadow-sm'
                    )}
                  >
                    {bulkSelectMode && (
                      <span
                        className={classNames(
                          'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold',
                          isSelected
                            ? 'border-primary-500 bg-primary-500 text-white'
                            : 'border-slate-300 bg-white text-transparent'
                        )}
                      >
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div
                      className={classNames(
                        'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold',
                        avatarMeta.kind === 'image'
                          ? isActive
                            ? 'ring-2 ring-white/70'
                            : 'border border-slate-200'
                          : isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-primary-100 text-primary-600'
                      )}
                    >
                      {avatarMeta.kind === 'image' ? (
                        <img
                          src={avatarMeta.src}
                          alt={avatarMeta.alt}
                          className="h-full w-full object-cover"
                        />
                      ) : avatarMeta.kind === 'icon' ? (
                        <Users className={classNames('h-5 w-5', isActive ? 'text-white' : 'text-primary-600')} />
                      ) : (
                        avatarMeta.label
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold leading-tight line-clamp-2">{displayName}</p>
                        <span className={classNames('text-xs', isActive ? 'text-white/80' : 'text-slate-400')}>
                          {formatRelative(room.lastMessage?.created_at ?? room.created_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        {room.adminOnly && (
                          <Shield className={classNames('h-3 w-3', isActive ? 'text-white' : 'text-primary-500')} />
                        )}
                        {typeBadge && (
                          <span
                            className={classNames(
                              'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase',
                              isActive ? 'border-white/30 text-white/80' : 'border-primary-200 text-primary-600'
                            )}
                          >
                            {typeBadge}
                          </span>
                        )}
                        <p className={classNames('flex-1 text-xs leading-snug line-clamp-2', isActive ? 'text-white/80' : 'text-slate-500')}>
                          {room.lastMessage?.decryptedContent ?? 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    {room.unreadCount > 0 && (
                      <span
                        className={classNames(
                          'ml-2 inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold',
                          isActive ? 'bg-white text-primary-600' : 'bg-primary-500 text-white'
                        )}
                      >
                        {room.unreadCount}
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </section>

          {friendRequests.length > 0 && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Friend requests</h3>
                <button
                  onClick={() => setShowCreateDm(true)}
                  className="text-xs font-semibold text-primary-600 hover:text-primary-500"
                >
                  Invite
                </button>
              </div>
              <div className="mt-3 space-y-3">
                {friendRequests.map((request) => {
                  const isIncoming = request.direction === 'incoming'
                  const isPending = request.status === 'pending'
                  return (
                    <div
                      key={request.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{request.peer?.name ?? 'Unknown user'}</p>
                          <p className="text-xs text-slate-500">{request.peer?.email ?? '—'}</p>
                        </div>
                        <span className="text-[11px] uppercase tracking-wide text-slate-400">{request.status}</span>
                      </div>
                      <div className="mt-3 flex gap-2">
                        {isIncoming && isPending ? (
                          <>
                            <button
                              onClick={() => handleFriendRequest(request, 'accept')}
                              className="flex-1 rounded-full bg-primary-500 px-3 py-1 text-xs font-semibold text-white transition hover:bg-primary-400"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleFriendRequest(request, 'decline')}
                              className="flex-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleFriendRequest(request, 'cancel')}
                            className="w-full rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
                          >
                            Cancel request
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {friends.length > 0 && (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick friends</h3>
              <div className="mt-3 space-y-3">
                {friends.slice(0, 6).map((friend) => {
                  const isBusy = friendAction?.userId === friend.id
                  const isChatting = isBusy && friendAction?.type === 'chat'
                  return (
                    <div key={friend.id} className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 shrink-0">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.name ?? friend.email ?? 'Friend'}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-semibold text-primary-600">
                              {friend.name?.[0]?.toUpperCase() ?? 'F'}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-700">{friend.name}</p>
                          <p className="text-xs text-slate-500">{friend.email || '—'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleChatWithFriend(friend.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-full border border-primary-200 px-3 py-1 text-[11px] font-semibold text-primary-600 transition hover:bg-primary-50 disabled:opacity-60"
                      >
                        {isChatting ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />} Chat
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Chat Box - Slides in from right when chat is selected */}
      <div 
        className={classNames(
          "flex flex-1 flex-col transition-all duration-500 ease-in-out",
          selectedChat 
            ? "translate-x-0 opacity-100" 
            : "translate-x-full opacity-0 lg:translate-x-0 lg:opacity-100"
        )}
      >
        {selectedChat ? (
          <>
            <header className="relative z-10 flex items-center justify-between border-b border-[color:var(--color-border)] glass px-4 py-4 lg:px-6"
              style={{
                background: 'linear-gradient(90deg, #0E0E0E 0%, #121212 100%)'
              }}
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileListOpen(true)}
                  className="rounded-full p-2 text-secondary transition hover:bg-[var(--accent-hover)] lg:hidden"
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="h-5 w-5" style={{ strokeWidth: 1.5 }} />
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-primary">
                      {getChatDisplayName(selectedChat)}
                    </h2>
                    {selectedChat.adminOnly && (
                      <span className="inline-flex items-center gap-1 rounded-full badge">
                        <Lock className="h-3 w-3" style={{ strokeWidth: 1.5 }} /> Admin only
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-secondary">
                    {selectedChat.members.length} participant{selectedChat.members.length === 1 ? '' : 's'} ·
                    {hasEncryptionKey() ? ' End-to-end encryption enabled' : ' Encryption key not configured'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled
                  className="rounded-full p-2 text-disabled transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed"
                  title="Voice call coming soon"
                >
                  <Phone className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
                </button>
                <button
                  disabled
                  className="rounded-full p-2 text-disabled transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed"
                  title="Video call coming soon"
                >
                  <Video className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
                </button>
                <button
                  onClick={() => setShowChatDetails(true)}
                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                  aria-label="Chat details"
                >
                  <Info className="h-4 w-4" />
                </button>
                <div className="relative" ref={headerMenuRef}>
                  <button
                    onClick={() => setShowHeaderMenu((value) => !value)}
                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
                    aria-label="More options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </button>
                  {showHeaderMenu && (
                    <div className="absolute right-0 top-11 w-52 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 shadow-xl">
                      <button
                        onClick={() => {
                          setShowChatDetails(true)
                          setShowHeaderMenu(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100"
                      >
                        <Info className="h-4 w-4" /> View members
                      </button>
                      {currentMembership?.canManageMembers && (
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false)
                            handleToggleAdminOnly()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100"
                        >
                          {adminOnlySyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Shield className="h-4 w-4" />
                          )}
                          {selectedChat.adminOnly ? 'Allow members to post' : 'Restrict to admins'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowHeaderMenu(false)
                          handleLeaveChat()
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100"
                      >
                        <LogOut className="h-4 w-4" /> Leave chat
                      </button>
                      {currentMembership?.canManageMembers && (
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false)
                            handleDeleteChat()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" /> Delete chat
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto bg-gradient-to-b from-slate-100 via-white to-slate-100 px-3 py-5 lg:px-6">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-500" />
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => {
                    const isSelf = message.sender_id === user.id
                    const isDeleted = message.deleted
                    return (
                      <div key={message.id} className="flex flex-col gap-2">
                        <div className={classNames('flex items-end gap-3', isSelf ? 'flex-row-reverse' : '')}>
                          <div className="h-9 w-9 shrink-0">
                            {message.sender?.avatar ? (
                              <img
                                src={message.sender.avatar}
                                alt={message.sender.name ?? message.sender.email ?? 'Chat member'}
                                className="h-full w-full rounded-full object-cover"
                              />
                            ) : (
                              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">
                                {message.sender?.name?.[0]?.toUpperCase() || 'U'}
                              </div>
                            )}
                          </div>
                          <div
                            className={classNames(
                              'max-w-[75%] rounded-2xl px-4 py-3 shadow-sm transition',
                              isSelf
                                ? 'rounded-br-none bg-primary-500 text-white shadow-primary-500/30'
                                : 'rounded-bl-none bg-white text-slate-800'
                            )}
                          >
                            <div className="flex items-center justify-between gap-4">
                              <p className="text-sm font-semibold">
                                {message.sender?.name ?? 'Unknown'}
                              </p>
                              <span className={classNames('text-[11px]', isSelf ? 'text-white/70' : 'text-slate-400')}>
                                {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            {message.reply_to_message_id && (
                              <p className={classNames('mt-2 rounded-xl px-3 py-1 text-xs', isSelf ? 'bg-white/15 text-white/80' : 'bg-slate-100 text-slate-500')}>
                                Replying to message {message.reply_to_message_id.slice(0, 5)}…
                              </p>
                            )}
                            {message.forwarded_from_message_id && (
                              <p className={classNames('mt-2 rounded-xl px-3 py-1 text-xs', isSelf ? 'bg-white/15 text-white/80' : 'bg-slate-100 text-slate-500')}>
                                Forwarded message
                              </p>
                            )}
                            <p
                              className={classNames(
                                'mt-2 text-sm leading-relaxed',
                                isDeleted ? 'italic text-slate-400 line-through' : ''
                              )}
                            >
                              {isDeleted ? 'Message removed' : message.decryptedContent}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                              <button
                                onClick={() => setReplyingTo(message)}
                                className={classNames(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-1 transition',
                                  isSelf ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                )}
                              >
                                <Reply className="h-3 w-3" /> Reply
                              </button>
                              <div className="relative">
                                <details className="group">
                                  <summary className={classNames(
                                    'flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-1 transition',
                                    isSelf ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                  )}>
                                    <Laugh className="h-3 w-3" /> React
                                    <ChevronDown className="h-3 w-3" />
                                  </summary>
                                  <div className="absolute left-0 z-10 mt-2 flex gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                                    {REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={() => handleReaction(message, emoji)}
                                        className="text-lg"
                                      >
                                        {emoji}
                                      </button>
                                    ))}
                                  </div>
                                </details>
                              </div>
                              <button
                                onClick={() => setForwardingMessage(message)}
                                className={classNames(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-1 transition',
                                  isSelf ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                )}
                              >
                                <Forward className="h-3 w-3" /> Forward
                              </button>
                              <button
                                onClick={() => handleReportMessage(message)}
                                className={classNames(
                                  'inline-flex items-center gap-1 rounded-full px-2 py-1 transition',
                                  isSelf ? 'bg-white/10 text-white/80 hover:bg-white/20' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                )}
                              >
                                <Flag className="h-3 w-3" /> Report
                              </button>
                            </div>
                            {message.reactions.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {message.reactions.map((reaction) => (
                                  <span
                                    key={reaction.id}
                                    className={classNames(
                                      'inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs',
                                      isSelf ? 'bg-white/10 text-white/80' : 'bg-slate-100 text-slate-600'
                                    )}
                                  >
                                    {reaction.reaction}
                                    <span className="text-[10px] uppercase tracking-wide">
                                      {reaction.user_id === user.id ? 'you' : 'member'}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messageEndRef} />
                </div>
              )}
            </div>

            <footer className="border-t border-slate-200 bg-white/95 px-3 py-4 backdrop-blur lg:px-6">
              {replyingTo && (
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-xs text-primary-700">
                  <div>
                    Replying to <span className="font-semibold">{replyingTo.sender?.name ?? 'Unknown'}</span>
                    <p className="text-primary-500">{replyingTo.decryptedContent.slice(0, 80)}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="text-primary-400 transition hover:text-primary-600">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              {forwardingMessage && (
                <div className="mb-3 flex items-center justify-between rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-xs text-amber-700">
                  <div>
                    Forwarding message from <span className="font-semibold">{forwardingMessage.sender?.name ?? 'Unknown'}</span>
                    <p className="text-amber-600">{forwardingMessage.decryptedContent.slice(0, 80)}</p>
                  </div>
                  <button onClick={() => setForwardingMessage(null)} className="text-amber-500 transition hover:text-amber-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-3">
                <textarea
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
                  placeholder={isMuted ? 'You are muted by an admin' : 'Write a message'}
                  disabled={sendingMessage || !canPost || isMuted}
                  className="h-20 flex-1 resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-500/30 disabled:opacity-60"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !composerValue.trim() || !canPost || isMuted}
                  className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary-500 text-white shadow-lg transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Send message"
                >
                  {sendingMessage ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </button>
              </div>
              {!canPost && !isMuted && (
                <p className="mt-2 text-xs text-amber-600">Admins have restricted messaging in this conversation.</p>
              )}
              {isMuted && (
                <p className="mt-2 text-xs text-amber-600">You are muted in this chat. Contact an admin to restore access.</p>
              )}
            </footer>
          </>
        ) : (
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #0B0B0B 0%, #141414 50%, #0B0B0B 100%)'
            }}
          >
            <MessageCircle className="h-12 w-12 text-accent" style={{ strokeWidth: 1.5 }} />
            <h2 className="mt-4 text-xl font-semibold text-primary">Select a conversation</h2>
            <p className="mt-2 text-sm text-secondary text-center max-w-sm px-4">
              Choose an existing chat or start a new message with a teammate or fellow student.
            </p>
            <button
              onClick={() => {
                setMobileListOpen(true)
                setShowCreateDm(true)
              }}
              className="mt-5 btn-primary inline-flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" /> Start a conversation
            </button>
          </div>
        )}
      </div>

      {showChatDetails && selectedChat && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-slate-900/50 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowChatDetails(false)
            }
          }}
        >
          <div className="h-full w-full max-w-sm bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowChatDetails(false)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Chat details</h3>
                  <p className="text-xs text-slate-500">Manage members and permissions</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatDetails(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-5">
              <section className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conversation</h4>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-700">Type:</span> {selectedChat.type === 'dm' ? 'Direct Message' : selectedChat.type === 'group' ? 'Group chat' : 'Conversation'}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Created:</span> {formatRelative(selectedChat.created_at)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-700">Total members:</span> {selectedChat.members.length}
                  </p>
                  {selectedChat.adminOnly && <p className="text-amber-600">Posting restricted to admins</p>}
                </div>
              </section>

              <section className="mt-6 space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quick actions</h4>
                <div className="space-y-2">
                  {currentMembership?.canManageMembers && (
                    <button
                      onClick={() => {
                        handleToggleAdminOnly()
                        setShowChatDetails(false)
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                    >
                      <span>{selectedChat.adminOnly ? 'Allow all members to post' : 'Restrict posting to admins'}</span>
                      {adminOnlySyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />}
                    </button>
                  )}
                  {dmPartner && friends.some((friend) => friend.id === dmPartner.id) && (
                    <button
                      onClick={async () => {
                        const confirmed = window.confirm(`Remove ${dmPartner.name ?? 'this user'} from your friends list?`)
                        if (!confirmed) return
                        await handleUnfriend(dmPartner.id)
                        setShowChatDetails(false)
                      }}
                      disabled={friendAction?.userId === dmPartner.id && friendAction?.type === 'remove'}
                      className="flex w-full items-center justify-between rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>Remove friend</span>
                      {friendAction?.userId === dmPartner.id && friendAction?.type === 'remove' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-4 w-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleLeaveChat()
                      setShowChatDetails(false)
                    }}
                    className="flex w-full items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    <span>Leave conversation</span>
                    <LogOut className="h-4 w-4" />
                  </button>
                  {currentMembership?.canManageMembers && (
                    <button
                      onClick={() => {
                        handleDeleteChat()
                        setShowChatDetails(false)
                      }}
                      className="flex w-full items-center justify-between rounded-2xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <span>Delete conversation</span>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </section>

              <section className="mt-6">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Members</h4>
                <div className="mt-3 space-y-3">
                  {selectedChat.members.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-800">{member.name}</p>
                          <p className="text-xs text-slate-500">{member.email || '—'}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-wide text-slate-400">{member.role}</p>
                          {member.mute?.muted_until && new Date(member.mute.muted_until).getTime() > Date.now() && (
                            <p className="text-[11px] text-amber-600">
                              Muted until {new Date(member.mute.muted_until).toLocaleTimeString()}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {member.role === 'owner' && <Crown className="h-4 w-4 text-amber-500" />}
                          {currentMembership?.canManageMembers && member.id !== user.id && (
                            <details className="group relative">
                              <summary className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200">
                                {mutingMemberId === member.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </summary>
                              <div className="absolute right-0 z-10 mt-2 w-52 rounded-2xl border border-slate-200 bg-white p-2 text-sm text-slate-600 shadow-lg">
                                <button
                                  onClick={() => handlePromoteMember(member, 'admin')}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100"
                                >
                                  <Shield className="h-4 w-4" /> Promote to admin
                                </button>
                                <button
                                  onClick={() => handlePromoteMember(member, 'moderator')}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100"
                                >
                                  <Hash className="h-4 w-4" /> Make moderator
                                </button>
                                <button
                                  onClick={() => handlePromoteMember(member, 'member')}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100"
                                >
                                  <Users className="h-4 w-4" /> Member access
                                </button>
                                <hr className="my-2 border-slate-100" />
                                <button
                                  onClick={() => handleMuteMember(member, 15)}
                                  disabled={mutingMemberId === member.id}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Ban className="h-4 w-4" /> Mute 15 minutes
                                </button>
                                <button
                                  onClick={() => handleMuteMember(member, 60)}
                                  disabled={mutingMemberId === member.id}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Ban className="h-4 w-4" /> Mute 1 hour
                                </button>
                                <button
                                  onClick={() => handleMuteMember(member, null)}
                                  disabled={mutingMemberId === member.id}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Users className="h-4 w-4" /> Unmute
                                </button>
                              </div>
                            </details>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {showCreateDm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Start a conversation</h3>
                <p className="text-sm text-slate-500">Send a friend request or jump straight into a DM.</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateDm(false)
                  setSelectedUserForDm('')
                  setDmSearchTerm('')
                }}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close new conversation dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 space-y-4">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search users
              </label>
              <input
                value={dmSearchTerm}
                onChange={(event) => setDmSearchTerm(event.target.value)}
                placeholder="Search by name or email"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
              <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200">
                {filteredDmOptions.map((option) => {
                  const isSelected = selectedUserForDm === option.id
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setSelectedUserForDm(option.id)}
                      className={classNames(
                        'flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-none',
                        isSelected ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <div>
                        <p className="font-semibold">{option.name}</p>
                        <p className="text-xs text-slate-500">{option.email}</p>
                      </div>
                      {isSelected && <Check className="h-4 w-4 text-primary-600" />}
                    </button>
                  )
                })}
                {filteredDmOptions.length === 0 && (
                  <p className="px-4 py-5 text-sm text-slate-400">No users match your search</p>
                )}
              </div>
              {selectedDmUser && (
                <div className="flex items-center justify-between rounded-2xl border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-700">
                  <div>
                    <p className="font-semibold">{selectedDmUser.name}</p>
                    <p className="text-xs text-primary-600">{selectedDmUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserForDm('')
                      setDmSearchTerm('')
                    }}
                    className="rounded-full p-2 text-primary-500 transition hover:bg-primary-100"
                    aria-label="Clear selected user"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowCreateDm(false)
                    setSelectedUserForDm('')
                    setDmSearchTerm('')
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDm}
                  disabled={!selectedUserForDm || isSavingFriendRequest}
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:opacity-60"
                >
                  {isSavingFriendRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Start chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Create group chat</h3>
                <p className="text-sm text-slate-500">Select members and assign leader privileges.</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateGroup(false)
                  setGroupParticipants([])
                  setGroupName('')
                  setGroupSearchTerm('')
                }}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close group dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-3">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Group name
                </label>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Study group or project name"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                />
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Members
                </label>
                <input
                  value={groupSearchTerm}
                  onChange={(event) => setGroupSearchTerm(event.target.value)}
                  placeholder="Search classmates by name or email"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
                />
                {groupSelectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-2 rounded-2xl border border-primary-100 bg-primary-50 p-3 text-xs text-primary-700">
                    {groupSelectedUsers.map((participant) => (
                      <span
                        key={participant.id}
                        className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 shadow-sm"
                      >
                        {participant.name}
                        <button
                          onClick={() =>
                            setGroupParticipants((current) =>
                              current.filter((participantId) => participantId !== participant.id)
                            )
                          }
                          className="text-primary-500 transition hover:text-primary-700"
                          aria-label={`Remove ${participant.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200">
                  {filteredGroupOptions.map((option) => {
                    const isSelected = groupParticipants.includes(option.id)
                    return (
                      <button
                        type="button"
                        key={option.id}
                        onClick={() =>
                          setGroupParticipants((participants) =>
                            participants.includes(option.id)
                              ? participants.filter((id) => id !== option.id)
                              : [...participants, option.id]
                          )
                        }
                        className={classNames(
                          'flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left text-sm transition last:border-none',
                          isSelected ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        <div>
                          <p className="font-semibold">{option.name}</p>
                          <p className="text-xs text-slate-500">{option.email}</p>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary-600" />}
                      </button>
                    )
                  })}
                  {filteredGroupOptions.length === 0 && (
                    <p className="px-4 py-5 text-sm text-slate-400">No users match your search</p>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
                <h4 className="text-sm font-semibold text-slate-700">Group permissions overview</h4>
                <ul className="mt-3 space-y-2 text-xs text-slate-500">
                  <li className="flex items-start gap-2">
                    <Shield className="mt-0.5 h-3 w-3" /> Group creator becomes owner with all permissions
                  </li>
                  <li className="flex items-start gap-2">
                    <Hash className="mt-0.5 h-3 w-3" /> Promote members to moderators for message management
                  </li>
                  <li className="flex items-start gap-2">
                    <Ban className="mt-0.5 h-3 w-3" /> Temporarily mute disruptive members without removing them
                  </li>
                  <li className="flex items-start gap-2">
                    <Crown className="mt-0.5 h-3 w-3" /> Owners can delegate admin rights to trusted members
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false)
                  setGroupParticipants([])
                  setGroupName('')
                  setGroupSearchTerm('')
                }}
                className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isSavingFriendRequest || groupParticipants.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:opacity-60"
              >
                {isSavingFriendRequest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Users className="h-4 w-4" />}
                Create group
              </button>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Forward message</h3>
                <p className="text-sm text-slate-500">
                  Select a conversation where you want to forward this message.
                </p>
              </div>
              <button
                onClick={() => setForwardingMessage(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close forward dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {chatrooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleForwardMessage(room.id)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-100"
                >
                  {room.name || room.members.filter((member) => member.id !== user.id).map((member) => member.name).join(', ') || 'Conversation'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
