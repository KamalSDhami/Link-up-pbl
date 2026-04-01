import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Bell, User, LogOut, Loader2, Shield, LayoutDashboard, HelpCircle } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { getInitials } from '@/lib/utils'
import type { TableRow } from '@/types/database'
import toast from 'react-hot-toast'

type NotificationRow = TableRow<'notifications'>

export default function Navbar() {
  const { user, signOut } = useAuthStore()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadTicketCount, setUnreadTicketCount] = useState(0)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const notificationsRef = useRef<HTMLDivElement | null>(null)
  const profileRef = useRef<HTMLDivElement | null>(null)
  const canAccessAdmin = Boolean(user && ['super_admin', 'moderator', 'event_manager', 'god'].includes(user.role))
  const inAdminMode = location.pathname.startsWith('/admin')

  const fetchUnreadCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadCount(0)
      return
    }

    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    if (error) {
      console.error('Failed to fetch unread notifications:', error)
      return
    }

    setUnreadCount(count || 0)
  }, [user?.id])

  // Fetch unread ticket count for the user
  const fetchUnreadTicketCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadTicketCount(0)
      return
    }

    try {
      // For regular users: count tickets with new admin replies since last viewed
      // For simplicity, count tickets that have status 'open' or 'in_progress' with unread admin messages
      const { data: tickets, error } = await supabase
        .from('support_tickets')
        .select('id, updated_at')
        .eq('user_id', user.id)
        .in('status', ['open', 'in_progress'])

      if (error) {
        console.error('Failed to fetch ticket count:', error)
        return
      }

      // Count tickets with recent admin replies
      let unreadCount = 0
      for (const ticket of (tickets || []) as { id: string; updated_at: string }[]) {
        const { count, error: msgError } = await supabase
          .from('ticket_messages')
          .select('*', { count: 'exact', head: true })
          .eq('ticket_id', ticket.id)
          .eq('is_admin_reply', true)
          .gt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days

        if (!msgError && count && count > 0) {
          unreadCount++
        }
      }

      setUnreadTicketCount(unreadCount)
    } catch (error) {
      console.error('Failed to fetch ticket count:', error)
    }
  }, [user?.id])

  useEffect(() => {
    if (!user) return

    fetchUnreadCount()
    fetchUnreadTicketCount()

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          fetchUnreadCount()
        }
      )
      .subscribe()

    // Subscribe to ticket message updates for the user
    const ticketChannel = supabase
      .channel('user-ticket-updates')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ticket_messages',
        },
        (payload) => {
          const msg = payload.new as { is_admin_reply?: boolean }
          if (msg.is_admin_reply) {
            fetchUnreadTicketCount()
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      supabase.removeChannel(ticketChannel)
    }
  }, [user, fetchUnreadCount, fetchUnreadTicketCount])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false)
      }
      if (profileRef.current && !profileRef.current.contains(target)) {
        setShowProfile(false)
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowNotifications(false)
        setShowProfile(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  return (
    <nav className="topbar sticky top-0 z-50">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/dashboard" className="flex items-center space-x-2">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(230,126,34,0.48), rgba(255,179,71,0.42))', border: '1px solid rgba(230,126,34,0.35)' }}>
              <span className="text-primary font-bold text-xl" style={{ color: 'var(--text-primary)' }}>L</span>
            </div>
            <span className="text-2xl font-display font-bold text-gradient">Linkup</span>
          </Link>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {canAccessAdmin && (
              <Link
                to={inAdminMode ? '/dashboard' : '/admin'}
                className={`hidden sm:inline-flex items-center gap-2 text-sm font-semibold transition ${
                  inAdminMode ? 'btn-outline' : 'btn-primary'
                }`}
              >
                {inAdminMode ? <LayoutDashboard className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                {inAdminMode ? 'User panel' : 'Admin panel'}
              </Link>
            )}
            {/* Notifications */}
            <div ref={notificationsRef} className="relative">
              <button
                onClick={() =>
                  setShowNotifications((prev) => {
                    const next = !prev
                    if (next) {
                      setShowProfile(false)
                    }
                    return next
                  })
                }
                className="relative p-2 rounded-lg transition-colors text-secondary hover:bg-[var(--accent-hover)] hover:text-primary"
              >
                <Bell className="w-6 h-6" />
                {unreadCount > 0 && (
                  <span className="absolute top-0 right-0 w-5 h-5 bg-[var(--accent)] text-primary text-xs rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[color:var(--color-border)] py-2 animate-in">
                  <NotificationsList
                    userId={user?.id || ''}
                    onNotificationRead={fetchUnreadCount}
                    onClose={() => setShowNotifications(false)}
                  />
                </div>
              )}
            </div>

            {/* Profile */}
            <div ref={profileRef} className="relative">
              <button
                onClick={() =>
                  setShowProfile((prev) => {
                    const next = !prev
                    if (next) {
                      setShowNotifications(false)
                    }
                    return next
                  })
                }
                className="flex items-center space-x-2 p-2 rounded-lg transition-colors hover:bg-[var(--accent-hover)]"
              >
                {user?.profile_picture_url ? (
                  <img
                    src={user.profile_picture_url}
                    alt={user.name}
                    className="w-8 h-8 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(230,126,34,0.45), rgba(255,179,71,0.4))', border: '1px solid rgba(230,126,34,0.35)' }}>
                    <span className="text-primary text-sm font-semibold">
                      {user ? getInitials(user.name) : 'U'}
                    </span>
                  </div>
                )}
                <span
                  className="hidden max-w-[160px] truncate text-sm font-medium text-secondary md:block"
                  title={user?.name || undefined}
                >
                  {user?.name}
                </span>
              </button>

              {showProfile && (
                <div className="absolute right-0 mt-2 w-56 bg-[var(--color-surface)] rounded-xl shadow-2xl border border-[color:var(--color-border)] py-2 animate-in">
                  <div className="px-4 py-3 border-b border-[color:var(--color-border)]">
                    <p className="text-sm font-semibold text-primary">{user?.name}</p>
                    <p className="text-xs text-secondary break-all" title={user?.email || undefined}>
                      {user?.email}
                    </p>
                  </div>
                  <Link
                    to="/profile"
                    className="flex items-center space-x-2 px-4 py-2 transition-colors hover:bg-[var(--accent-hover)]"
                    onClick={() => setShowProfile(false)}
                  >
                    <User className="w-4 h-4" />
                    <span className="text-sm">View Profile</span>
                  </Link>
                  <Link
                    to="/help"
                    className="flex items-center justify-between px-4 py-2 transition-colors hover:bg-[var(--accent-hover)]"
                    onClick={() => setShowProfile(false)}
                  >
                    <span className="flex items-center space-x-2">
                      <HelpCircle className="w-4 h-4" />
                      <span className="text-sm">Support &amp; Help</span>
                    </span>
                    {unreadTicketCount > 0 && (
                      <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                        {unreadTicketCount}
                      </span>
                    )}
                  </Link>
                  {canAccessAdmin && (
                    <Link
                      to={inAdminMode ? '/dashboard' : '/admin'}
                      className="flex items-center space-x-2 px-4 py-2 transition-colors hover:bg-[var(--accent-hover)]"
                      onClick={() => setShowProfile(false)}
                    >
                      {inAdminMode ? <LayoutDashboard className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      <span className="text-sm">{inAdminMode ? 'User panel' : 'Admin panel'}</span>
                    </Link>
                  )}
                  <button
                    onClick={signOut}
                    className="w-full flex items-center space-x-2 px-4 py-2 transition-colors hover:bg-[var(--accent-hover)] text-accent-light"
                  >
                    <LogOut className="w-4 h-4" />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

interface NotificationsListProps {
  userId: string
  onNotificationRead?: () => void
  onClose?: () => void
}

function NotificationsList({ userId, onNotificationRead, onClose }: NotificationsListProps) {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<NotificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [clearing, setClearing] = useState(false)

  const loadNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setLoading(false)
      return
    }

    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10)

    if (error) {
      console.error('Failed to load notifications:', error)
      setNotifications([])
    } else {
      setNotifications((data || []) as NotificationRow[])
    }

    setLoading(false)
  }, [userId])

  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  const handleClearAll = async () => {
    if (!userId || notifications.length === 0) {
      return
    }

    setClearing(true)
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('user_id', userId)

      if (error) throw error

      setNotifications([])
      await loadNotifications()
      onNotificationRead?.()
      toast.success('Notifications cleared')
    } catch (error) {
      console.error('Failed to clear notifications:', error)
      toast.error('Unable to clear notifications')
    } finally {
      setClearing(false)
    }
  }

  const handleNotificationClick = async (notification: NotificationRow) => {
    if (!notification.read) {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true } as never)
        .eq('id', notification.id)

      if (error) {
        console.error('Failed to mark notification as read:', error)
      } else {
        setNotifications((prev) => prev.filter((item) => item.id !== notification.id))
        onNotificationRead?.()
      }
    }

    onClose?.()
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const isClearDisabled = loading || clearing || notifications.length === 0

  let body: ReactNode
  if (loading) {
    body = (
      <div className="flex items-center justify-center px-4 py-8 text-secondary">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    )
  } else if (notifications.length === 0) {
    body = (
      <div className="px-4 py-8 text-center text-secondary">
        <p className="text-sm">No notifications yet</p>
      </div>
    )
  } else {
    body = notifications.map((notification) => (
      <button
        key={notification.id}
        onClick={() => handleNotificationClick(notification)}
        className={`w-full text-left px-4 py-3 transition-colors ${
          notification.read ? 'hover:bg-[var(--accent-hover)]' : 'bg-[rgba(230,126,34,0.14)] hover:bg-[rgba(230,126,34,0.18)]'
        }`}
      >
        <p className="text-sm font-medium text-primary">{notification.title}</p>
        <p className="mt-1 text-xs text-secondary">{notification.message}</p>
      </button>
    ))
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[color:var(--color-border)]">
        <h3 className="font-semibold text-primary">Notifications</h3>
        <button
          type="button"
          onClick={handleClearAll}
          className="text-xs font-semibold text-secondary transition hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isClearDisabled}
        >
          {clearing ? 'Clearing…' : 'Clear'}
        </button>
      </div>
      <div className="max-h-96 overflow-y-auto">{body}</div>
    </div>
  )
}
