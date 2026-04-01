import { useState, useEffect, useRef, type ChangeEvent } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import {
  User,
  Mail,
  GraduationCap,
  Github,
  Linkedin,
  Edit2,
  Save,
  X,
  Shield,
  Users,
  FileText,
  Tag,
  Eye,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Camera,
  Trash2,
  LayoutDashboard,
} from 'lucide-react'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'

// Helper function to convert name to title case
const toTitleCase = (str: string) => {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

interface UserProfile {
  id: string
  email: string
  name: string
  profile_picture_url: string | null
  section: string | null
  year: number | null
  gender: 'male' | 'female' | 'non_binary' | 'prefer_not_to_say' | 'other' | null
  skills: string[]
  github_url: string | null
  linkedin_url: string | null
  social_visibility: 'always' | 'on_application' | 'hidden'
  gehu_verified: boolean
  gehu_email: string | null
  role: string
  created_at: string
}

interface ProfileStats {
  teamCount: number
  applicationCount: number
}

const SECTIONS = (() => {
  const sections = []
  for (let letter = 65; letter <= 90; letter++) { // A-Z
    for (let num = 1; num <= 2; num++) {
      sections.push(`${String.fromCharCode(letter)}${num}`)
    }
  }
  const specialtySections = ['CS1', 'CS2', 'CS3', 'CS4', 'DS1', 'DS2', 'DS3', 'DS4', 'ML1', 'ML2', 'ML3', 'ML4']
  sections.push(...specialtySections)
  return sections
})()
const YEARS = [1, 2, 3, 4]
const VISIBILITY_OPTIONS = [
  { value: 'always', label: 'Always Visible', icon: Eye },
  { value: 'on_application', label: 'On Application', icon: FileText },
  { value: 'hidden', label: 'Hidden', icon: X },
]

const GENDER_OPTIONS: Array<{ value: UserProfile['gender']; label: string }> = [
  { value: null, label: 'Prefer not to say' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'other', label: 'Other' },
]

const handleFunctionError = (error: unknown) => {
  if (error instanceof FunctionsHttpError) {
    const status =
      (typeof (error as any).status === 'number' ? (error as any).status : undefined) ??
      (typeof error.context?.status === 'number' ? error.context.status : undefined) ??
      500

    try {
      const payload = error.context?.response ? JSON.parse(error.context.response) : null
      const code = payload?.code
      const message = typeof payload?.error === 'string' ? payload.error : undefined

      if (status === 403 && code === 'RESEND_DOMAIN_UNVERIFIED') {
        return new Error(
          'Email provider is still in sandbox mode. Verify your Resend domain to enable GEHU verification emails.',
        )
      }

      if (status === 403) {
        return new Error(message ?? 'Email provider rejected this request. Please contact support.')
      }

      if (status === 404) {
        return new Error('Verification service is unavailable right now. Please try again shortly.')
      }

      if (status >= 500) {
        return new Error('Email service is temporarily unavailable. Please try again later.')
      }

      if (message) {
        return new Error(message)
      }
    } catch (parseError) {
      console.warn('Failed to parse edge function error payload', parseError)
    }
  }

  return new Error('Failed to send verification email. Please try again in a moment.')
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const [searchParams, setSearchParams] = useSearchParams()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<ProfileStats>({ teamCount: 0, applicationCount: 0 })
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [showVerificationModal, setShowVerificationModal] = useState(false)
  const [verificationEmail, setVerificationEmail] = useState('')
  const [sendingVerification, setSendingVerification] = useState(false)
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState('')
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [deletingAccount, setDeletingAccount] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  
  const [editForm, setEditForm] = useState({
    name: '',
    section: '',
    year: 1,
    gender: null as UserProfile['gender'],
    skills: [] as string[],
    github_url: '',
    linkedin_url: '',
    social_visibility: 'on_application' as 'always' | 'on_application' | 'hidden',
  })

  const currentGenderLabel = profile
    ? GENDER_OPTIONS.find((option) => option.value === profile.gender)?.label ?? 'Prefer not to say'
    : 'Prefer not to say'

  useEffect(() => {
    if (!user) {
      navigate('/login')
      return
    }
    loadProfile()
    loadStats()
  }, [user, navigate])

  useEffect(() => {
    if (searchParams.get('verify') === '1') {
      setShowVerificationModal(true)
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('verify')
      setSearchParams(nextParams, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const loadProfile = async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (error) throw error

      const profileData = data as UserProfile
      const normalizedGender = (profileData.gender === 'prefer_not_to_say' ? null : profileData.gender) as UserProfile['gender']
      const sanitizedProfile: UserProfile = { ...profileData, gender: normalizedGender }

      setProfile(sanitizedProfile)
      setEditForm({
        name: sanitizedProfile.name || '',
        section: sanitizedProfile.section || '',
        year: sanitizedProfile.year || 1,
        gender: normalizedGender,
        skills: sanitizedProfile.skills || [],
        github_url: sanitizedProfile.github_url || '',
        linkedin_url: sanitizedProfile.linkedin_url || '',
        social_visibility: sanitizedProfile.social_visibility || 'on_application',
      })
    } catch (error) {
      console.error('Error loading profile:', error)
      toast.error('Failed to load profile')
    } finally {
      setLoading(false)
    }
  }

  const loadStats = async () => {
    if (!user) return

    try {
      const { count: teamCount } = await supabase
        .from('team_members')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)

      const { count: applicationCount } = await supabase
        .from('applications')
        .select('*', { count: 'exact', head: true })
        .eq('applicant_id', user.id)

      setStats({
        teamCount: teamCount || 0,
        applicationCount: applicationCount || 0,
      })
    } catch (error) {
      console.error('Error loading stats:', error)
    }
  }

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!user || !file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file')
      event.target.value = ''
      return
    }

    const sizeLimitMb = 2
    if (file.size > sizeLimitMb * 1024 * 1024) {
      toast.error(`Image must be smaller than ${sizeLimitMb}MB`)
      event.target.value = ''
      return
    }

    const extension = file.name.split('.').pop() || 'jpg'
    const filePath = `${user.id}/${Date.now()}.${extension}`

    setUploadingAvatar(true)
    try {
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(filePath, file, {
          upsert: true,
          contentType: file.type,
          cacheControl: '3600',
        })

      if (uploadError) throw uploadError

      const {
        data: { publicUrl },
      } = supabase.storage.from('profile-pictures').getPublicUrl(filePath)

      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          profile_picture_url: publicUrl,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (updateError) throw updateError

      toast.success('Profile picture updated')
      await loadProfile()
    } catch (error: any) {
      console.error('Error uploading avatar:', error)
      toast.error(error.message || 'Failed to upload profile picture')
    } finally {
      event.target.value = ''
      setUploadingAvatar(false)
    }
  }

  const handleRemoveAvatar = async () => {
    if (!user) return

    try {
      const { error } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          profile_picture_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile picture removed')
      await loadProfile()
    } catch (error: any) {
      console.error('Error removing avatar:', error)
      toast.error(error.message || 'Failed to remove profile picture')
    }
  }

  const openDeleteModal = () => {
    setDeleteConfirmation('')
    setShowDeleteModal(true)
  }

  const closeDeleteModal = () => {
    if (deletingAccount) return
    setShowDeleteModal(false)
    setDeleteConfirmation('')
  }

  const handleDeleteAccount = async () => {
    if (!user) return

    const confirmationMatches = deleteConfirmation.trim().toUpperCase() === 'DELETE'
    if (!confirmationMatches) {
      toast.error('Please type DELETE to confirm account removal')
      return
    }

    setDeletingAccount(true)
    try {
      const { error } = await supabase.rpc('delete_user_account')
      if (error) throw error

      try {
        await signOut()
      } catch (signOutError) {
        console.warn('Sign out after account deletion failed:', signOutError)
      }
      toast.success('Account deleted successfully')
      navigate('/login', { replace: true })
    } catch (error: any) {
      console.error('Error deleting account:', error)
      toast.error(error.message || 'Failed to delete account')
    } finally {
      setDeletingAccount(false)
      setDeleteConfirmation('')
      setShowDeleteModal(false)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          name: editForm.name,
          section: editForm.section || null,
          year: editForm.year,
          gender: editForm.gender,
          skills: editForm.skills,
          github_url: editForm.github_url || null,
          linkedin_url: editForm.linkedin_url || null,
          social_visibility: editForm.social_visibility,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile updated successfully!')
      setIsEditing(false)
      loadProfile()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      toast.error(error.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const addSkill = () => {
    if (skillInput.trim() && !editForm.skills.includes(skillInput.trim())) {
      setEditForm({
        ...editForm,
        skills: [...editForm.skills, skillInput.trim()],
      })
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setEditForm({
      ...editForm,
      skills: editForm.skills.filter((s) => s !== skill),
    })
  }

  const handleCancel = () => {
    if (profile) {
      setEditForm({
        name: profile.name || '',
        section: profile.section || '',
        year: profile.year || 1,
        gender: profile.gender ?? null,
        skills: profile.skills || [],
        github_url: profile.github_url || '',
        linkedin_url: profile.linkedin_url || '',
        social_visibility: profile.social_visibility || 'on_application',
      })
    }
    setIsEditing(false)
  }

  const handleSendVerification = async () => {
    if (!verificationEmail.trim()) {
      toast.error('Please enter your GEHU email')
      return
    }

    if (!verificationEmail.endsWith('@gehu.ac.in')) {
      toast.error('Please enter a valid GEHU email address (@gehu.ac.in)')
      return
    }

    setSendingVerification(true)
    try {
      // Check if email is already used by another user
      const { data: existingUser } = await supabase
        .from('users')
        .select('id')
        .eq('gehu_email', verificationEmail)
        .neq('id', user!.id)
        .maybeSingle()

      if (existingUser) {
        toast.error('This GEHU email is already verified by another user')
        setSendingVerification(false)
        return
      }

      // Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()

      // Store OTP in database with 10-minute expiry
      const expiresAt = new Date()
      expiresAt.setMinutes(expiresAt.getMinutes() + 10)

      // First, delete ALL existing OTPs for this user to prevent conflicts
      // This is critical to avoid duplicate key violations
      const { error: deleteError } = await supabase
        .from('verification_otps')
        .delete()
        .eq('user_id', user!.id)

      if (deleteError) {
        console.error('Failed to delete old OTPs:', deleteError)
        // Don't proceed if we can't delete old records
        throw new Error('Failed to clear old verification codes. Please try again.')
      }

      // Small delay to ensure delete completes in database
      await new Promise(resolve => setTimeout(resolve, 100))

      // Now insert new OTP
      const { error: otpError } = await supabase
        .from('verification_otps')
        // @ts-expect-error - Supabase type definition needs regeneration
        .insert({
          user_id: user!.id,
          email: verificationEmail,
          otp: generatedOtp,
          expires_at: expiresAt.toISOString(),
          verified: false,
        })

      if (otpError) {
        console.error('Failed to insert OTP:', otpError)
        throw otpError
      }

      const { error: emailError } = await supabase.functions.invoke('send-verification-email', {
        body: {
          email: verificationEmail,
          otp: generatedOtp,
        },
      })

      if (emailError) {
        const handled = handleFunctionError(emailError)
        throw handled
      }

      toast.success(`Verification code sent to ${verificationEmail}!`, { duration: 5000 })
      
      setOtpSent(true)

    } catch (error: any) {
      console.error('Error sending verification:', error)
      toast.error(error.message || 'Failed to send verification code')
    } finally {
      setSendingVerification(false)
    }
  }

  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP')
      return
    }

    setVerifyingOtp(true)
    try {
      // Check if OTP is valid and not expired
      const { data: otpData, error: otpError } = await supabase
        .from('verification_otps')
        .select('*')
        .eq('user_id', user!.id)
        .eq('email', verificationEmail)
        .eq('otp', otp)
        .eq('verified', false)
        .single()

      if (otpError || !otpData) {
        toast.error('Invalid or expired OTP. Please try again.')
        setVerifyingOtp(false)
        return
      }

      // Check if OTP has expired (with type assertion)
      const otpRecord = otpData as any
      if (new Date(otpRecord.expires_at) < new Date()) {
        toast.error('OTP has expired. Please request a new one.')
        setVerifyingOtp(false)
        return
      }

      // Mark OTP as verified
      await supabase
        .from('verification_otps')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({ verified: true })
        .eq('id', otpRecord.id)

      // Update user as verified
      const { error: updateError } = await supabase
        .from('users')
        // @ts-expect-error - Supabase type definition needs regeneration
        .update({
          gehu_verified: true,
          gehu_email: verificationEmail,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user!.id)

      if (updateError) throw updateError

      toast.success('🎉 GEHU email verified successfully!')
      
      // Reset modal state
      setShowVerificationModal(false)
      setVerificationEmail('')
      setOtp('')
      setOtpSent(false)
      
      // Reload profile to show verification badge
      loadProfile()

    } catch (error: any) {
      console.error('Error verifying OTP:', error)
      toast.error(error.message || 'Failed to verify OTP')
    } finally {
      setVerifyingOtp(false)
    }
  }

  const handleResendOtp = async () => {
    setOtp('')
    setOtpSent(false)
    await handleSendVerification()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">Profile not found</h2>
          <p className="text-slate-600">Unable to load your profile</p>
        </div>
      </div>
    )
  }

  const canAccessAdminPanel = ['super_admin', 'moderator', 'event_manager', 'god'].includes(profile.role)

  return (
    <div className="space-y-4 sm:space-y-6 px-2 sm:px-0 pb-6">
      {/* Header with Edit Button */}
      <div className="flex flex-col gap-3">
        <div className="text-center sm:text-left">
          <h1 className="text-2xl sm:text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>My Profile</h1>
          <p className="mt-1 text-sm sm:text-base" style={{ color: 'var(--text-secondary)' }}>Manage your profile information</p>
        </div>
        <div className="flex flex-col w-full gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {canAccessAdminPanel && (
            <Link
              to="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition w-full sm:w-auto"
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)' }}
            >
              <LayoutDashboard className="h-4 w-4 flex-shrink-0" />
              <span>Admin panel</span>
            </Link>
          )}
          {!isEditing ? (
            <button onClick={() => setIsEditing(true)} className="btn-primary w-full sm:w-auto justify-center">
              <Edit2 className="w-4 h-4 flex-shrink-0" />
              <span>Edit Profile</span>
            </button>
          ) : (
            <div className="flex flex-col w-full gap-2 sm:flex-row sm:w-auto">
              <button onClick={handleCancel} className="btn-secondary w-full sm:w-auto justify-center" disabled={saving}>
                <X className="w-4 h-4 flex-shrink-0" />
                <span>Cancel</span>
              </button>
              <button onClick={handleSave} className="btn-primary w-full sm:w-auto justify-center" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 flex-shrink-0" />
                    <span>Save Changes</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Header Card */}
      <div className="card text-white overflow-hidden p-4 sm:p-6" style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-secondary, #D35400))' }}>
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start sm:gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              className="hidden"
            />
            <div className="relative group">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border-4 border-white/30 overflow-hidden">
                {profile.profile_picture_url ? (
                  <img
                    src={profile.profile_picture_url}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                )}
              </div>

              {isEditing && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-1 rounded-full bg-slate-900/70 text-white text-xs font-medium opacity-100 sm:opacity-0 transition-opacity sm:group-hover:opacity-100"
                  disabled={uploadingAvatar}
                >
                  {uploadingAvatar ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                  <span className="text-[10px] sm:text-xs">{uploadingAvatar ? 'Uploading' : 'Change'}</span>
                </button>
              )}
            </div>

            {isEditing && profile.profile_picture_url && (
              <button
                type="button"
                onClick={handleRemoveAvatar}
                className="mt-2 text-xs font-medium text-white/90 hover:text-white underline-offset-2 hover:underline disabled:opacity-60"
                disabled={uploadingAvatar}
              >
                Remove photo
              </button>
            )}
          </div>

          {/* Profile Info */}
          <div className="flex-1 min-w-0 w-full text-center sm:text-left overflow-hidden">
            <div className="flex flex-col items-center gap-2 sm:flex-row sm:flex-wrap sm:justify-start sm:gap-3 mb-3">
              {isEditing ? (
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="text-xl sm:text-2xl font-bold bg-white/20 border-2 border-white/30 rounded-lg px-3 py-1.5 text-white placeholder-white/60 w-full max-w-full text-center sm:text-left"
                  placeholder="Your Name"
                />
              ) : (
                <h2 className="text-xl sm:text-2xl font-bold break-words max-w-full overflow-hidden text-ellipsis">{toTitleCase(profile.name)}</h2>
              )}
              {profile.gehu_verified && (
                <div className="flex flex-shrink-0 items-center gap-1 px-2.5 py-1 bg-green-500/30 rounded-full border border-green-400/50">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm font-medium whitespace-nowrap">GEHU Verified</span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2 text-primary-100 mb-3">
              <div className="flex items-center justify-center gap-2 sm:justify-start overflow-hidden">
                <Mail className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none">{profile.email}</span>
              </div>
              {profile.gehu_verified && profile.gehu_email && (
                <div className="flex items-center justify-center gap-2 sm:justify-start overflow-hidden">
                  <Mail className="w-4 h-4 flex-shrink-0" />
                  <span className="text-xs sm:text-sm truncate max-w-[200px] sm:max-w-none">{profile.gehu_email}</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {isEditing ? (
                <div className="flex flex-col w-full gap-2 sm:flex-row sm:flex-wrap sm:w-auto">
                  <select
                    value={editForm.year}
                    onChange={(e) => setEditForm({ ...editForm, year: Number(e.target.value) })}
                    className="bg-white/20 border-2 border-white/30 rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer hover:bg-white/30 transition w-full sm:w-auto"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23fff\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {YEARS.map((year) => (
                      <option key={year} value={year} style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                        Year {year}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.section}
                    onChange={(e) => setEditForm({ ...editForm, section: e.target.value })}
                    className="bg-white/20 border-2 border-white/30 rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer hover:bg-white/30 transition w-full sm:w-auto"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23fff\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    <option value="" style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>Select Section</option>
                    {SECTIONS.map((section) => (
                      <option key={section} value={section} style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                        Section {section}
                      </option>
                    ))}
                  </select>
                  <select
                    value={editForm.gender ?? ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        gender: (e.target.value || null) as UserProfile['gender'],
                      })
                    }
                    className="bg-white/20 border-2 border-white/30 rounded-lg px-3 py-2 text-white text-sm appearance-none cursor-pointer hover:bg-white/30 transition w-full sm:w-auto"
                    style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 20 20\'%3E%3Cpath stroke=\'%23fff\' stroke-linecap=\'round\' stroke-linejoin=\'round\' stroke-width=\'1.5\' d=\'M6 8l4 4 4-4\'/%3E%3C/svg%3E")',
                      backgroundPosition: 'right 0.5rem center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '1.5em 1.5em',
                      paddingRight: '2.5rem'
                    }}
                  >
                    {GENDER_OPTIONS.map((option) => (
                      <option key={option.value ?? 'unspecified'} value={option.value ?? ''} style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  {profile.year && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-lg">
                      <GraduationCap className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      <span className="text-xs sm:text-sm font-medium">Year {profile.year}</span>
                    </div>
                  )}
                  {profile.section && (
                    <div className="px-2.5 py-1 bg-white/20 rounded-lg">
                      <span className="text-xs sm:text-sm font-medium">Section {profile.section}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-white/20 rounded-lg">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="text-xs sm:text-sm font-medium">{currentGenderLabel}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-4">
        <div className="card p-3 sm:p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-0" style={{ backgroundColor: 'var(--color-surface)' }}>
              <Users className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.teamCount}</p>
              <p className="text-[10px] sm:text-sm leading-tight" style={{ color: 'var(--text-secondary)' }}>Teams</p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-0" style={{ backgroundColor: 'var(--color-surface)' }}>
              <FileText className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.applicationCount}</p>
              <p className="text-[10px] sm:text-sm leading-tight" style={{ color: 'var(--text-secondary)' }}>Apps</p>
            </div>
          </div>
        </div>

        <div className="card p-3 sm:p-6">
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:text-left sm:gap-4">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center mb-2 sm:mb-0" style={{ backgroundColor: 'var(--color-surface)' }}>
              <Tag className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {isEditing ? editForm.skills.length : profile.skills.length}
              </p>
              <p className="text-[10px] sm:text-sm leading-tight" style={{ color: 'var(--text-secondary)' }}>Skills</p>
            </div>
          </div>
        </div>
      </div>

      {/* Skills Section */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Tag className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <h3 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Skills & Technologies</h3>
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
                placeholder="Add a skill (e.g., React, Python)"
                className="input-field flex-1 text-sm sm:text-base"
              />
              <button
                type="button"
                onClick={addSkill}
                className="btn-primary w-full sm:w-auto justify-center"
              >
                Add
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 sm:gap-2">
              {editForm.skills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium"
                  style={{ backgroundColor: 'var(--color-surface)', color: 'var(--accent)' }}
                >
                  <span className="truncate max-w-[100px] sm:max-w-none">{skill}</span>
                  <button
                    onClick={() => removeSkill(skill)}
                    className="rounded-full p-0.5 transition-colors flex-shrink-0"
                    style={{ backgroundColor: 'transparent' }}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
        ) : profile.skills.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium truncate max-w-[120px] sm:max-w-none"
                style={{ backgroundColor: 'var(--color-surface)', color: 'var(--accent)' }}
              >
                {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-tertiary)' }}>No skills added yet</p>
        )}
      </div>

      {/* Social Links Section */}
      <div className="card p-4 sm:p-6">
        <div className="flex items-center gap-2 mb-4">
          <Github className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: 'var(--accent)' }} />
          <h3 className="text-base sm:text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Social Links</h3>
        </div>

        <div className="space-y-4">
          {/* GitHub */}
          <div>
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>GitHub Profile</span>
            </label>
            {isEditing ? (
              <input
                type="url"
                value={editForm.github_url}
                onChange={(e) => setEditForm({ ...editForm, github_url: e.target.value })}
                placeholder="https://github.com/username"
                className="input-field text-sm sm:text-base"
              />
            ) : profile.github_url ? (
              <a
                href={profile.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm break-all hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {profile.github_url}
              </a>
            ) : (
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-tertiary)' }}>Not added</p>
            )}
          </div>

          {/* LinkedIn */}
          <div>
            <label className="flex items-center gap-1.5 text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              <Linkedin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span>LinkedIn Profile</span>
            </label>
            {isEditing ? (
              <input
                type="url"
                value={editForm.linkedin_url}
                onChange={(e) => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                placeholder="https://linkedin.com/in/username"
                className="input-field text-sm sm:text-base"
              />
            ) : profile.linkedin_url ? (
              <a
                href={profile.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm break-all hover:underline"
                style={{ color: 'var(--accent)' }}
              >
                {profile.linkedin_url}
              </a>
            ) : (
              <p className="text-xs sm:text-sm" style={{ color: 'var(--text-tertiary)' }}>Not added</p>
            )}
          </div>

          {/* Visibility Settings */}
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
              Social Links Visibility
            </label>
            {isEditing ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                {VISIBILITY_OPTIONS.map((option) => {
                  const Icon = option.icon
                  const isSelected = editForm.social_visibility === option.value
                  return (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 sm:gap-3 p-2.5 sm:p-3 border-2 rounded-lg cursor-pointer transition-all"
                      style={{
                        borderColor: isSelected ? 'var(--accent)' : 'var(--color-border)',
                        backgroundColor: isSelected ? 'rgba(230, 126, 34, 0.1)' : 'transparent'
                      }}
                    >
                      <input
                        type="radio"
                        name="visibility"
                        value={option.value}
                        checked={isSelected}
                        onChange={(e) =>
                          setEditForm({
                            ...editForm,
                            social_visibility: e.target.value as 'always' | 'on_application' | 'hidden',
                          })
                        }
                        className="sr-only"
                      />
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-secondary)' }} />
                      <span className="text-xs sm:text-sm font-medium" style={{ color: isSelected ? 'var(--accent)' : 'var(--text-primary)' }}>{option.label}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs sm:text-sm" style={{ backgroundColor: 'var(--color-surface)', color: 'var(--text-primary)' }}>
                {VISIBILITY_OPTIONS.find((opt) => opt.value === profile.social_visibility)?.label ||
                  'On Application'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* GEHU Verification Section */}
      {!profile.gehu_verified && (
        <div className="card p-4 sm:p-6 border-2" style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', borderColor: 'rgba(251, 191, 36, 0.3)' }}>
          <div className="flex flex-col items-center text-center gap-3 sm:flex-row sm:items-start sm:text-left sm:gap-4">
            <div className="w-10 h-10 sm:w-auto sm:h-auto rounded-full flex items-center justify-center sm:block" style={{ backgroundColor: 'rgba(251, 191, 36, 0.2)' }}>
              <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" style={{ color: '#F59E0B' }} />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-sm sm:text-base mb-1" style={{ color: '#F59E0B' }}>GEHU Verification Pending</h3>
              <p className="text-xs sm:text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
                Verify your GEHU email to unlock team creation and additional features
              </p>
              <button
                onClick={() => setShowVerificationModal(true)}
                className="w-full sm:w-auto px-4 py-2.5 rounded-lg font-medium transition-colors text-xs sm:text-sm"
                style={{ backgroundColor: '#F59E0B', color: '#fff' }}
              >
                Verify Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danger Zone */}
      <div className="card p-4 sm:p-6 border" style={{ borderColor: 'rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)' }}>
        <div className="flex flex-col items-center text-center gap-3 sm:flex-row sm:items-center sm:text-left sm:justify-between sm:gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold" style={{ color: '#DC2626' }}>Delete Account</h3>
            <p className="text-xs sm:text-sm mt-1" style={{ color: '#B91C1C' }}>
              Permanently remove your account, teams, and data. This cannot be undone.
            </p>
          </div>
          <button
            type="button"
            onClick={openDeleteModal}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs sm:text-sm font-semibold shadow-sm transition-colors focus:outline-none focus:ring-2 flex-shrink-0"
            style={{ borderColor: '#F87171', color: '#B91C1C', backgroundColor: 'transparent' }}
          >
            <Trash2 className="h-4 w-4 flex-shrink-0" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--color-card, #1a1a1a)' }}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h3 className="text-lg sm:text-xl font-semibold" style={{ color: '#DC2626' }}>Confirm account deletion</h3>
                <p className="mt-2 text-xs sm:text-sm" style={{ color: 'var(--text-secondary)' }}>
                  This will permanently remove your profile, teams, and data. Type <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>DELETE</span> to continue.
                </p>
              </div>
              <button
                onClick={closeDeleteModal}
                className="rounded-lg p-2 transition flex-shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
                aria-label="Close delete account dialog"
                disabled={deletingAccount}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 sm:mt-5 space-y-3">
              <label className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-primary)' }} htmlFor="delete-confirmation">
                Type DELETE to confirm
              </label>
              <input
                id="delete-confirmation"
                type="text"
                value={deleteConfirmation}
                onChange={(event) => setDeleteConfirmation(event.target.value)}
                className="input-field text-sm sm:text-base"
                placeholder="DELETE"
                disabled={deletingAccount}
              />
              <p className="text-[10px] sm:text-xs" style={{ color: 'var(--text-tertiary)' }}>
                This action cannot be undone.
              </p>
            </div>

            <div className="mt-5 sm:mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
              <button
                onClick={closeDeleteModal}
                className="btn-secondary w-full sm:w-auto justify-center"
                disabled={deletingAccount}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-70"
                style={{ backgroundColor: '#DC2626' }}
                disabled={deletingAccount || deleteConfirmation.trim().toUpperCase() !== 'DELETE'}
              >
                {deletingAccount ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 flex-shrink-0" />
                    <span>Delete account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Verification Modal */}
      {showVerificationModal && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)' }}>
          <div className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-4 sm:p-6 max-h-[90vh] overflow-y-auto animate-scale-in" style={{ backgroundColor: 'var(--color-card, #1a1a1a)' }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {otpSent ? 'Enter Verification Code' : 'Verify GEHU Email'}
              </h3>
              <button
                onClick={() => {
                  setShowVerificationModal(false)
                  setOtpSent(false)
                  setOtp('')
                  setVerificationEmail('')
                }}
                className="p-2 rounded-lg transition-colors flex-shrink-0"
                style={{ color: 'var(--text-tertiary)' }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!otpSent ? (
              // Step 1: Enter Email
              <>
                <div className="mb-5 sm:mb-6">
                  <p className="text-xs sm:text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Enter your GEHU institutional email address to receive a verification code.
                  </p>

                  <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    GEHU Email Address
                  </label>
                  <input
                    type="email"
                    value={verificationEmail}
                    onChange={(e) => setVerificationEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !sendingVerification && handleSendVerification()}
                    placeholder="your.name@gehu.ac.in"
                    className="input-field text-sm sm:text-base"
                    disabled={sendingVerification}
                    autoFocus
                  />
                  <p className="text-[10px] sm:text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    A 6-digit verification code will be sent to this email
                  </p>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                  <button
                    onClick={() => setShowVerificationModal(false)}
                    className="flex-1 btn-secondary justify-center"
                    disabled={sendingVerification}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendVerification}
                    className="flex-1 btn-primary justify-center"
                    disabled={sendingVerification}
                  >
                    {sendingVerification ? (
                      <>
                        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                        <span>Sending...</span>
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span>Send Code</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              // Step 2: Enter OTP
              <>
                <div className="mb-5 sm:mb-6">
                  <p className="text-xs sm:text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                    Enter the 6-digit verification code sent to{' '}
                    <span className="font-semibold break-all" style={{ color: 'var(--text-primary)' }}>{verificationEmail}</span>
                  </p>

                  <label className="block text-xs sm:text-sm font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={otp}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, '').slice(0, 6)
                      setOtp(value)
                    }}
                    onKeyPress={(e) => e.key === 'Enter' && !verifyingOtp && handleVerifyOtp()}
                    placeholder="000000"
                    className="input-field text-center text-xl sm:text-2xl font-mono tracking-widest"
                    maxLength={6}
                    disabled={verifyingOtp}
                    autoFocus
                  />
                  <p className="text-[10px] sm:text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                    Code expires in 10 minutes
                  </p>

                  <button
                    onClick={handleResendOtp}
                    className="text-xs font-medium mt-3"
                    style={{ color: 'var(--accent)' }}
                    disabled={sendingVerification}
                  >
                    Didn't receive the code? Resend
                  </button>
                </div>

                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:gap-3">
                  <button
                    onClick={() => {
                      setOtpSent(false)
                      setOtp('')
                    }}
                    className="flex-1 btn-secondary justify-center"
                    disabled={verifyingOtp}
                  >
                    Back
                  </button>
                  <button
                    onClick={handleVerifyOtp}
                    className="flex-1 btn-primary justify-center"
                    disabled={verifyingOtp || otp.length !== 6}
                  >
                    {verifyingOtp ? (
                      <>
                        <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                        <span>Verify Code</span>
                      </>
                    )}
                  </button>
                </div>
              </>
            )}

            <div className="mt-4 p-3 rounded-lg" style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
              <p className="text-[10px] sm:text-xs" style={{ color: 'rgb(96, 165, 250)' }}>
                <strong>Note:</strong> Only GEHU institutional email addresses (@gehu.ac.in) are accepted for verification.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

