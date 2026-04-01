import { supabase } from '@/lib/supabase'

interface NotificationPayload {
  userId: string
  type: 'application' | 'team_invite' | 'message' | 'system' | 'event'
  title: string
  message: string
  link?: string | null
}

let notificationRpcUnavailable = false

export async function sendNotification({ userId, type, title, message, link = null }: NotificationPayload) {
  if (!userId) return

  if (notificationRpcUnavailable) {
    console.debug('Notification RPC unavailable; skipping notification dispatch')
    return
  }

  const fallbackInsert = async () => {
    const { data } = await supabase.auth.getSession()
    const role = data.session?.user?.app_metadata?.role

    if (role !== 'service_role') {
      console.warn('Notification fallback skipped due to client-side RLS constraints')
      return
    }

    const { error: insertError } = await supabase
      .from('notifications')
      .insert(
        [
          {
            user_id: userId,
            type,
            title,
            message,
            link,
            read: false,
          },
        ] as never
      )

    if (insertError) {
      if (insertError.code === '42501') {
        console.warn('Notification fallback blocked by RLS; skipping client-side insert')
        return
      }

      console.error('Failed to persist notification fallback', insertError)
    }
  }

  try {
    // @ts-expect-error - Supabase types need regeneration for create_notification RPC
    const { error } = await supabase.rpc('create_notification', {
      target_user: userId,
      notif_type: type,
      notif_title: title,
      notif_message: message,
      notif_link: link,
    })

    if (error) {
      if (error.code === 'PGRST202') {
        console.warn('Notification RPC missing, falling back to direct insert')
        notificationRpcUnavailable = true
        await fallbackInsert()
        return
      }

      console.error('Failed to send notification', error)
    }
  } catch (error) {
    console.error('Failed to send notification', error)
    await fallbackInsert()
  }
}
