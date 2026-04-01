import { supabase } from '@/lib/supabase'
import type { TableInsert, TableRow } from '@/types/database'

export const generateUuid = () => {
  const globalCrypto =
    typeof crypto !== 'undefined' ? (crypto as Crypto & { randomUUID?: () => string }) : undefined

  if (globalCrypto?.randomUUID) {
    return globalCrypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0
    const value = char === 'x' ? rand : (rand & 0x3) | 0x8
    return value.toString(16)
  })
}

const isMissingGroupRpc = (error: any) => {
  if (!error) return false
  const codeMatch = typeof error.code === 'string' && error.code === '42883'
  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  const messageMatch = message.includes('create_group_chatroom') || message.includes('schema cache')
  return codeMatch || messageMatch
}

const sanitizeGroupParticipants = (ownerId: string, participantIds: string[]) => {
  return Array.from(new Set(participantIds)).filter((id) => id && id !== ownerId)
}

const fallbackGroupName = (name: string | null | undefined) => {
  const trimmed = name?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : 'Group chat'
}

const cleanupGroupProvisioning = async (chatroomId: string) => {
  await Promise.allSettled([
    supabase.from('chatroom_roles').delete().eq('chatroom_id', chatroomId),
    supabase.from('chatroom_members').delete().eq('chatroom_id', chatroomId),
    supabase.from('chatrooms').delete().eq('id', chatroomId),
  ])
}

// Provision a new group chat using the RPC if present, otherwise fall back to direct inserts.
export const provisionGroupChatroom = async (options: {
  ownerId: string
  name?: string | null
  participantIds: string[]
}) => {
  const { ownerId } = options
  const desiredName = options.name ?? null
  const participants = sanitizeGroupParticipants(ownerId, options.participantIds)

  try {
    const { data, error } = await supabase.rpc<string>('create_group_chatroom', {
      p_name: desiredName ? desiredName.trim() || null : null,
      p_participants: participants,
    } as never)

    if (error) throw error
    if (!data) {
      throw new Error('Group chat creation did not return an identifier')
    }

    return data
  } catch (rpcError: any) {
    if (!isMissingGroupRpc(rpcError)) {
      throw rpcError
    }

    console.warn('create_group_chatroom RPC unavailable, falling back to client-side provisioning', rpcError)

    const chatroomId = generateUuid()
    const nameForInsert = fallbackGroupName(desiredName ?? null)

    const chatroomInsert: TableInsert<'chatrooms'> = {
      id: chatroomId,
      type: 'group',
      name: nameForInsert,
      archived: false,
    }

    const { error: chatroomError } = await supabase
      .from('chatrooms')
      .insert([chatroomInsert] as never, { returning: 'minimal' } as any)

    if (chatroomError) {
      throw chatroomError
    }

    const membershipPayload: TableInsert<'chatroom_members'>[] = [
      {
        chatroom_id: chatroomId,
        user_id: ownerId,
      },
      ...participants.map<TableInsert<'chatroom_members'>>((participantId) => ({
        chatroom_id: chatroomId,
        user_id: participantId,
      })),
    ]

    const { error: memberError } = await supabase
      .from('chatroom_members')
      .insert(membershipPayload as never, { returning: 'minimal' } as any)

    if (memberError && memberError.code !== '23505') {
      await cleanupGroupProvisioning(chatroomId)
      throw memberError
    }

    const rolePayload: TableInsert<'chatroom_roles'>[] = [
      {
        chatroom_id: chatroomId,
        user_id: ownerId,
        role: 'owner',
        can_post: true,
        can_manage_members: true,
        can_manage_messages: true,
      },
      ...participants.map<TableInsert<'chatroom_roles'>>((participantId) => ({
        chatroom_id: chatroomId,
        user_id: participantId,
        role: 'member',
        can_post: true,
        can_manage_members: false,
        can_manage_messages: false,
      })),
    ]

    const { error: roleError } = await supabase
      .from('chatroom_roles')
      .upsert(rolePayload as never, { onConflict: 'chatroom_id,user_id' })

    if (roleError) {
      await cleanupGroupProvisioning(chatroomId)
      throw roleError
    }

    return chatroomId
  }
}

export const ensureTeamChatroom = async (options: {
  teamId: string
  teamName: string | null
  leaderId: string
  memberIds: string[]
}) => {
  const { teamId, teamName, leaderId } = options
  const memberIds = Array.from(new Set(options.memberIds))

  const { data: chatroomRows, error: fetchError } = await supabase
    .from('chatrooms')
    .select('id, archived, created_at')
    .eq('team_id', teamId)
    .order('created_at', { ascending: true })

  if (fetchError) {
    throw fetchError
  }

  const normalizedRows = (chatroomRows || []) as Array<
    Pick<TableRow<'chatrooms'>, 'id' | 'archived'> & { created_at?: string | null }
  >

  const [primaryChatroom, ...duplicateChatrooms] = normalizedRows
  const chatroomId = primaryChatroom?.id ?? generateUuid()

  if (primaryChatroom && duplicateChatrooms.length) {
    const duplicateIdsToArchive = duplicateChatrooms
      .filter((chatroom) => chatroom.id !== chatroomId && !chatroom.archived)
      .map((chatroom) => chatroom.id)

    if (duplicateIdsToArchive.length) {
      const { error: archiveError } = await supabase
        .from('chatrooms')
        .update({ archived: true } as never)
        .in('id', duplicateIdsToArchive)

      if (archiveError) {
        console.warn('Failed to archive duplicate team chatrooms', {
          teamId,
          duplicateIds: duplicateIdsToArchive,
          archiveError,
        })
      }
    }
  }

  if (!primaryChatroom) {
    const chatroomInsert: TableInsert<'chatrooms'> = {
      id: chatroomId,
      type: 'team',
      team_id: teamId,
      name: teamName,
      recruitment_post_id: null,
    }

    const { error: createError } = await supabase
      .from('chatrooms')
      .insert([chatroomInsert] as never, { returning: 'minimal' } as any)

    if (createError) throw createError

    const leaderMembership: TableInsert<'chatroom_members'> = {
      chatroom_id: chatroomId,
      user_id: leaderId,
    }

    const { error: leaderMembershipError } = await supabase
      .from('chatroom_members')
      .insert([leaderMembership] as never, { returning: 'minimal' } as any)

    if (leaderMembershipError && leaderMembershipError.code !== '23505') {
      throw leaderMembershipError
    }

    const leaderRole: TableInsert<'chatroom_roles'> = {
      chatroom_id: chatroomId,
      user_id: leaderId,
      role: 'owner',
      can_post: true,
      can_manage_members: true,
      can_manage_messages: true,
    }

    const { error: leaderRoleError } = await supabase
      .from('chatroom_roles')
      .upsert(leaderRole as never)

    if (leaderRoleError) throw leaderRoleError
  }

  if (!memberIds.length) {
    return chatroomId
  }

  const { data: existingMemberRows, error: memberQueryError } = await supabase
    .from('chatroom_members')
    .select('user_id')
    .eq('chatroom_id', chatroomId)

  if (memberQueryError) throw memberQueryError

  const existingMembers = (existingMemberRows || []) as Pick<TableRow<'chatroom_members'>, 'user_id'>[]
  const presentMembers = new Set(existingMembers.map((row) => row.user_id))
  const missingMembers = memberIds.filter((memberId) => !presentMembers.has(memberId))

  if (missingMembers.length) {
    const memberPayload: TableInsert<'chatroom_members'>[] = missingMembers.map((memberId) => ({
      chatroom_id: chatroomId,
      user_id: memberId,
    }))

    const { error: insertMembersError } = await supabase
      .from('chatroom_members')
      .insert(memberPayload as never)

    if (insertMembersError && insertMembersError.code !== '23505') {
      throw insertMembersError
    }

    const rolePayload: TableInsert<'chatroom_roles'>[] = missingMembers.map((memberId) => ({
      chatroom_id: chatroomId,
      user_id: memberId,
      role: memberId === leaderId ? 'owner' : 'member',
      can_post: true,
      can_manage_members: memberId === leaderId,
      can_manage_messages: memberId === leaderId,
    }))

    const { error: roleError } = await supabase
      .from('chatroom_roles')
      .upsert(rolePayload as never, { onConflict: 'chatroom_id,user_id' })

    if (roleError) throw roleError
  }

  return chatroomId
}

export const removeMemberFromTeamChat = async (teamId: string, memberId: string) => {
  const { data: chatroomRecord, error: fetchError } = await supabase
    .from('chatrooms')
    .select('id')
    .eq('team_id', teamId)
    .maybeSingle<TableRow<'chatrooms'>>()

  if (fetchError && fetchError.code !== 'PGRST116') {
    throw fetchError
  }

  const chatroomId = chatroomRecord?.id
  if (!chatroomId) {
    return
  }

  const { error: membershipError } = await supabase
    .from('chatroom_members')
    .delete()
    .eq('chatroom_id', chatroomId)
    .eq('user_id', memberId)

  if (membershipError && membershipError.code !== 'PGRST116') {
    throw membershipError
  }

  const { error: roleError } = await supabase
    .from('chatroom_roles')
    .delete()
    .eq('chatroom_id', chatroomId)
    .eq('user_id', memberId)

  if (roleError && roleError.code !== 'PGRST116') {
    throw roleError
  }
}
