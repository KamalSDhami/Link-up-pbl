import { NavLink, Link, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  MessageCircle,
  MessageSquare,
  Calendar,
  CalendarClock,
  Shield,
  UserCircle,
  UserCog,
  ShieldCheck,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'

const navigation = [
  { name: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { name: 'Teams', to: '/teams', icon: Users },
  { name: 'Recruitment', to: '/recruitment', icon: Briefcase },
  { name: 'Messages', to: '/messages', icon: MessageCircle, hasBadge: true },
  { name: 'Events', to: '/events', icon: Calendar },
  { name: 'Profile', to: '/profile', icon: UserCircle },
]

const adminNavigation = [
  {
    name: 'Admin dashboard',
    to: '/admin',
    icon: Shield,
  allowedRoles: ['super_admin', 'moderator', 'event_manager', 'god'],
  },
  {
    name: 'Event management',
    to: '/events/manage',
    icon: CalendarClock,
  allowedRoles: ['super_admin', 'event_manager', 'god'],
  },
  {
    name: 'User directory',
    to: '/admin/users',
    icon: UserCog,
  allowedRoles: ['super_admin', 'god'],
  },
  {
    name: 'Group management',
    to: '/admin/teams',
    icon: Users,
  allowedRoles: ['super_admin', 'god'],
  },
  {
    name: 'Recruitment posts',
    to: '/admin/recruitment',
    icon: Briefcase,
  allowedRoles: ['super_admin', 'god'],
  },
  {
    name: 'Moderation',
    to: '/admin/moderation',
    icon: ShieldCheck,
  allowedRoles: ['super_admin', 'moderator', 'god'],
  },
  {
    name: 'Support tickets',
    to: '/admin/tickets',
    icon: MessageSquare,
  allowedRoles: ['super_admin', 'moderator', 'god'],
  },
]

// Mobile admin navigation - condensed for bottom nav
const mobileAdminNavigation = [
  { name: 'Admin', to: '/admin', icon: Shield, allowedRoles: ['super_admin', 'moderator', 'event_manager', 'god'] },
  { name: 'Users', to: '/admin/users', icon: UserCog, allowedRoles: ['super_admin', 'god'] },
  { name: 'Teams', to: '/admin/teams', icon: Users, allowedRoles: ['super_admin', 'god'] },
  { name: 'Events', to: '/events/manage', icon: CalendarClock, allowedRoles: ['super_admin', 'event_manager', 'god'] },
  { name: 'Moderate', to: '/admin/moderation', icon: ShieldCheck, allowedRoles: ['super_admin', 'moderator', 'god'] },
]

export default function Sidebar() {
  const { user } = useAuthStore()
  const location = useLocation()
  const [isVerified, setIsVerified] = useState(true) // Default to true to hide prompt initially
  const [openTicketCount, setOpenTicketCount] = useState(0)
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  
  // Detect if we're in admin mode based on URL
  const inAdminMode = location.pathname.startsWith('/admin') || location.pathname.startsWith('/events/manage')
  
  const adminLinks = user
    ? adminNavigation.filter((entry) => entry.allowedRoles.includes(user.role))
    : []
  const showAdminLinks = adminLinks.length > 0
  
  // Mobile admin links
  const mobileAdminLinks = user
    ? mobileAdminNavigation.filter((entry) => entry.allowedRoles.includes(user.role))
    : []
  const canAccessAdmin = mobileAdminLinks.length > 0

  // Fetch open ticket count for admins
  const fetchOpenTicketCount = useCallback(async () => {
    if (!user || !['super_admin', 'moderator', 'god'].includes(user.role)) {
      setOpenTicketCount(0)
      return
    }

    try {
      const { count, error } = await supabase
        .from('support_tickets')
        .select('*', { count: 'exact', head: true })
        .in('status', ['open', 'in_progress'])

      if (!error && count) {
        setOpenTicketCount(count)
      }
    } catch (error) {
      console.error('Failed to fetch open tickets:', error)
    }
  }, [user])

  // Fetch unread messages count across all chatrooms
  const fetchUnreadMessagesCount = useCallback(async () => {
    if (!user?.id) {
      setUnreadMessagesCount(0)
      return
    }

    try {
      const { data, error } = await supabase.rpc('get_user_conversations', { p_user_id: user.id } as never)

      if (error) {
        console.error('Failed to fetch conversations:', error)
        return
      }

      const totalUnread = ((data || []) as { unread_count?: number }[]).reduce((sum: number, conv: { unread_count?: number }) => {
        return sum + (conv.unread_count || 0)
      }, 0)

      setUnreadMessagesCount(totalUnread)
    } catch (error) {
      console.error('Failed to fetch unread messages:', error)
    }
  }, [user?.id])

  useEffect(() => {
    const checkVerification = async () => {
      if (!user) return
      
      const { data } = await supabase
        .from('users')
        .select('gehu_verified')
        .eq('id', user.id)
        .single<{ gehu_verified: boolean }>()
      
      if (data) {
        setIsVerified(data.gehu_verified)
      }
    }
    
    checkVerification()
    fetchOpenTicketCount()
    fetchUnreadMessagesCount()

    // Subscribe to message changes for unread count
    const messagesChannel = supabase
      .channel('sidebar-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const msg = payload.new as { sender_id?: string }
          if (msg.sender_id !== user?.id) {
            fetchUnreadMessagesCount()
          }
        }
      )
      .subscribe()

    // Subscribe to ticket changes for admins
    if (user && ['super_admin', 'moderator', 'god'].includes(user.role)) {
      const channel = supabase
        .channel('admin-ticket-count')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'support_tickets',
          },
          () => {
            fetchOpenTicketCount()
          }
        )
        .subscribe()

      return () => {
        supabase.removeChannel(channel)
        supabase.removeChannel(messagesChannel)
      }
    }

    return () => {
      supabase.removeChannel(messagesChannel)
    }
  }, [user, fetchOpenTicketCount, fetchUnreadMessagesCount])

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:w-64 lg:pt-16 sidebar">
        <div className="flex-1 flex flex-col min-h-0 sidebar__panel">
          <div className="flex-1 flex flex-col pt-5 pb-4 overflow-y-auto">
            <nav className="flex-1 px-3 space-y-1">
              {navigation.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.to}
                  className={({ isActive }) =>
                    clsx('sidebar__item text-sm font-medium', {
                      'sidebar__item--active': isActive,
                    })
                  }
                >
                  {({ isActive }) => (
                    <>
                      <div className="relative">
                        <item.icon className={clsx('sidebar__item-icon h-5 w-5 mr-3', {
                          'text-accent': isActive,
                        })} />
                        {item.hasBadge && unreadMessagesCount > 0 && (
                          <span className="absolute -top-1.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold px-1">
                            {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                          </span>
                        )}
                      </div>
                      <span className="flex-1">{item.name}</span>
                    </>
                  )}
                </NavLink>
              ))}

              {showAdminLinks && (
                <div className="pt-6 mt-6 border-t border-[color:var(--color-border)]">
                  <p className="px-3 text-xs font-semibold sidebar__section-title mb-2">
                    Administration
                  </p>
                  {adminLinks.map((item) => (
                    <NavLink
                      key={item.name}
                      to={item.to}
                      className={({ isActive }) =>
                        clsx('sidebar__item text-sm font-medium', {
                          'sidebar__item--active': isActive,
                        })
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <item.icon className={clsx('sidebar__item-icon h-5 w-5 mr-3', {
                            'text-accent': isActive,
                          })} />
                          <span className="flex-1">{item.name}</span>
                          {item.to === '/admin/tickets' && openTicketCount > 0 && (
                            <span className="ml-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-semibold text-white">
                              {openTicketCount}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ))}
                </div>
              )}
            </nav>
          </div>

          {/* Verification Status */}
          {user && !isVerified && (
            <div className="callout m-3">
              <p className="text-xs font-medium">
                Verify your GEHU email to unlock recruitment features
              </p>
              <Link
                to="/profile?verify=1"
                className="mt-2 inline-block text-xs font-semibold text-accent-light"
              >
                Verify Now →
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <div className="lg:hidden fixed bottom-0 inset-x-0 bg-[var(--color-bg)] border-t border-[color:var(--color-border)] z-50">
        <nav className="flex justify-around">
          {inAdminMode && canAccessAdmin ? (
            // Admin mode mobile navigation
            mobileAdminLinks.slice(0, 5).map((item) => (
              <NavLink
                key={item.name}
                to={item.to}
                className={({ isActive }) =>
                  clsx(
                    'flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors',
                    isActive ? 'text-accent' : 'text-secondary hover:text-primary'
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={clsx('h-6 w-6 mb-1', isActive ? 'text-accent' : 'text-secondary')}
                    />
                    <span>{item.name}</span>
                  </>
                )}
              </NavLink>
            ))
          ) : (
            // User mode mobile navigation
          navigation.slice(0, 5).map((item) => (
            <NavLink
              key={item.name}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex-1 flex flex-col items-center py-3 text-xs font-medium transition-colors relative',
                  isActive ? 'text-accent' : 'text-secondary hover:text-primary'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <item.icon
                      className={clsx('h-6 w-6 mb-1', isActive ? 'text-accent' : 'text-secondary')}
                    />
                    {item.hasBadge && unreadMessagesCount > 0 && (
                      <span className="absolute -top-1 -right-2 min-w-[16px] h-[16px] bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold px-0.5">
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </span>
                    )}
                  </div>
                  <span>{item.name}</span>
                </>
              )}
            </NavLink>
          ))
          )}
        </nav>
      </div>
    </>
  )
}
