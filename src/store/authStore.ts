import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { User } from '@/types'
import type { Session, RealtimeChannel } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setSession: (session: Session | null) => void
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isLoading: true,

  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),

  signOut: async () => {
    await supabase.auth.signOut()
    cleanupUserSubscription()
    set({ user: null, session: null })
  },

  refreshUser: async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (authUser) {
      const { data: userData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      if (userData) {
        set({ user: userData })
      }
    }
  },
}))

let userChannel: RealtimeChannel | null = null

const cleanupUserSubscription = () => {
  if (userChannel) {
    supabase.removeChannel(userChannel)
    userChannel = null
  }
}

const subscribeToUserChanges = (userId: string) => {
  if (!userId) return

  cleanupUserSubscription()
  userChannel = supabase
    .channel(`user-profile-${userId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'users', filter: `id=eq.${userId}` },
      (payload) => {
        const next = payload.new as User | null
        if (next) {
          useAuthStore.setState({ user: next })
        }
      }
    )
    .subscribe()
}

// Initialize auth state
supabase.auth.getSession().then(({ data: { session } }) => {
  useAuthStore.setState({ session })
  if (session) {
    subscribeToUserChanges(session.user.id)
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching user profile:', error)
        }
        useAuthStore.setState({ user: data, isLoading: false })
      })
  } else {
    cleanupUserSubscription()
    useAuthStore.setState({ isLoading: false })
  }
})

// Listen to auth changes
supabase.auth.onAuthStateChange((_event, session) => {
  useAuthStore.setState({ session })
  if (session) {
    subscribeToUserChanges(session.user.id)
    supabase
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.error('Error fetching user profile:', error)
        }
        useAuthStore.setState({ user: data, isLoading: false })
      })
  } else {
    cleanupUserSubscription()
    useAuthStore.setState({ user: null, isLoading: false })
  }
})
