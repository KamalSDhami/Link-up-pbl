import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Users, 
  Briefcase, 
  MessageSquare, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle,
  ArrowRight,
  UserPlus,
  FileText
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'

// Helper function to convert name to title case
const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface DashboardStats {
  teamCount: number
  applicationCount: number
  unreadMessages: number
  recruitmentPosts: number
}

interface UserProfile {
  name: string
  section: string | null
  year: number | null
  gehu_verified: boolean
  skills: string[]
}

export default function DashboardPage() {
  const { user } = useAuthStore()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<DashboardStats>({
    teamCount: 0,
    applicationCount: 0,
    unreadMessages: 0,
    recruitmentPosts: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadDashboardData()
  }, [user])

  const loadDashboardData = async () => {
    if (!user) return

    try {
      // Load all data in parallel for faster loading
      const [
        { data: profileData },
        { count: teamCount },
        { count: applicationCount },
        { count: unreadMessages },
        { count: recruitmentPosts }
      ] = await Promise.all([
        // Load user profile
        supabase
          .from('users')
          .select('name, section, year, gehu_verified, skills')
          .eq('id', user.id)
          .single(),
        
        // Load team count
        supabase
          .from('team_members')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id),
        
        // Load application count
        supabase
          .from('applications')
          .select('*', { count: 'exact', head: true })
          .eq('applicant_id', user.id),
        
        // Load unread notifications count
        supabase
          .from('notifications')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('read', false),
        
        // Load active recruitment posts count
        supabase
          .from('recruitment_posts')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'open')
      ])

      if (profileData) {
        setProfile(profileData)
      }

      setStats({
        teamCount: teamCount || 0,
        applicationCount: applicationCount || 0,
        unreadMessages: unreadMessages || 0,
        recruitmentPosts: recruitmentPosts || 0,
      })
    } catch (error) {
      console.error('Error loading dashboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const isProfileComplete = profile?.section && profile?.year && profile.skills.length > 0

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="glass relative overflow-hidden" style={{ 
        background: 'linear-gradient(135deg, rgba(230,126,34,0.15) 0%, rgba(255,179,71,0.12) 100%)',
        border: '1px solid rgba(230,126,34,0.25)',
        padding: '2rem',
        borderRadius: '20px'
      }}>
        <div className="flex items-center justify-between relative z-10">
          <div>
            <h1 className="text-3xl font-display font-bold mb-2 text-primary">
              Welcome back, {profile?.name ? toTitleCase(profile.name) : 'User'}! 👋
            </h1>
            <p className="text-secondary">
              {isProfileComplete
                ? 'Your profile is complete. Start exploring teams!'
                : 'Please complete your profile to unlock all features'}
            </p>
          </div>
          <div className="hidden md:block">
            <div className="w-24 h-24 rounded-full flex items-center justify-center glass" style={{
              background: 'rgba(230,126,34,0.08)',
              border: '1px solid rgba(230,126,34,0.2)'
            }}>
              <Users className="w-12 h-12 text-accent" style={{ strokeWidth: 1.5 }} />
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-accent/5 to-transparent rounded-full blur-3xl"></div>
      </div>

      {/* Profile Completion Alert */}
      {!isProfileComplete && (
        <div className="callout animate-slide-in">
          <div className="flex items-start gap-4">
            <AlertCircle className="w-6 h-6 text-accent-light flex-shrink-0 mt-0.5" style={{ strokeWidth: 1.5 }} />
            <div className="flex-1">
              <h3 className="font-semibold text-primary mb-1">
                Complete Your Profile
              </h3>
              <p className="text-secondary text-sm mb-3">
                Add your year, section, and skills to start creating or joining teams
              </p>
              <Link
                to="/profile-setup"
                className="btn-primary inline-flex items-center gap-2 group"
              >
                Complete Now
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card group cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center glass transition-all group-hover:scale-110" style={{
              background: 'rgba(230,126,34,0.08)',
              border: '1px solid rgba(230,126,34,0.2)'
            }}>
              <Users className="w-6 h-6 text-accent" style={{ strokeWidth: 1.5 }} />
            </div>
            <TrendingUp className="w-5 h-5 text-accent-light opacity-60" style={{ strokeWidth: 1.5 }} />
          </div>
          <h3 className="text-2xl font-bold text-accent">{stats.teamCount}</h3>
          <p className="text-secondary text-sm">Your Teams</p>
        </div>

        <div className="stat-card group cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center glass transition-all group-hover:scale-110" style={{
              background: 'rgba(230,126,34,0.08)',
              border: '1px solid rgba(230,126,34,0.2)'
            }}>
              <FileText className="w-6 h-6 text-accent" style={{ strokeWidth: 1.5 }} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">{stats.applicationCount}</h3>
          <p className="text-secondary text-sm">Applications Sent</p>
        </div>

        <div className="stat-card group cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center glass transition-all group-hover:scale-110" style={{
              background: 'rgba(230,126,34,0.08)',
              border: '1px solid rgba(230,126,34,0.2)'
            }}>
              <MessageSquare className="w-6 h-6 text-accent" style={{ strokeWidth: 1.5 }} />
            </div>
            {stats.unreadMessages > 0 && (
              <span className="px-2 py-1 bg-accent text-primary text-xs font-bold rounded-full">
                {stats.unreadMessages}
              </span>
            )}
          </div>
          <h3 className="text-2xl font-bold text-accent">{stats.unreadMessages}</h3>
          <p className="text-secondary text-sm">Unread Notifications</p>
        </div>

        <div className="stat-card group cursor-pointer">
          <div className="flex items-center justify-between mb-2">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center glass transition-all group-hover:scale-110" style={{
              background: 'rgba(230,126,34,0.08)',
              border: '1px solid rgba(230,126,34,0.2)'
            }}>
              <Briefcase className="w-6 h-6 text-accent" style={{ strokeWidth: 1.5 }} />
            </div>
          </div>
          <h3 className="text-2xl font-bold text-accent">{stats.recruitmentPosts}</h3>
          <p className="text-secondary text-sm">Open Positions</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card">
        <h2 className="text-xl font-display font-bold text-primary mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link
            to="/teams"
            className="flex items-center gap-4 p-4 glass rounded-xl transition-all group hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(230,126,34,0.08) 0%, rgba(255,179,71,0.06) 100%)',
              border: '1px solid rgba(230,126,34,0.15)'
            }}
          >
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-accent">
              <Users className="w-6 h-6 text-primary" style={{ strokeWidth: 1.5 }} />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Browse Teams</h3>
              <p className="text-sm text-secondary">Find your perfect team</p>
            </div>
          </Link>

          <Link
            to="/teams/create"
            className="flex items-center gap-4 p-4 glass rounded-xl transition-all group hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(230,126,34,0.08) 0%, rgba(255,179,71,0.06) 100%)',
              border: '1px solid rgba(230,126,34,0.15)'
            }}
          >
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-accent">
              <UserPlus className="w-6 h-6 text-primary" style={{ strokeWidth: 1.5 }} />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Create Team</h3>
              <p className="text-sm text-secondary">Start your own team</p>
            </div>
          </Link>

          <Link
            to="/recruitment"
            className="flex items-center gap-4 p-4 glass rounded-xl transition-all group hover:scale-[1.02]"
            style={{
              background: 'linear-gradient(135deg, rgba(230,126,34,0.08) 0%, rgba(255,179,71,0.06) 100%)',
              border: '1px solid rgba(230,126,34,0.15)'
            }}
          >
            <div className="w-12 h-12 bg-accent rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-accent">
              <Briefcase className="w-6 h-6 text-primary" style={{ strokeWidth: 1.5 }} />
            </div>
            <div>
              <h3 className="font-semibold text-primary">Find Opportunities</h3>
              <p className="text-sm text-secondary">Browse open positions</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Profile Summary */}
      {isProfileComplete && (
        <div className="card">
          <h2 className="text-xl font-display font-bold text-primary mb-4">
            Your Profile
          </h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-accent-light" style={{ strokeWidth: 1.5 }} />
              <span className="text-secondary">
                Year {profile.year} · Section {profile.section}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {profile.gehu_verified ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-accent-light" style={{ strokeWidth: 1.5 }} />
                  <span className="text-secondary">GEHU Email Verified</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-5 h-5 text-accent-light" style={{ strokeWidth: 1.5 }} />
                  <span className="text-secondary">
                    GEHU Email Not Verified ·{' '}
                    <Link to="/profile?verify=1" className="text-accent hover:text-accent-light transition-colors">
                      Verify Now
                    </Link>
                  </span>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mt-3">
              {profile.skills.map((skill) => (
                <span
                  key={skill}
                  className="badge"
                >
                  {skill}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

