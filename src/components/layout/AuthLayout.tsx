import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useEffect } from 'react'

export default function AuthLayout() {
  const { user, session, isLoading } = useAuthStore()

  useEffect(() => {
    console.log('AuthLayout state:', { user: !!user, session: !!session, isLoading })
  }, [user, session, isLoading])

  // Show loading while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // If user is already logged in, redirect to dashboard
  if (user) {
    console.log('User is logged in, redirecting to dashboard')
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Outlet />
      </div>
    </div>
  )
}


