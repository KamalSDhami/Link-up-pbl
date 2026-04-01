import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  User,
  Moon,
  Sun,
  Shield,
  Lock,
  Save,
  Loader2,
  LogOut,
  ChevronRight,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'

interface UserProfile {
  id: string
  name: string
  email: string
  gehu_verified: boolean
  gehu_email: string | null
  profile_picture_url: string | null
}

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, refreshUser, signOut } = useAuthStore()
  const { theme, setTheme, toggleTheme } = useThemeStore()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [saving, setSaving] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }

    const loadProfile = async () => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, gehu_verified, gehu_email, profile_picture_url')
        .eq('id', user.id)
        .returns<UserProfile>()
        .single()

      if (error) {
        console.error('Error loading profile for settings:', error)
        toast.error('Failed to load profile settings')
        return
      }

  setProfile(data)
    }

    loadProfile()
  }, [navigate, user])

  if (!user || !profile) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-600" />
      </div>
    )
  }

  const themeOptions = [
    { value: 'light' as const, title: 'Light', description: 'Bright interface with high contrast.' },
    { value: 'dark' as const, title: 'Dark', description: 'Dimmed interface for low-light environments.' },
  ]

  const handleSaveProfile = async () => {
    if (!profile) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          name: profile.name,
          profile_picture_url: profile.profile_picture_url,
        })
        .eq('id', profile.id)

      if (error) throw error

      await refreshUser()
      toast.success('Profile updated')
    } catch (error: any) {
      console.error('Error saving profile:', error)
      toast.error(error.message || 'Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="mt-1 text-slate-600 dark:text-slate-400">
          Manage your account, preferences, and application appearance.
        </p>
      </div>

      <div className="space-y-6">
        {/* Theme */}
        <section className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                Theme Preference
                {isMounted && theme === 'dark' ? (
                  <Moon className="h-4 w-4 text-indigo-500" />
                ) : (
                  <Sun className="h-4 w-4 text-amber-400" />
                )}
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Switch between light and dark themes to match your environment.
              </p>
            </div>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-slate-200 px-3 py-1 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Toggle
            </button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setTheme(option.value)}
                className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                  theme === option.value
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-100'
                    : 'border-slate-200 text-slate-600 hover:border-primary-400 dark:border-slate-700 dark:text-slate-300'
                }`}
              >
                {option.value === 'dark' ? (
                  <Moon className="mt-1 h-5 w-5" />
                ) : (
                  <Sun className="mt-1 h-5 w-5" />
                )}
                <div>
                  <h3 className="text-sm font-semibold">{option.title}</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{option.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Account */}
        <section className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                Account
                <User className="h-4 w-4 text-primary-500" />
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Update your profile details and sign out.
              </p>
            </div>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save changes
            </button>
          </div>

          <div className="mt-4 grid gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Full Name
              </label>
              <input
                type="text"
                value={profile.name}
                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
                className="mt-1 w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/30 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                Email
              </label>
              <div className="mt-2 flex items-center justify-between rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300">
                <span>{profile.email}</span>
                <ChevronRight className="h-4 w-4" />
              </div>
            </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">GEHU Verification</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {profile.gehu_verified
                  ? `Verified as ${profile.gehu_email ?? 'GEHU student'}`
                  : 'Verify your institutional email to unlock recruitment features.'}
              </p>
            </div>
            <button
              onClick={() => navigate('/profile?verify=1')}
              type="button"
              className="inline-flex items-center gap-2 rounded-lg border border-primary-500 px-4 py-2 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-400 dark:text-primary-300 dark:hover:bg-primary-500/20"
            >
              <Shield className="h-4 w-4" />
              Manage verification
            </button>
          </div>
          </div>
        </section>

        <section className="card">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                Account Security
                <Lock className="h-4 w-4 text-rose-500" />
              </h2>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Manage login sessions or end access across devices.
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-400 dark:hover:bg-red-500/10"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
