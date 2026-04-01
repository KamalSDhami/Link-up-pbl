import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Users, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { TableInsert, TableRow } from '@/types/database'
import { ensureTeamChatroom } from '@/utils/chatrooms'

type TeamInsert = TableInsert<'teams'>
type TeamRow = TableRow<'teams'>
type TeamMemberInsert = TableInsert<'team_members'>

export default function CreateTeamPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [isVerified, setIsVerified] = useState(false)
  const [checkingVerification, setCheckingVerification] = useState(true)
  
  const [formData, setFormData] = useState<{
    name: string
    description: string
    year: number
    purpose: 'hackathon' | 'college_event' | 'pbl' | 'other'
    max_size: number
  }>({
    name: '',
    description: '',
    year: 1,
    purpose: 'pbl',
    max_size: 4,
  })

  useEffect(() => {
    checkVerification()
  }, [user])

  const checkVerification = async () => {
    if (!user) {
      navigate('/login')
      return
    }

    try {
      const { data, error } = await supabase
        .from('users')
        .select('gehu_verified')
        .eq('id', user.id)
        .single<{ gehu_verified: boolean }>()

      if (error) throw error
      setIsVerified(data?.gehu_verified || false)
    } catch (error) {
      console.error('Error checking verification:', error)
    } finally {
      setCheckingVerification(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!isVerified) {
      toast.error('You must verify your GEHU email before creating a team')
      navigate('/profile')
      return
    }

    if (!formData.name.trim()) {
      toast.error('Team name is required')
      return
    }

    if (formData.name.length < 3) {
      toast.error('Team name must be at least 3 characters')
      return
    }

    if (formData.name.length > 50) {
      toast.error('Team name must be less than 50 characters')
      return
    }

    if (formData.max_size < 1 || formData.max_size > 10) {
      toast.error('Team size must be between 1 and 10 members')
      return
    }

    setLoading(true)
    try {
      // Check team limits based on purpose
      const { data: userTeams, error: teamCheckError } = await supabase
        .from('teams')
        .select('id, purpose')
        .eq('leader_id', user!.id)
        .returns<{ id: string; purpose: 'hackathon' | 'college_event' | 'pbl' | 'other' }[]>()

      if (teamCheckError) {
        throw teamCheckError
      }

      // Count teams by purpose
      const teamsByPurpose = (userTeams || []).reduce<Record<string, number>>((acc, team) => {
        acc[team.purpose] = (acc[team.purpose] || 0) + 1
        return acc
      }, {})

      // Define limits for each purpose
      const limits: Record<string, { max: number; label: string }> = {
        'pbl': { max: 2, label: 'PBL' },
        'hackathon': { max: 5, label: 'hackathon' },
        'other': { max: 5, label: 'other' },
        'college_event': { max: 999, label: 'college event' } // No practical limit
      }

      const currentCount = teamsByPurpose[formData.purpose] || 0
      const limit = limits[formData.purpose]

      if (currentCount >= limit.max) {
        toast.error(`You can only lead ${limit.max} ${limit.label} team${limit.max > 1 ? 's' : ''} at a time.`)
        setLoading(false)
        return
      }

      const teamInsert: TeamInsert = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        year: formData.year,
        leader_id: user!.id,
        purpose: formData.purpose,
        max_size: formData.max_size,
        member_count: 1,
        is_full: false,
      }

      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert([teamInsert] as never)
        .select()
        .single<TeamRow>()

      if (teamError) throw teamError

      const memberInsert: TeamMemberInsert = {
        team_id: team.id,
        user_id: user!.id,
      }

      const { error: memberError } = await supabase
        .from('team_members')
        .insert([memberInsert] as never)

      if (memberError) throw memberError

      try {
        await ensureTeamChatroom({
          teamId: team.id,
          teamName: team.name,
          leaderId: user!.id,
          memberIds: [user!.id],
        })
      } catch (chatError) {
        console.error('Failed to set up team chat:', chatError)
        toast.error('Team chat could not be provisioned. Try again from team details.')
      }

      toast.success('🎉 Team created successfully!')
      navigate(`/teams/${team.id}`)
    } catch (error: any) {
      console.error('Error creating team:', error)
      toast.error(error.message || 'Failed to create team')
    } finally {
      setLoading(false)
    }
  }

  if (checkingVerification) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate('/teams')}
          className="rounded-lg p-2 transition-colors hover:bg-secondary-100"
        >
          <ArrowLeft className="h-5 w-5 text-secondary-600" />
        </button>
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-display font-bold text-secondary-900">
            <Users className="h-8 w-8 text-primary-600" />
            Create New Team
          </h1>
          <p className="mt-1 text-secondary-600">
            Build your dream team and collaborate on projects
          </p>
        </div>
      </div>

      {/* Verification Warning */}
      {!isVerified && (
        <div className="card bg-amber-50 border border-amber-200">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-900">
                GEHU Email Verification Required
              </h3>
              <p className="text-sm text-amber-700 mt-1">
                You must verify your GEHU email address before creating a team.
              </p>
              <button
                onClick={() => navigate('/profile?verify=1')}
                className="btn-primary mt-3"
              >
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Team Name */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Team Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Code Warriors, Design Masters"
              className="input-field"
              disabled={!isVerified || loading}
              maxLength={50}
            />
            <p className="mt-1 text-xs text-secondary-500">
              {formData.name.length}/50 characters
            </p>
          </div>

          {/* Year */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Team Year <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.year}
              onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
              className="input-field"
              disabled={!isVerified || loading}
            >
              <option value={1}>1st Year</option>
              <option value={2}>2nd Year</option>
              <option value={3}>3rd Year</option>
              <option value={4}>4th Year</option>
            </select>
            <p className="mt-1 text-xs text-secondary-500">
              Select the primary year for your team
            </p>
          </div>

          {/* Team Purpose */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Team Purpose
            </label>
            <select
              value={formData.purpose}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  purpose: e.target.value as typeof prev.purpose,
                }))
              }
              className="input-field"
              disabled={!isVerified || loading}
            >
              <option value="hackathon">Hackathon</option>
              <option value="college_event">College Event</option>
              <option value="pbl">Project Based Learning</option>
              <option value="other">Other</option>
            </select>
            <p className="mt-1 text-xs text-secondary-500">
              Helps members understand the focus of your team.
            </p>
          </div>

          {/* Team Size */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Team Capacity
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={formData.max_size}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  max_size: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                }))
              }
              className="input-field"
              disabled={!isVerified || loading}
            />
            <p className="mt-1 text-xs text-secondary-500">
              Maximum members allowed (including you). Current limit: {formData.max_size}.
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-secondary-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe your team's goals, projects, and what you're looking for..."
              rows={4}
              className="input-field resize-none"
              disabled={!isVerified || loading}
              maxLength={500}
            />
            <p className="mt-1 text-xs text-secondary-500">
              {formData.description.length}/500 characters
            </p>
          </div>

          {/* Guidelines */}
          <div className="bg-primary-50 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-secondary-900">
                <p className="font-medium mb-2">Team Guidelines:</p>
                <ul className="space-y-1 list-disc list-inside text-secondary-600">
                  <li>You can only lead one team at a time</li>
                  <li>Team name must be unique and appropriate</li>
                  <li>You'll be automatically added as the first member</li>
                  <li>Adjust team size later, but it must be at least your current member count</li>
                  <li>You can add more members and post recruitments after creation</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={() => navigate('/teams')}
              className="flex-1 btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isVerified || loading || !formData.name.trim()}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Create Team
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
