import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  Loader2,
  MessageCircle,
  Send,
  UserPlus,
  UserMinus,
  Users,
  Plus,
  Shield,
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
  CheckCheck,
  Clock,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { provisionGroupChatroom } from '@/utils/chatrooms'
import { useAuthStore } from '@/store/authStore'
import { decryptMessage, encryptMessage, hasEncryptionKey } from '@/utils/encryption'
import type { TableInsert, TableRow } from '@/types/database'

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'seen'

type UserRow = TableRow<'users'>
type ChatroomRow = TableRow<'chatrooms'>
type MessageRow = TableRow<'messages'> & { status?: MessageStatus; delivered_at?: string | null }
type FriendRequestRow = TableRow<'friend_requests'>
type ChatroomRoleRow = TableRow<'chatroom_roles'>
type ChatroomMemberRow = TableRow<'chatroom_members'>
type MessageReactionRow = TableRow<'message_reactions'> & { reactor_name?: string | null }
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
  status?: MessageStatus
  readBy?: { userId: string; name: string; readAt: string }[]
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
  
  // Message cache per chatroom - prevents refetch when switching between already-loaded chats
  const messageCacheRef = useRef<Map<string, MessageWithMeta[]>>(new Map())

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

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutsideEmoji = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const isInsidePicker = target.closest('.emoji-picker-container')
      if (!isInsidePicker) {
        document.querySelectorAll('.emoji-picker-details[open]').forEach((el) => {
          el.removeAttribute('open')
        })
      }
    }

    document.addEventListener('mousedown', handleClickOutsideEmoji)
    return () => {
      document.removeEventListener('mousedown', handleClickOutsideEmoji)
    }
  }, [])

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

      // Immediately update local state to reset unread count (no flicker)
      setChatrooms((current) =>
        current.map((room) =>
          room.id === chatroomId ? { ...room, unreadCount: 0 } : room
        )
      )

      // Update local message statuses to 'seen' for messages from others
      setMessages((current) =>
        current.map((msg) =>
          msg.chatroom_id === chatroomId && msg.sender_id !== user.id
            ? { ...msg, status: 'seen' as MessageStatus }
            : msg
        )
      )

      try {
        // Use the new mark_messages_seen RPC function
        await supabase.rpc('mark_messages_seen', { 
          p_chatroom_id: chatroomId 
        } as never)
      } catch (error) {
        // Fallback to old method if RPC doesn't exist yet
        console.warn('mark_messages_seen RPC not available, using fallback:', error)
        try {
          await supabase
            .from('chatroom_members')
            .update({ last_read_at: new Date().toISOString() } as never)
            .eq('chatroom_id', chatroomId)
            .eq('user_id', user.id)
        } catch (fallbackError) {
          console.error('Failed to update read status:', fallbackError)
        }
      }
    },
    [user]
  )

  const handleSelectChat = useCallback(
    async (chatroomId: string) => {
      setSelectedChatId(chatroomId)
      setMobileListOpen(false)
      
      // Mark messages as delivered first, then seen
      try {
        await supabase.rpc('mark_messages_delivered', { 
          p_chatroom_id: chatroomId 
        } as never)
      } catch (error) {
        // Ignore if RPC not available
        console.debug('mark_messages_delivered not available:', error)
      }
      
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
        status: (row.status as MessageStatus) || 'sent', // Include message status
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

  // Track if this is the initial load for a chat (no messages yet)
  const isInitialChatLoad = useRef(true)
  // Track if we have more messages to load (pagination)
  const hasMoreMessagesRef = useRef(true)
  const oldestMessageTimestampRef = useRef<string | null>(null)
  const MESSAGE_PAGE_SIZE = 30

  const loadMessages = useCallback(
    async (chatroomId: string, loadOlder = false) => {
      if (!user) return

      // Only show loader on INITIAL load when no messages exist
      // Never show loader during refresh/sync operations
      const hasExistingMessages = messagesRef.current.length > 0 && 
        messagesRef.current.some((m) => m.chatroom_id === chatroomId)
      
      if (!hasExistingMessages && !loadOlder) {
        setLoadingMessages(true)
        isInitialChatLoad.current = true
        hasMoreMessagesRef.current = true
        oldestMessageTimestampRef.current = null
      } else {
        isInitialChatLoad.current = false
      }
      
      try {
        // Build query - load latest messages first (descending), then reverse for display
        let query = supabase
          .from('messages')
          .select('*')
          .eq('chatroom_id', chatroomId)
          .order('created_at', { ascending: false })
          .limit(MESSAGE_PAGE_SIZE)

        // If loading older messages, use cursor pagination
        if (loadOlder && oldestMessageTimestampRef.current) {
          query = query.lt('created_at', oldestMessageTimestampRef.current)
        }

        const { data: messageRows, error: messageError } = await query

        if (messageError) throw messageError

        // Reverse to get chronological order (oldest first for display)
        const messageRowsData = ((messageRows || []) as MessageRow[]).reverse()
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
              status: ((message as MessageRow).status as MessageStatus) || 'sent',
            }
          })
        )

        // Track pagination state
        if (decryptedMessages.length > 0) {
          const oldestMsg = decryptedMessages[0]
          if (!loadOlder) {
            oldestMessageTimestampRef.current = oldestMsg.created_at
          } else if (decryptedMessages.length > 0) {
            oldestMessageTimestampRef.current = oldestMsg.created_at
          }
        }
        hasMoreMessagesRef.current = decryptedMessages.length === MESSAGE_PAGE_SIZE

        // Merge new messages with existing ones (diff-based update)
        // This prevents flicker by preserving existing messages and only updating changed ones
        setMessages((current) => {
          if (loadOlder) {
            // Prepend older messages to beginning
            const currentIds = new Set(current.map((m) => m.id))
            const newOlder = decryptedMessages.filter((m) => !currentIds.has(m.id))
            return [...newOlder, ...current]
          }
          
          if (!isInitialChatLoad.current && current.length > 0) {
            // For refresh: merge by ID, keeping existing reactions if not updated
            const currentMap = new Map(current.map((m) => [m.id, m]))
            const merged = decryptedMessages.map((newMsg) => {
              const existing = currentMap.get(newMsg.id)
              if (existing) {
                // Preserve local reactions if server data doesn't have newer ones
                return {
                  ...newMsg,
                  reactions: newMsg.reactions.length > 0 ? newMsg.reactions : existing.reactions,
                }
              }
              return newMsg
            })
            return merged
          }
          // Initial load: just set the messages
          return decryptedMessages
        })
        
        // Auto-scroll to bottom on initial load only
        if (!loadOlder) {
          setTimeout(() => {
            messageEndRef.current?.scrollIntoView({ behavior: 'instant' })
          }, 50)
        }
        
        await markChatAsRead(chatroomId)
      } catch (error: any) {
        console.error('Unable to load messages:', error)
        // Only show error toast on initial load, not background refreshes
        if (isInitialChatLoad.current) {
          toast.error(error.message || 'Failed to load messages')
        }
      } finally {
        // Only turn off loading if we were showing it
        if (isInitialChatLoad.current) {
          setLoadingMessages(false)
        }
      }
    },
    [decryptMessage, markChatAsRead, user]
  )

  // Load older messages when scrolling to top
  const handleLoadOlderMessages = useCallback(() => {
    if (selectedChatId && hasMoreMessagesRef.current) {
      loadMessages(selectedChatId, true)
    }
  }, [loadMessages, selectedChatId])

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
          // NEVER clear messages - preserve existing state
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

        const dedupedMap = new Map<string, ChatroomWithMeta>()
        const scoreRoom = (room: ChatroomWithMeta) => {
          let score = 0
          if (room.type && room.type !== 'dm') score += 10
          if (room.team_id) score += 5
          if (room.recruitment_post_id) score += 5
          if (room.name) score += 2
          if (room.members.length > 1) score += room.members.length
          if (room.lastMessage) score += 3
          return score
        }

        for (const room of chatroomList) {
          const existing = dedupedMap.get(room.id)
          if (!existing) {
            dedupedMap.set(room.id, room)
            continue
          }

          const preferred = scoreRoom(room) >= scoreRoom(existing) ? room : existing
          dedupedMap.set(room.id, preferred)
        }

        const dedupedList = Array.from(dedupedMap.values())

        dedupedList.sort((a, b) => {
          const aTime = new Date(a.lastMessage?.created_at ?? a.created_at).getTime()
          const bTime = new Date(b.lastMessage?.created_at ?? b.created_at).getTime()
          return bTime - aTime
        })

        const hasSelected = selectedChatId
          ? dedupedList.some((room) => room.id === selectedChatId)
          : false

        setChatrooms((current) => {
          if (!selectedChatId) {
            return dedupedList
          }

          // Preserve unreadCount: 0 for the currently selected chat
          // to prevent flicker when chatrooms are reloaded
          const currentRoom = current.find((room) => room.id === selectedChatId)
          const preservedUnreadCount = currentRoom?.unreadCount === 0 ? 0 : undefined

          if (hasSelected) {
            if (preservedUnreadCount === 0) {
              return dedupedList.map((room) =>
                room.id === selectedChatId ? { ...room, unreadCount: 0 } : room
              )
            }
            return dedupedList
          }

          const placeholder = current.find((room) => room.id === selectedChatId)
          if (!placeholder) {
            return dedupedList
          }

          return [placeholder, ...dedupedList.filter((room) => room.id !== placeholder.id)]
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

  // Save current chat messages to cache when switching away
  const previousChatIdRef = useRef<string | null>(null)
  
  useEffect(() => {
    // Save previous chat's messages to cache before switching
    if (previousChatIdRef.current && previousChatIdRef.current !== selectedChatId) {
      const prevMessages = messagesRef.current
      if (prevMessages.length > 0) {
        messageCacheRef.current.set(previousChatIdRef.current, prevMessages)
      }
    }
    previousChatIdRef.current = selectedChatId
    
    if (!selectedChatId) return
    
    // Check if we have cached messages for this chat
    const cachedMessages = messageCacheRef.current.get(selectedChatId)
    if (cachedMessages && cachedMessages.length > 0) {
      // Instantly restore from cache - NO LOADER
      setMessages(cachedMessages)
      // Background refresh to get any new messages (without showing loader)
      loadMessages(selectedChatId)
    } else {
      // First time loading this chat - will show loader
      loadMessages(selectedChatId)
    }
  }, [loadMessages, selectedChatId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Keep messagesRef and cache in sync with state
  useEffect(() => {
    messagesRef.current = messages
    // Update cache for current chat
    if (selectedChatId && messages.length > 0) {
      messageCacheRef.current.set(selectedChatId, messages)
    }
  }, [messages, selectedChatId])

  useEffect(() => {
    if (!user) return

    // REMOVED: Full refetch timers that caused flicker
    // The per-chat realtime subscription (below) handles individual message events
    // This subscription only handles membership changes (new chats added/removed)

    const channel = supabase
      .channel(`user-conversations-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chatroom_members', filter: `user_id=eq.${user.id}` },
        () => {
          // Only reload chatrooms list when user is added to a NEW chat
          loadChatrooms()
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'chatroom_members', filter: `user_id=eq.${user.id}` },
        (payload) => {
          // Remove chatroom from list when user is removed
          const removedMembership = payload.old as { chatroom_id?: string }
          if (removedMembership?.chatroom_id) {
            setChatrooms((current) => current.filter((room) => room.id !== removedMembership.chatroom_id))
            if (selectedChatId === removedMembership.chatroom_id) {
              setSelectedChatId(null)
              setMessages([])
            }
          }
        }
      )
      .subscribe()

    // Global message subscription - updates chatroom list when messages arrive in ANY chatroom
    // This enables WhatsApp-like background sync
    const globalMessagesChannel = supabase
      .channel(`global-messages-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const newMessage = payload.new as MessageRow
          const isFromSelf = newMessage.sender_id === user.id
          const isForSelectedChat = newMessage.chatroom_id === selectedChatId

          // Check if this chatroom belongs to the user
          const chatroomExists = chatrooms.some((room) => room.id === newMessage.chatroom_id)
          if (!chatroomExists) return

          // Skip if it's for the selected chat (handled by chat-specific subscription)
          if (isForSelectedChat) return

          // Hydrate the message for preview
          const hydrated = await hydrateMessage(newMessage)

          // Update chatroom list - show new message preview and increment unread
          setChatrooms((current) => {
            const index = current.findIndex((room) => room.id === newMessage.chatroom_id)
            if (index === -1) return current

            const updated = [...current]
            const target = updated[index]
            const nextUnread = isFromSelf ? target.unreadCount : target.unreadCount + 1

            updated[index] = {
              ...target,
              lastMessage: hydrated,
              unreadCount: nextUnread,
            }

            // Sort by most recent message
            updated.sort((a, b) => {
              const aTime = new Date(a.lastMessage?.created_at ?? a.created_at).getTime()
              const bTime = new Date(b.lastMessage?.created_at ?? b.created_at).getTime()
              return bTime - aTime
            })

            return updated
          })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(globalMessagesChannel)
    }
  }, [chatrooms, hydrateMessage, loadChatrooms, selectedChatId, user])

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
        // Diff-based delete: only remove the specific message, never refetch
        setMessages((current) => current.filter((message) => message.id !== messageRow.id))
        // Update chatroom's last message if needed (incremental update)
        setChatrooms((current) => {
          const idx = current.findIndex((room) => room.id === messageRow.chatroom_id)
          if (idx === -1) return current
          const room = current[idx]
          // If the deleted message was the last message, we need to find the new last message
          if (room.lastMessage?.id === messageRow.id) {
            // Get the new last message from current messages state
            const currentMessages = messagesRef.current.filter((m) => m.id !== messageRow.id)
            const newLastMessage = currentMessages.length > 0 ? currentMessages[currentMessages.length - 1] : undefined
            const updated = [...current]
            updated[idx] = { ...room, lastMessage: newLastMessage }
            return updated
          }
          return current
        })
      })
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [hydrateMessage, markChatAsRead, selectedChatId, updateChatroomAfterMessage, user])

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
    const plaintext = composerValue.trim()
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(7)}`
    const optimisticTimestamp = new Date().toISOString()
    
    // Capture reply/forward state before clearing
    const currentReplyTo = replyingTo
    const currentForwarding = forwardingMessage
    
    try {
      const payload = await encryptMessage(plaintext)
      
      // Create optimistic message BEFORE sending to server
      // This prevents duplicate display - realtime will replace this temp message
      const optimisticMessage: MessageWithMeta = {
        id: tempId,
        chatroom_id: selectedChatId,
        sender_id: user.id,
        content: payload,
        created_at: optimisticTimestamp,
        edited_at: null,
        deleted: false,
        reply_to_message_id: currentReplyTo?.id ?? null,
        forwarded_from_message_id: currentForwarding?.id ?? null,
        decryptedContent: plaintext,
        sender: {
          id: user.id,
          name: user.name ?? 'You',
          email: user.email ?? '',
          avatar: user.profile_picture_url ?? null,
        },
        reactions: [],
        status: 'sending', // Show sending indicator
      }

      // Add optimistic message to UI immediately
      setMessages((current) => [...current, optimisticMessage])
      messagesRef.current = [...messagesRef.current, optimisticMessage]
      messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })

      // Clear input immediately for responsive UX
      setComposerValue('')
      setReplyingTo(null)
      setForwardingMessage(null)

      // Update chatroom sidebar incrementally
      updateChatroomAfterMessage(optimisticMessage, true, true)

      // Now send to server - realtime INSERT event will replace the temp message
      const insertPayload: TableInsert<'messages'> = {
        chatroom_id: selectedChatId,
        sender_id: user.id,
        content: payload,
        reply_to_message_id: currentReplyTo?.id ?? null,
        forwarded_from_message_id: currentForwarding?.id ?? null,
      }

      const { error } = await supabase
        .from('messages')
        .insert([insertPayload] as never)

      if (error) {
        // Remove optimistic message on error
        setMessages((current) => current.filter((m) => m.id !== tempId))
        messagesRef.current = messagesRef.current.filter((m) => m.id !== tempId)
        throw error
      }

      await markChatAsRead(selectedChatId)
    } catch (error: any) {
      console.error('Failed to send message:', error)
      toast.error(error.message || 'Unable to send message')
    } finally {
      setSendingMessage(false)
    }
  }

  // Handle keyboard events: Enter to send, Shift+Enter for newline
  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault() // Prevent newline
      if (composerValue.trim() && !sendingMessage && canPost && !isMuted) {
        handleSendMessage()
      }
    }
    // Shift+Enter allows default behavior (newline)
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
    
    // For DMs: Any participant can delete
    // For Groups: Only admins can delete
    const isDm = selectedChat.type === 'dm'
    const isMember = selectedChat.members.some((m) => m.id === user.id)
    const canDelete = isDm ? isMember : currentMembership?.canManageMembers
    
    if (!canDelete) {
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

    // Determine which chats the user can delete:
    // - DMs: User is a participant
    // - Groups: User has canManageMembers permission
    const deletable = targetRooms.filter((room) => {
      const isDm = room.type === 'dm'
      const membership = room.members.find((member) => member.id === user.id)
      if (isDm) {
        return !!membership // Any participant can delete a DM
      }
      return membership?.canManageMembers // Groups require admin
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
          // Only clear messages when the active chat is deleted
          setMessages([])
        }

        // Update chatrooms list by removing deleted ones (no full refetch needed)
        setChatrooms((current) => current.filter((room) => !targetSet.has(room.id)))
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
  }, [cancelBulkSelection, chatrooms, selectedChatId, selectedChatIds, setMessages, user])

  const handleReaction = async (message: MessageWithMeta, reaction: string) => {
    if (!user) return

    // Close emoji picker by removing open details
    document.querySelectorAll('details[open]').forEach((el) => el.removeAttribute('open'))

    try {
      // Check if user already has ANY reaction on this message
      const existingUserReaction = message.reactions.find(
        (entry) => entry.user_id === user.id
      )

      // Check if clicking the same emoji (to remove it)
      const clickedSameEmoji = existingUserReaction?.reaction === reaction

      if (clickedSameEmoji && existingUserReaction) {
        // Remove the reaction
        const { error } = await supabase
          .from('message_reactions')
          .delete()
          .eq('id', existingUserReaction.id)

        if (error) throw error
        setMessages((current) =>
          current.map((entry) =>
            entry.id === message.id
              ? { ...entry, reactions: entry.reactions.filter((item) => item.id !== existingUserReaction.id) }
              : entry
          )
        )
      } else if (existingUserReaction) {
        // User has a different reaction - update/replace it (UPSERT behavior)
        const { data, error } = await supabase
          .from('message_reactions')
          .update({ reaction } as never)
          .eq('id', existingUserReaction.id)
          .select('*')
          .single()

        if (error) throw error
        setMessages((current) =>
          current.map((entry) =>
            entry.id === message.id
              ? {
                  ...entry,
                  reactions: entry.reactions.map((item) =>
                    item.id === existingUserReaction.id ? (data as MessageReactionRow) : item
                  ),
                }
              : entry
          )
        )
      } else {
        // No existing reaction - insert new one
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
    <div className="relative flex h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-hidden bg-[var(--color-bg)]">
      {/* Mobile backdrop when list is open */}
      {mobileListOpen && selectedChat && (
        <div
          className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileListOpen(false)}
        />
      )}

      {/* Conversation List Panel */}
      <div
        className={classNames(
          'fixed inset-x-0 top-0 bottom-16 left-0 z-30 flex w-full flex-col transition-transform duration-300 ease-out lg:static lg:inset-auto lg:w-80 xl:w-96 lg:border-r lg:border-[color:var(--color-border)]',
          mobileListOpen || !selectedChat ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
        style={{
          background: 'var(--color-bg)',
        }}
      >
        {/* List Header */}
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-3 sm:px-4 sm:py-4 bg-[var(--color-surface)]/50">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg sm:text-xl font-semibold truncate" style={{ color: 'var(--text-primary)' }}>Messages</h2>
            <p className="text-[10px] sm:text-xs truncate" style={{ color: 'var(--text-secondary)' }}>Stay connected</p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            <button
              onClick={() => setShowCreateGroup(true)}
              className="inline-flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-xl border border-[color:var(--color-border)] transition hover:bg-[var(--accent-hover)]"
              style={{ color: 'var(--text-secondary)' }}
              aria-label="Create group chat"
            >
              <Users className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
            </button>
            <button
              onClick={() => setShowCreateDm(true)}
              className="inline-flex items-center gap-1 rounded-xl px-2.5 py-2 sm:px-3 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)' }}
              title="Add Connection"
            >
              <UserPlus className="h-3.5 w-3.5 sm:hidden" style={{ strokeWidth: 1.5 }} />
              <Plus className="h-3 w-3 hidden sm:block" style={{ strokeWidth: 1.5 }} />
              <span className="hidden xs:inline">Add Friend</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-3 pt-3 sm:px-4 sm:pt-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: 'var(--text-secondary)', strokeWidth: 1.5 }} />
            {conversationSearch && (
              <button
                type="button"
                onClick={() => setConversationSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 transition hover:bg-[var(--accent-hover)]"
                style={{ color: 'var(--text-secondary)' }}
                aria-label="Clear chat search"
              >
                <X className="h-3 w-3" style={{ strokeWidth: 1.5 }} />
              </button>
            )}
            <input
              value={conversationSearch}
              onChange={(event) => setConversationSearch(event.target.value)}
              placeholder="Search chats..."
              className="w-full pl-9 pr-9 text-sm rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] py-2.5 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto px-3 pb-4 sm:px-4 sm:pb-5">
          <section className="mt-3 sm:mt-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>Chats</h3>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                {bulkSelectMode && (
                  <button
                    onClick={handleBulkDeleteChats}
                    disabled={bulkDeleting || selectedChatIds.length === 0}
                    className={classNames(
                      'inline-flex items-center gap-1 sm:gap-2 rounded-xl border px-2 py-1 sm:px-3 text-[10px] sm:text-xs font-semibold transition',
                      selectedChatIds.length && !bulkDeleting
                        ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                        : 'border-[color:var(--color-border)]'
                    )}
                    style={selectedChatIds.length && !bulkDeleting ? {} : { color: 'var(--text-disabled)' }}
                  >
                    {bulkDeleting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Trash2 className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">Delete</span>
                    {selectedChatIds.length > 0 && ` (${selectedChatIds.length})`}
                  </button>
                )}
                <button
                  onClick={toggleBulkSelectionMode}
                  className={classNames(
                    'inline-flex items-center gap-1 sm:gap-2 rounded-xl border px-2 py-1 sm:px-3 text-[10px] sm:text-xs font-semibold transition',
                    bulkSelectMode
                      ? 'border-[color:var(--accent)]/30 hover:bg-[var(--accent-hover)]'
                      : 'border-[color:var(--color-border)] hover:bg-[var(--accent-hover)]'
                  )}
                  style={{ color: bulkSelectMode ? 'var(--accent)' : 'var(--text-secondary)' }}
                >
                  {bulkSelectMode ? 'Cancel' : 'Select' }
                </button>
              </div>
            </div>
            {bulkSelectMode && (
              <p className="text-[10px] sm:text-[11px]" style={{ color: 'var(--text-disabled)' }}>
                Select chats to delete (admin rights required).
              </p>
            )}
            {initializing ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin" style={{ color: 'var(--accent)' }} />
              </div>
            ) : conversationList.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6 text-center">
                <MessageCircle className="mx-auto h-6 w-6 sm:h-8 sm:w-8" style={{ color: 'var(--text-disabled)', strokeWidth: 1.5 }} />
                <p className="mt-2 sm:mt-3 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
                <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>Start a new chat or group.</p>
              </div>
            ) : filteredConversations.length === 0 ? (
              <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-5 text-center shadow-sm">
                <Search className="mx-auto h-5 w-5 sm:h-6 sm:w-6" style={{ color: 'var(--text-disabled)', strokeWidth: 1.5 }} />
                <p className="mt-2 text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No matches</p>
                <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>Try different keywords.</p>
              </div>
            ) : (
              filteredConversations.map((room) => {
                const isActive = !bulkSelectMode && room.id === selectedChatId
                const isSelected = selectedChatIdSet.has(room.id)
                const isRecruitment = Boolean(room.recruitment_post_id)
                const isTeam = Boolean(room.team_id)
                const displayName = getChatDisplayName(room)
                const typeBadge = room.type === 'group' ? 'Grp' : isTeam ? 'Team' : isRecruitment ? 'Rec' : null
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
                      'group relative flex w-full items-center gap-2.5 sm:gap-3 rounded-xl border px-2.5 py-2.5 sm:px-3 sm:py-3 text-left transition active:scale-[0.98]',
                      isActive
                        ? 'border-[color:var(--accent)] shadow-lg'
                        : isSelected
                          ? 'border-[color:var(--accent)]/30 bg-[var(--accent-hover)]'
                          : 'border-[color:var(--color-border)] bg-[var(--color-surface)]/60 hover:bg-[var(--accent-hover)]'
                    )}
                    style={isActive ? { 
                      background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)',
                      boxShadow: '0 8px 24px rgba(230,126,34,0.25)'
                    } : {}}
                  >
                    {bulkSelectMode && (
                      <span
                        className={classNames(
                          'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold flex-shrink-0',
                          isSelected
                            ? 'border-[color:var(--accent)] text-white'
                            : 'border-[color:var(--color-border)] text-transparent'
                        )}
                        style={isSelected ? { background: 'var(--accent)' } : { background: 'var(--color-surface)' }}
                      >
                        <Check className="h-3 w-3" style={{ strokeWidth: 1.5 }} />
                      </span>
                    )}
                    <div
                      className={classNames(
                        'flex h-10 w-10 sm:h-11 sm:w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs sm:text-sm font-semibold',
                        avatarMeta.kind === 'image'
                          ? isActive
                            ? 'ring-2 ring-white/70'
                            : 'border border-[color:var(--color-border)]'
                          : isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-[var(--accent-hover)]'
                      )}
                      style={avatarMeta.kind !== 'image' && !isActive ? { color: 'var(--accent)' } : {}}
                    >
                      {avatarMeta.kind === 'image' ? (
                        <img
                          src={avatarMeta.src}
                          alt={avatarMeta.alt}
                          className="h-full w-full object-cover"
                        />
                      ) : avatarMeta.kind === 'icon' ? (
                        <Users className={classNames('h-4 w-4 sm:h-5 sm:w-5', isActive ? 'text-white' : '')} style={!isActive ? { color: 'var(--accent)', strokeWidth: 1.5 } : { strokeWidth: 1.5 }} />
                      ) : (
                        avatarMeta.label
                      )}
                    </div>
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-semibold leading-tight truncate" style={isActive ? { color: '#FFFFFF' } : { color: 'var(--text-primary)' }}>{displayName}</p>
                        <span className="text-[10px] sm:text-xs flex-shrink-0" style={isActive ? { color: 'rgba(255,255,255,0.8)' } : { color: 'var(--text-disabled)' }}>
                          {formatRelative(room.lastMessage?.created_at ?? room.created_at)}
                        </span>
                      </div>
                      <div className="mt-0.5 sm:mt-1 flex items-center gap-1.5 sm:gap-2">
                        {room.adminOnly && (
                          <Shield className={classNames('h-3 w-3 flex-shrink-0', isActive ? 'text-white' : '')} style={!isActive ? { color: 'var(--accent)', strokeWidth: 1.5 } : { strokeWidth: 1.5 }} />
                        )}
                        {typeBadge && (
                          <span
                            className={classNames(
                              'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[8px] sm:text-[10px] font-semibold uppercase flex-shrink-0',
                              isActive ? 'border-white/30 text-white/80' : 'border-[color:var(--accent)]/30'
                            )}
                            style={!isActive ? { color: 'var(--accent)' } : {}}
                          >
                            {typeBadge}
                          </span>
                        )}
                        {/* Message status indicator for last message */}
                        {room.lastMessage && room.lastMessage.sender_id === user?.id && (
                          <span className="flex-shrink-0">
                            {room.lastMessage.status === 'seen' ? (
                              <CheckCheck className={classNames('h-3 w-3', isActive ? '' : '')} style={{ color: isActive ? 'rgba(255,255,255,0.9)' : '#60A5FA' }} />
                            ) : room.lastMessage.status === 'delivered' ? (
                              <CheckCheck className={classNames('h-3 w-3', isActive ? 'text-white/70' : '')} style={!isActive ? { color: 'var(--text-disabled)' } : {}} />
                            ) : (
                              <Check className={classNames('h-2.5 w-2.5', isActive ? 'text-white/70' : '')} style={!isActive ? { color: 'var(--text-disabled)' } : {}} />
                            )}
                          </span>
                        )}
                        <p className={classNames('flex-1 text-[10px] sm:text-xs leading-snug truncate', isActive ? 'text-white/80' : '')} style={!isActive ? { color: 'var(--text-secondary)' } : {}}>
                          {room.lastMessage?.sender_id === user?.id ? 'You: ' : ''}{room.lastMessage?.decryptedContent ?? 'No messages yet'}
                        </p>
                      </div>
                    </div>
                    {room.unreadCount > 0 && (
                      <span
                        className={classNames(
                          'ml-1 sm:ml-2 inline-flex h-5 sm:h-6 min-w-[1.25rem] sm:min-w-[1.5rem] items-center justify-center rounded-full px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold flex-shrink-0',
                          isActive ? 'bg-white' : ''
                        )}
                        style={isActive ? { color: 'var(--accent)' } : { background: 'var(--accent)', color: '#FFFFFF' }}
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
            <section className="mt-4 sm:mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)]/80 p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>Requests</h3>
                <button
                  onClick={() => setShowCreateDm(true)}
                  className="text-[10px] sm:text-xs font-semibold transition hover:opacity-80"
                  style={{ color: 'var(--accent)' }}
                >
                  Invite
                </button>
              </div>
              <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                {friendRequests.map((request) => {
                  const isIncoming = request.direction === 'incoming'
                  const isPending = request.status === 'pending'
                  return (
                    <div
                      key={request.id}
                      className="rounded-xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-2.5 sm:p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{request.peer?.name ?? 'Unknown'}</p>
                          <p className="text-[10px] sm:text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{request.peer?.email ?? '—'}</p>
                        </div>
                        <span className="text-[9px] sm:text-[11px] uppercase tracking-wide flex-shrink-0" style={{ color: 'var(--text-disabled)' }}>{request.status}</span>
                      </div>
                      <div className="mt-2 sm:mt-3 flex gap-2">
                        {isIncoming && isPending ? (
                          <>
                            <button
                              onClick={() => handleFriendRequest(request, 'accept')}
                              className="flex-1 rounded-xl px-2 py-1.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold text-white transition hover:opacity-90"
                              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)' }}
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleFriendRequest(request, 'decline')}
                              className="flex-1 rounded-xl border border-[color:var(--color-border)] px-2 py-1.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold transition hover:bg-[var(--accent-hover)]"
                              style={{ color: 'var(--text-secondary)' }}
                            >
                              Decline
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => handleFriendRequest(request, 'cancel')}
                            className="w-full rounded-xl border border-[color:var(--color-border)] px-2 py-1.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs font-semibold transition hover:bg-[var(--accent-hover)]"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            Cancel
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
            <section className="mt-4 sm:mt-6 rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-3 sm:p-4">
              <h3 className="text-[10px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>Quick friends</h3>
              <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                {friends.slice(0, 6).map((friend) => {
                  const isBusy = friendAction?.userId === friend.id
                  const isChatting = isBusy && friendAction?.type === 'chat'
                  return (
                    <div key={friend.id} className="flex items-center justify-between gap-2 sm:gap-3 min-w-0">
                      <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
                          {friend.avatar ? (
                            <img
                              src={friend.avatar}
                              alt={friend.name ?? friend.email ?? 'Friend'}
                              className="h-full w-full rounded-full object-cover border border-[color:var(--color-border)]"
                            />
                          ) : (
                            <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[var(--accent-hover)] text-xs sm:text-sm font-semibold" style={{ color: 'var(--accent)' }}>
                              {friend.name?.[0]?.toUpperCase() ?? 'F'}
                            </span>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{friend.name}</p>
                          <p className="text-[10px] sm:text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{friend.email || '—'}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleChatWithFriend(friend.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-xl border border-[color:var(--accent)]/30 px-2 py-1 sm:px-3 text-[10px] sm:text-[11px] font-semibold transition hover:bg-[var(--accent-hover)] disabled:opacity-60 flex-shrink-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        {isChatting ? <Loader2 className="h-3 w-3 animate-spin" style={{ strokeWidth: 1.5 }} /> : <MessageCircle className="h-3 w-3" style={{ strokeWidth: 1.5 }} />}
                        <span className="hidden xs:inline">Chat</span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Chat Area - Full screen on mobile when chat is selected */}
      <div 
        className={classNames(
          'fixed inset-x-0 top-0 bottom-16 z-[100] flex flex-col bg-[var(--color-bg)] transition-transform duration-300 ease-out lg:static lg:inset-auto lg:z-auto lg:flex-1 lg:translate-x-0 lg:bottom-auto lg:top-auto',
          selectedChat && !mobileListOpen
            ? 'translate-x-0' 
            : 'translate-x-full lg:translate-x-0'
        )}
      >
        {selectedChat ? (
          <div className="flex flex-col h-full">
            {/* Chat Header - Mobile Top Bar */}
            <header className="flex-shrink-0 flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-3 sm:px-4 sm:py-3 lg:px-6"
              style={{
                background: 'var(--color-surface)',
              }}
            >
              <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                {/* Back Button - Always visible on mobile */}
                <button
                  onClick={() => {
                    setSelectedChatId(null)
                    setMobileListOpen(true)
                  }}
                  className="flex items-center justify-center h-9 w-9 sm:h-10 sm:w-10 rounded-xl transition hover:bg-[var(--accent-hover)] lg:hidden flex-shrink-0"
                  style={{ color: 'var(--text-primary)' }}
                  aria-label="Back to chats"
                >
                  <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" style={{ strokeWidth: 2 }} />
                </button>
                
                {/* User/Group Info - Clickable to show details */}
                <button
                  onClick={() => setShowChatDetails(true)}
                  className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 text-left"
                >
                  {/* Avatar */}
                  <div className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0">
                    {selectedChat.type === 'dm' && dmPartner?.avatar ? (
                      <img
                        src={dmPartner.avatar}
                        alt={dmPartner.name ?? 'User'}
                        className="h-full w-full rounded-full object-cover border-2 border-[color:var(--color-border)]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-[var(--accent-hover)] text-sm font-bold" style={{ color: 'var(--accent)' }}>
                        {selectedChat.type === 'dm' 
                          ? (dmPartner?.name?.[0]?.toUpperCase() || 'U')
                          : (selectedChat.name?.[0]?.toUpperCase() || getChatDisplayName(selectedChat)[0]?.toUpperCase() || 'G')
                        }
                      </div>
                    )}
                  </div>
                  
                  {/* Name and Info */}
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm sm:text-base font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {getChatDisplayName(selectedChat)}
                    </h2>
                    <p className="text-[10px] sm:text-xs truncate" style={{ color: 'var(--text-secondary)' }}>
                      {selectedChat.members.length} participant{selectedChat.members.length === 1 ? '' : 's'}
                      <span className="hidden xs:inline"> · {hasEncryptionKey() ? 'Encrypted' : 'Encryption key not configured'}</span>
                    </p>
                  </div>
                </button>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  disabled
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ color: 'var(--text-disabled)' }}
                  title="Voice call coming soon"
                >
                  <Phone className="h-4 w-4 sm:h-5 sm:w-5" style={{ strokeWidth: 1.5 }} />
                </button>
                <button
                  disabled
                  className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ color: 'var(--text-disabled)' }}
                  title="Video call coming soon"
                >
                  <Video className="h-4 w-4 sm:h-5 sm:w-5" style={{ strokeWidth: 1.5 }} />
                </button>
                <button
                  onClick={() => setShowChatDetails(true)}
                  className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-[var(--accent-hover)]"
                  style={{ color: 'var(--text-secondary)' }}
                  aria-label="Chat details"
                >
                  <Info className="h-4 w-4 sm:h-5 sm:w-5" style={{ strokeWidth: 1.5 }} />
                </button>
                <div className="relative" ref={headerMenuRef}>
                  <button
                    onClick={() => setShowHeaderMenu((value) => !value)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl transition hover:bg-[var(--accent-hover)]"
                    style={{ color: 'var(--text-secondary)' }}
                    aria-label="More options"
                  >
                    <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" style={{ strokeWidth: 1.5 }} />
                  </button>
                  {showHeaderMenu && (
                    <div className="absolute right-0 top-11 w-44 sm:w-52 rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-1.5 sm:p-2 text-xs sm:text-sm shadow-xl" style={{ color: 'var(--text-secondary)' }}>
                      <button
                        onClick={() => {
                          setShowChatDetails(true)
                          setShowHeaderMenu(false)
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 sm:px-3 transition hover:bg-[var(--accent-hover)]"
                      >
                        <Info className="h-4 w-4" style={{ strokeWidth: 1.5 }} /> View members
                      </button>
                      {currentMembership?.canManageMembers && (
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false)
                            handleToggleAdminOnly()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 sm:px-3 transition hover:bg-[var(--accent-hover)]"
                        >
                          {adminOnlySyncing ? (
                            <Loader2 className="h-4 w-4 animate-spin" style={{ strokeWidth: 1.5 }} />
                          ) : (
                            <Shield className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
                          )}
                          {selectedChat.adminOnly ? 'Allow posts' : 'Admin only'}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setShowHeaderMenu(false)
                          handleLeaveChat()
                        }}
                        className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 sm:px-3 transition hover:bg-[var(--accent-hover)]"
                      >
                        <LogOut className="h-4 w-4" style={{ strokeWidth: 1.5 }} /> Leave chat
                      </button>
                      {currentMembership?.canManageMembers && (
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false)
                            handleDeleteChat()
                          }}
                          className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 sm:px-3 transition hover:bg-red-500/10"
                          style={{ color: '#EF4444' }}
                        >
                          <Trash2 className="h-4 w-4" style={{ strokeWidth: 1.5 }} /> Delete chat
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-2 py-3 sm:px-3 sm:py-5 lg:px-6" style={{ background: 'var(--color-bg)' }}>
              {loadingMessages && messages.length === 0 ? (
                // Skeleton UI - ONLY shown on initial chat load when no messages exist
                <div className="space-y-4 animate-pulse">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`flex items-end gap-3 ${i % 2 === 0 ? '' : 'flex-row-reverse'}`}>
                      <div className="h-9 w-9 rounded-full bg-[var(--color-muted)]" />
                      <div className={`max-w-[70%] space-y-2 ${i % 2 === 0 ? '' : 'items-end'}`}>
                        <div 
                          className="h-4 rounded bg-[var(--color-muted)]" 
                          style={{ width: `${100 + Math.random() * 100}px` }} 
                        />
                        <div 
                          className="h-12 rounded-2xl bg-[var(--color-muted)]" 
                          style={{ width: `${150 + Math.random() * 150}px` }} 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  {/* Load older messages button */}
                  {hasMoreMessagesRef.current && messages.length > 0 && (
                    <div className="flex justify-center pb-2">
                      <button
                        onClick={handleLoadOlderMessages}
                        className="px-4 py-1.5 text-xs font-medium rounded-full transition hover:bg-[var(--accent-hover)]"
                        style={{ color: 'var(--accent)', backgroundColor: 'var(--color-muted)' }}
                      >
                        Load older messages
                      </button>
                    </div>
                  )}
                  {messages.map((message) => {
                    const isSelf = message.sender_id === user.id
                    const isDeleted = message.deleted
                    return (
                      <div key={message.id} className="flex flex-col gap-1.5 sm:gap-2">
                        <div className={classNames('flex items-end gap-2 sm:gap-3', isSelf ? 'flex-row-reverse' : '')}>
                          {/* Avatar - smaller on mobile */}
                          <div className="h-7 w-7 sm:h-9 sm:w-9 shrink-0">
                            {message.sender?.avatar ? (
                              <img
                                src={message.sender.avatar}
                                alt={message.sender.name ?? message.sender.email ?? 'Chat member'}
                                className="h-full w-full rounded-full object-cover border border-[color:var(--color-border)]"
                              />
                            ) : (
                              <div className="flex h-7 w-7 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[var(--accent-hover)] text-[10px] sm:text-xs font-semibold" style={{ color: 'var(--accent)' }}>
                                {message.sender?.name?.[0]?.toUpperCase() || 'U'}
                              </div>
                            )}
                          </div>
                          {/* Message Bubble */}
                          <div
                            className={classNames(
                              'max-w-[80%] sm:max-w-[75%] rounded-2xl px-3 py-2 sm:px-4 sm:py-3 transition',
                              isSelf
                                ? 'rounded-br-none text-white'
                                : 'rounded-bl-none border border-[color:var(--color-border)]'
                            )}
                            style={isSelf ? { 
                              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)',
                              boxShadow: '0 4px 12px rgba(230,126,34,0.2)'
                            } : {
                              background: 'rgba(20, 20, 20, 0.8)',
                              color: 'var(--text-primary)'
                            }}
                          >
                            {/* Sender name and time */}
                            <div className="flex items-center justify-between gap-2 sm:gap-4">
                              <p className={classNames(
                                'text-xs sm:text-sm font-semibold truncate',
                                isSelf ? 'text-white' : ''
                              )} style={!isSelf ? { color: 'var(--accent)' } : {}}>
                                {message.sender?.name ?? 'Unknown'}
                              </p>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span className="text-[9px] sm:text-[11px] opacity-70" style={isSelf ? { color: 'rgba(255,255,255,0.8)' } : { color: 'var(--text-disabled)' }}>
                                  {new Date(message.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {/* Message Status Indicator - Only show for own messages */}
                                {isSelf && (
                                  <span className="flex items-center" title={message.status === 'seen' ? 'Seen' : message.status === 'delivered' ? 'Delivered' : message.status === 'sent' ? 'Sent' : 'Sending'}>
                                    {message.status === 'sending' ? (
                                      <Clock className="h-3 w-3 opacity-60" style={{ color: 'rgba(255,255,255,0.7)' }} />
                                    ) : message.status === 'seen' ? (
                                      <CheckCheck className="h-3.5 w-3.5" style={{ color: '#60A5FA' }} />
                                    ) : message.status === 'delivered' ? (
                                      <CheckCheck className="h-3.5 w-3.5 opacity-70" style={{ color: 'rgba(255,255,255,0.8)' }} />
                                    ) : (
                                      <Check className="h-3 w-3 opacity-70" style={{ color: 'rgba(255,255,255,0.8)' }} />
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                            {/* Reply indicator */}
                            {message.reply_to_message_id && (
                              <p className={classNames('mt-1.5 sm:mt-2 rounded-xl px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs', isSelf ? 'bg-white/15 text-white/80' : 'bg-[var(--color-surface)]')} style={!isSelf ? { color: 'var(--text-secondary)' } : {}}>
                                Reply...
                              </p>
                            )}
                            {/* Forwarded indicator */}
                            {message.forwarded_from_message_id && (
                              <p className={classNames('mt-1.5 sm:mt-2 rounded-xl px-2 py-0.5 sm:px-3 sm:py-1 text-[10px] sm:text-xs', isSelf ? 'bg-white/15 text-white/80' : 'bg-[var(--color-surface)]')} style={!isSelf ? { color: 'var(--text-secondary)' } : {}}>
                                Forwarded
                              </p>
                            )}
                            {/* Message content */}
                            <p
                              className={classNames(
                                'mt-1 sm:mt-2 text-sm sm:text-base leading-relaxed break-words',
                                isDeleted ? 'italic line-through opacity-60' : ''
                              )}
                              style={isSelf ? { color: '#ffffff' } : { color: 'var(--text-primary)' }}
                            >
                              {isDeleted ? 'Message removed' : message.decryptedContent}
                            </p>
                            {/* Action buttons - compact on mobile */}
                            <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                              <button
                                onClick={() => setReplyingTo(message)}
                                className={classNames(
                                  'inline-flex items-center gap-1 rounded-lg sm:rounded-xl px-2 py-1 sm:px-2.5 sm:py-1 transition font-medium',
                                  isSelf 
                                    ? 'bg-black/20 text-white hover:bg-black/30 border border-white/20' 
                                    : 'bg-[var(--color-surface)] hover:bg-[var(--accent-hover)] border border-[color:var(--color-border)]'
                                )}
                                style={!isSelf ? { color: 'var(--text-secondary)' } : {}}
                              >
                                <Reply className="h-3 w-3" style={{ strokeWidth: 2 }} />
                                Reply
                              </button>
                              <div className="relative emoji-picker-container">
                                <details className="group emoji-picker-details">
                                  <summary className={classNames(
                                    'flex cursor-pointer list-none items-center gap-1 rounded-lg sm:rounded-xl px-2 py-1 sm:px-2.5 sm:py-1 transition font-medium',
                                    isSelf 
                                      ? 'bg-black/20 text-white hover:bg-black/30 border border-white/20' 
                                      : 'bg-[var(--color-surface)] hover:bg-[var(--accent-hover)] border border-[color:var(--color-border)]'
                                  )}
                                  style={!isSelf ? { color: 'var(--text-secondary)' } : {}}>
                                    <Laugh className="h-3 w-3" style={{ strokeWidth: 2 }} />
                                    React
                                  </summary>
                                  <div className="absolute left-0 z-10 mt-1 sm:mt-2 flex gap-1 sm:gap-2 rounded-xl sm:rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-1.5 sm:p-2 shadow-lg">
                                    {REACTIONS.map((emoji) => (
                                      <button
                                        key={emoji}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          handleReaction(message, emoji)
                                        }}
                                        className="text-base sm:text-lg hover:scale-125 transition-transform"
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
                                  'inline-flex items-center gap-1 rounded-lg sm:rounded-xl px-2 py-1 sm:px-2.5 sm:py-1 transition font-medium',
                                  isSelf 
                                    ? 'bg-black/20 text-white hover:bg-black/30 border border-white/20' 
                                    : 'bg-[var(--color-surface)] hover:bg-[var(--accent-hover)] border border-[color:var(--color-border)]'
                                )}
                                style={!isSelf ? { color: 'var(--text-secondary)' } : {}}
                              >
                                <Forward className="h-3 w-3" style={{ strokeWidth: 2 }} /> Forward
                              </button>
                              <button
                                onClick={() => handleReportMessage(message)}
                                className={classNames(
                                  'hidden sm:inline-flex items-center gap-1 rounded-lg sm:rounded-xl px-2 py-1 sm:px-2.5 sm:py-1 transition font-medium',
                                  isSelf 
                                    ? 'bg-black/20 text-white hover:bg-black/30 border border-white/20' 
                                    : 'bg-[var(--color-surface)] hover:bg-[var(--accent-hover)] border border-[color:var(--color-border)]'
                                )}
                                style={!isSelf ? { color: 'var(--text-secondary)' } : {}}
                              >
                                <Flag className="h-3 w-3" style={{ strokeWidth: 2 }} /> Report
                              </button>
                            </div>
                            {message.reactions.length > 0 && (
                              <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                                {message.reactions.map((reaction) => (
                                  <span
                                    key={reaction.id}
                                    className={classNames(
                                      'inline-flex items-center gap-1 sm:gap-2 rounded-lg sm:rounded-xl px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm',
                                      isSelf 
                                        ? 'bg-black/20 text-white border border-white/20' 
                                        : 'bg-[var(--color-surface)] border border-[color:var(--color-border)]'
                                    )}
                                    style={!isSelf ? { color: 'var(--text-secondary)' } : {}}
                                  >
                                    {reaction.reaction}
                                    <span className="text-[9px] sm:text-[10px] uppercase tracking-wide opacity-70">
                                      {reaction.user_id === user.id 
                                        ? 'you' 
                                        : (reaction.reactor_name 
                                          || selectedChat?.members.find((m) => m.id === reaction.user_id)?.name 
                                          || 'member')}
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

            <footer className="flex-shrink-0 border-t border-[color:var(--color-border)] px-3 py-3 sm:px-4 sm:py-4 lg:px-6" style={{ background: 'var(--color-surface)' }}>
              {replyingTo && (
                <div className="mb-2 sm:mb-3 flex items-center justify-between rounded-xl sm:rounded-2xl border border-[color:var(--accent)]/30 bg-[var(--accent-hover)] px-3 py-2 sm:px-4 sm:py-3 text-[11px] sm:text-xs" style={{ color: 'var(--accent)' }}>
                  <div className="min-w-0 flex-1">
                    Replying to <span className="font-semibold">{replyingTo.sender?.name ?? 'Unknown'}</span>
                    <p className="truncate" style={{ color: 'var(--accent-light)' }}>{replyingTo.decryptedContent.slice(0, 60)}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="ml-2 flex-shrink-0 transition hover:opacity-70" style={{ color: 'var(--accent)' }}>
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ strokeWidth: 1.5 }} />
                  </button>
                </div>
              )}
              {forwardingMessage && (
                <div className="mb-2 sm:mb-3 flex items-center justify-between rounded-xl sm:rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 sm:px-4 sm:py-3 text-[11px] sm:text-xs text-amber-400">
                  <div className="min-w-0 flex-1">
                    Forwarding from <span className="font-semibold">{forwardingMessage.sender?.name ?? 'Unknown'}</span>
                    <p className="truncate text-amber-300">{forwardingMessage.decryptedContent.slice(0, 60)}</p>
                  </div>
                  <button onClick={() => setForwardingMessage(null)} className="ml-2 flex-shrink-0 text-amber-400 transition hover:text-amber-300">
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ strokeWidth: 1.5 }} />
                  </button>
                </div>
              )}

              <div className="flex items-end gap-2 sm:gap-3">
                <textarea
                  value={composerValue}
                  onChange={(event) => setComposerValue(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  placeholder={isMuted ? 'You are muted by an admin' : 'Write a message (Enter to send, Shift+Enter for new line)'}
                  disabled={sendingMessage || !canPost || isMuted}
                  className="h-12 sm:h-20 flex-1 resize-none rounded-xl sm:rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] px-3 py-2 sm:px-4 sm:py-3 text-sm outline-none transition focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/30 disabled:opacity-60"
                  style={{ color: 'var(--text-primary)' }}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={sendingMessage || !composerValue.trim() || !canPost || isMuted}
                  className="inline-flex h-10 w-10 sm:h-12 sm:w-12 flex-shrink-0 items-center justify-center rounded-xl sm:rounded-2xl text-white shadow-lg transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)' }}
                  aria-label="Send message"
                >
                  {sendingMessage ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" style={{ strokeWidth: 1.5 }} /> : <Send className="h-4 w-4 sm:h-5 sm:w-5" style={{ strokeWidth: 1.5 }} />}
                </button>
              </div>
              {!canPost && !isMuted && (
                <p className="mt-2 text-xs text-amber-400">Admins have restricted messaging in this conversation.</p>
              )}
              {isMuted && (
                <p className="mt-2 text-xs text-amber-400">You are muted in this chat. Contact an admin to restore access.</p>
              )}
            </footer>
          </div>
        ) : (
          <div className="hidden lg:flex flex-1 flex-col items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-surface) 50%, var(--color-bg) 100%)'
            }}
          >
            <MessageCircle className="h-12 w-12" style={{ color: 'var(--accent)', strokeWidth: 1.5 }} />
            <h2 className="mt-4 text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Select a conversation</h2>
            <p className="mt-2 text-sm text-center max-w-sm px-4" style={{ color: 'var(--text-secondary)' }}>
              Choose an existing chat or start a new message with a teammate or fellow student.
            </p>
            <button
              onClick={() => {
                setMobileListOpen(true)
                setShowCreateDm(true)
              }}
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)', boxShadow: '0 4px 12px rgba(230,126,34,0.25)' }}
            >
              <UserPlus className="h-4 w-4" style={{ strokeWidth: 1.5 }} /> Start a conversation
            </button>
          </div>
        )}
      </div>

      {showChatDetails && selectedChat && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-sm"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setShowChatDetails(false)
            }
          }}
        >
          <div className="h-full w-full sm:max-w-sm shadow-2xl overflow-y-auto" style={{ background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-3 py-3 sm:px-4 sm:py-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowChatDetails(false)}
                  className="rounded-xl p-1.5 sm:p-2 transition hover:bg-[var(--accent-hover)] lg:hidden"
                  style={{ color: 'var(--text-disabled)' }}
                  aria-label="Back"
                >
                  <ArrowLeft className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
                </button>
                <div>
                  <h3 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Chat details</h3>
                  <p className="text-[11px] sm:text-xs" style={{ color: 'var(--text-secondary)' }}>Manage members and permissions</p>
                </div>
              </div>
              <button
                onClick={() => setShowChatDetails(false)}
                className="rounded-xl p-1.5 sm:p-2 transition hover:bg-[var(--accent-hover)]"
                style={{ color: 'var(--text-disabled)' }}
                aria-label="Close details"
              >
                <X className="h-4 w-4" style={{ strokeWidth: 1.5 }} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-4 sm:py-5">
              <section className="space-y-2">
                <h4 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>Conversation</h4>
                <div className="rounded-xl sm:rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-bg)] p-3 sm:p-4 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <p>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Type:</span> {selectedChat.type === 'dm' ? 'Direct Message' : selectedChat.type === 'group' ? 'Group chat' : 'Conversation'}
                  </p>
                  <p>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Created:</span> {formatRelative(selectedChat.created_at)}
                  </p>
                  <p>
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Total members:</span> {selectedChat.members.length}
                  </p>
                  {selectedChat.adminOnly && <p className="text-amber-400">Posting restricted to admins</p>}
                </div>
              </section>

              <section className="mt-4 sm:mt-6 space-y-2">
                <h4 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-disabled)' }}>Quick actions</h4>
                <div className="space-y-1.5 sm:space-y-2">
                  {currentMembership?.canManageMembers && (
                    <button
                      onClick={() => {
                        handleToggleAdminOnly()
                        setShowChatDetails(false)
                      }}
                      className="flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-[color:var(--color-border)] px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold transition hover:bg-[var(--accent-hover)]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      <span>{selectedChat.adminOnly ? 'Allow all members to post' : 'Restrict posting to admins'}</span>
                      {adminOnlySyncing ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" style={{ strokeWidth: 1.5 }} /> : <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4" style={{ strokeWidth: 1.5 }} />}
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
                      className="flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-red-200 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span>Remove friend</span>
                      {friendAction?.userId === dmPartner.id && friendAction?.type === 'remove' ? (
                        <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                      ) : (
                        <UserMinus className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                      )}
                    </button>
                  )}
                  <button
                    onClick={() => {
                      handleLeaveChat()
                      setShowChatDetails(false)
                    }}
                    className="flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    <span>Leave conversation</span>
                    <LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                  {currentMembership?.canManageMembers && (
                    <button
                      onClick={() => {
                        handleDeleteChat()
                        setShowChatDetails(false)
                      }}
                      className="flex w-full items-center justify-between rounded-xl sm:rounded-2xl border border-red-200 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      <span>Delete conversation</span>
                      <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </button>
                  )}
                </div>
              </section>

              <section className="mt-4 sm:mt-6">
                <h4 className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">Members</h4>
                <div className="mt-2 sm:mt-3 space-y-2 sm:space-y-3">
                  {selectedChat.members.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl sm:rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4">
          <div className="w-full max-w-lg rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Start a conversation</h3>
                <p className="text-xs sm:text-sm text-slate-500">Send a friend request or start a DM.</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateDm(false)
                  setSelectedUserForDm('')
                  setDmSearchTerm('')
                }}
                className="rounded-lg p-1.5 sm:p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 flex-shrink-0"
                aria-label="Close new conversation dialog"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="mt-4 sm:mt-5 space-y-3 sm:space-y-4">
              <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">
                Search users
              </label>
              <input
                value={dmSearchTerm}
                onChange={(event) => setDmSearchTerm(event.target.value)}
                placeholder="Search by name or email"
                className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-slate-700"
              />
              <div className="max-h-48 sm:max-h-64 overflow-y-auto rounded-xl sm:rounded-2xl border border-slate-200">
                {filteredDmOptions.map((option) => {
                  const isSelected = selectedUserForDm === option.id
                  return (
                    <button
                      type="button"
                      key={option.id}
                      onClick={() => setSelectedUserForDm(option.id)}
                      className={classNames(
                        'flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition last:border-none',
                        isSelected ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-100'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold truncate">{option.name}</p>
                        <p className="text-[11px] sm:text-xs text-slate-500 truncate">{option.email}</p>
                      </div>
                      {isSelected && <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0 ml-2" />}
                    </button>
                  )
                })}
                {filteredDmOptions.length === 0 && (
                  <p className="px-3 py-4 sm:px-4 sm:py-5 text-xs sm:text-sm text-slate-400">No users match your search</p>
                )}
              </div>
              {selectedDmUser && (
                <div className="flex items-center justify-between rounded-xl sm:rounded-2xl border border-primary-100 bg-primary-50 px-3 py-2 sm:px-4 sm:py-3 text-xs sm:text-sm text-primary-700">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{selectedDmUser.name}</p>
                    <p className="text-[11px] sm:text-xs text-primary-600 truncate">{selectedDmUser.email}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedUserForDm('')
                      setDmSearchTerm('')
                    }}
                    className="rounded-full p-1.5 sm:p-2 text-primary-500 transition hover:bg-primary-100 flex-shrink-0 ml-2"
                    aria-label="Clear selected user"
                  >
                    <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </button>
                </div>
              )}
              <div className="flex justify-end gap-2 sm:gap-3">
                <button
                  onClick={() => {
                    setShowCreateDm(false)
                    setSelectedUserForDm('')
                    setDmSearchTerm('')
                  }}
                  className="rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDm}
                  disabled={!selectedUserForDm || isSavingFriendRequest}
                  className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-primary-500 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-primary-400 disabled:opacity-60"
                >
                  {isSavingFriendRequest ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                  Start chat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showCreateGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-2 sm:p-4">
          <div className="w-full max-w-2xl rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Create group chat</h3>
                <p className="text-xs sm:text-sm text-slate-500">Select members and assign leader privileges.</p>
              </div>
              <button
                onClick={() => {
                  setShowCreateGroup(false)
                  setGroupParticipants([])
                  setGroupName('')
                  setGroupSearchTerm('')
                }}
                className="rounded-lg p-1.5 sm:p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 flex-shrink-0"
                aria-label="Close group dialog"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="mt-4 sm:mt-5 grid gap-3 sm:gap-4 lg:grid-cols-[1fr_1fr]">
              <div className="space-y-2 sm:space-y-3">
                <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Group name
                </label>
                <input
                  value={groupName}
                  onChange={(event) => setGroupName(event.target.value)}
                  placeholder="Study group or project name"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-slate-700"
                />
                <label className="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Members
                </label>
                <input
                  value={groupSearchTerm}
                  onChange={(event) => setGroupSearchTerm(event.target.value)}
                  placeholder="Search classmates by name or email"
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2.5 sm:px-4 sm:py-3 text-sm text-slate-700"
                />
                {groupSelectedUsers.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl border border-primary-100 bg-primary-50 p-2 sm:p-3 text-[11px] sm:text-xs text-primary-700">
                    {groupSelectedUsers.map((participant) => (
                      <span
                        key={participant.id}
                        className="inline-flex items-center gap-1 sm:gap-2 rounded-full bg-white px-2 py-0.5 sm:px-3 sm:py-1 shadow-sm"
                      >
                        <span className="truncate max-w-[80px] sm:max-w-none">{participant.name}</span>
                        <button
                          onClick={() =>
                            setGroupParticipants((current) =>
                              current.filter((participantId) => participantId !== participant.id)
                            )
                          }
                          className="text-primary-500 transition hover:text-primary-700 flex-shrink-0"
                          aria-label={`Remove ${participant.name}`}
                        >
                          <X className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <div className="max-h-40 sm:max-h-64 overflow-y-auto rounded-xl sm:rounded-2xl border border-slate-200">
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
                          'flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 sm:px-4 sm:py-3 text-left text-xs sm:text-sm transition last:border-none',
                          isSelected ? 'bg-primary-50 text-primary-700' : 'text-slate-700 hover:bg-slate-100'
                        )}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold truncate">{option.name}</p>
                          <p className="text-[11px] sm:text-xs text-slate-500 truncate">{option.email}</p>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary-600 flex-shrink-0 ml-2" />}
                      </button>
                    )
                  })}
                  {filteredGroupOptions.length === 0 && (
                    <p className="px-3 py-4 sm:px-4 sm:py-5 text-xs sm:text-sm text-slate-400">No users match your search</p>
                  )}
                </div>
              </div>
              <div className="rounded-xl sm:rounded-2xl border border-slate-100 bg-slate-50 p-3 sm:p-4 text-xs sm:text-sm text-slate-600">
                <h4 className="text-xs sm:text-sm font-semibold text-slate-700">Group permissions overview</h4>
                <ul className="mt-2 sm:mt-3 space-y-1.5 sm:space-y-2 text-[11px] sm:text-xs text-slate-500">
                  <li className="flex items-start gap-1.5 sm:gap-2">
                    <Shield className="mt-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> Group creator becomes owner with all permissions
                  </li>
                  <li className="flex items-start gap-1.5 sm:gap-2">
                    <Hash className="mt-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> Promote members to moderators for message management
                  </li>
                  <li className="flex items-start gap-1.5 sm:gap-2">
                    <Ban className="mt-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> Temporarily mute disruptive members without removing them
                  </li>
                  <li className="flex items-start gap-1.5 sm:gap-2">
                    <Crown className="mt-0.5 h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" /> Owners can delegate admin rights to trusted members
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-4 sm:mt-6 flex justify-end gap-2 sm:gap-3">
              <button
                onClick={() => {
                  setShowCreateGroup(false)
                  setGroupParticipants([])
                  setGroupName('')
                  setGroupSearchTerm('')
                }}
                className="rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateGroup}
                disabled={isSavingFriendRequest || groupParticipants.length === 0}
                className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl sm:rounded-2xl bg-primary-500 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white transition hover:bg-primary-400 disabled:opacity-60"
              >
                {isSavingFriendRequest ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                Create group
              </button>
            </div>
          </div>
        </div>
      )}

      {forwardingMessage && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/60 p-2 sm:p-4">
          <div className="w-full max-w-md rounded-2xl sm:rounded-3xl bg-white p-4 sm:p-5 shadow-2xl max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Forward message</h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  Select a conversation to forward this message.
                </p>
              </div>
              <button
                onClick={() => setForwardingMessage(null)}
                className="rounded-lg p-1.5 sm:p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 flex-shrink-0"
                aria-label="Close forward dialog"
              >
                <X className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
            <div className="mt-3 sm:mt-4 space-y-1.5 sm:space-y-2">
              {chatrooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => handleForwardMessage(room.id)}
                  className="w-full rounded-xl sm:rounded-2xl border border-slate-200 px-3 py-2 sm:px-4 sm:py-3 text-left text-xs sm:text-sm text-slate-700 transition hover:bg-slate-100 truncate"
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
