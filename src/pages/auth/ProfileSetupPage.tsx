import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, GraduationCap, Tag, Github, Linkedin, Eye, Loader2, CheckCircle2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import type { TableUpdate, TableRow } from '@/types/database'

type UserUpdate = TableUpdate<'users'>
type SocialVisibility = TableRow<'users'>['social_visibility']

const SECTIONS = (() => {
  const sections: string[] = []
  for (let letter = 65; letter <= 90; letter++) { // A-Z
    for (let num = 1; num <= 2; num++) {
      sections.push(`${String.fromCharCode(letter)}${num}`)
    }
  }

  const programPrefixes = ['CS', 'DS', 'ML']
  for (const prefix of programPrefixes) {
    for (let year = 1; year <= 4; year += 1) {
      sections.push(`${prefix}${year}`)
    }
  }

  return sections
})()
const YEARS = [1, 2, 3, 4]
const VISIBILITY_OPTIONS: Array<{ value: SocialVisibility; label: string; description: string }> = [
  { value: 'always', label: 'Always Visible', description: 'Everyone can see your links' },
  { value: 'on_application', label: 'On Application', description: 'Visible when you apply to teams' },
  { value: 'hidden', label: 'Hidden', description: 'Never show your links' },
]

// Quick-add suggestions shown during profile setup to help users fill skills faster
const COMMON_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Java', 'C++',
  'UI/UX Design', 'Figma', 'Photoshop', 'Video Editing',
  'Content Writing', 'Marketing', 'Project Management',
  'Data Analysis', 'Machine Learning', 'DevOps'
]

export default function ProfileSetupPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [skillInput, setSkillInput] = useState('')
  const [formData, setFormData] = useState({
    section: '',
    year: 1,
    skills: [] as string[],
    github_url: '',
    linkedin_url: '',
    social_visibility: 'on_application' as SocialVisibility,
  })
  const [formErrors, setFormErrors] = useState<{ section?: string; skills?: string }>({})

  useEffect(() => {
    if (!user) {
      navigate('/login')
    }
  }, [user, navigate])

  const addSkill = () => {
    if (skillInput.trim() && !formData.skills.includes(skillInput.trim())) {
      const nextSkill = skillInput.trim()
      setFormData((prev) => ({
        ...prev,
        skills: [...prev.skills, nextSkill],
      }))
      setFormErrors((prev) => ({ ...prev, skills: undefined }))
      setSkillInput('')
    }
  }

  const removeSkill = (skill: string) => {
    setFormData((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s !== skill),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const validationErrors: { section?: string; skills?: string } = {}
    if (!formData.section) {
      validationErrors.section = 'Please select your section'
    }
    if (formData.skills.length === 0) {
      validationErrors.skills = 'Please add at least one skill'
    }

    if (validationErrors.section || validationErrors.skills) {
      setFormErrors(validationErrors)
      toast.error(validationErrors.section || validationErrors.skills || 'Please review the form')
      return
    }

    setFormErrors({})

    setLoading(true)

    try {
      if (!user?.id) {
        throw new Error('User not found')
      }

      const updateData: UserUpdate = {
        section: formData.section,
        year: formData.year,
        skills: formData.skills,
        github_url: formData.github_url || null,
        linkedin_url: formData.linkedin_url || null,
        social_visibility: formData.social_visibility,
      }

      const { error } = await supabase
        .from('users')
        .update(updateData as never)
        .eq('id', user.id)

      if (error) throw error

      toast.success('Profile setup complete! Welcome to Linkup 🎉')
      navigate('/dashboard')
    } catch (error: any) {
      console.error('Profile setup error:', error)
      toast.error(error.message || 'Failed to setup profile')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl" style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)' }}>
            <User className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-display font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Complete Your Profile
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            Tell us about yourself to start finding teammates
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-center mb-8 space-x-2">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <span className="ml-2 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Account</span>
          </div>
          <div className="w-12 h-0.5" style={{ background: 'var(--accent)' }} />
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--accent)' }}>
              <span className="text-white font-bold text-sm">2</span>
            </div>
            <span className="ml-2 text-sm font-medium" style={{ color: 'var(--accent)' }}>Profile</span>
          </div>
          <div className="w-12 h-0.5" style={{ background: 'var(--color-border)' }} />
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--color-muted)' }}>
              <span className="font-bold text-sm" style={{ color: 'var(--text-disabled)' }}>3</span>
            </div>
            <span className="ml-2 text-sm font-medium" style={{ color: 'var(--text-disabled)' }}>Dashboard</span>
          </div>
        </div>

        {/* Form Card */}
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6 animate-scale-in">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Year and Section */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  <GraduationCap className="inline w-4 h-4 mr-1" />
                  Current Year
                </label>
                <select
                  required
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  style={{ color: 'var(--text-primary)' }}
                  value={formData.year}
                  onChange={(e) => setFormData({ ...formData, year: Number(e.target.value) })}
                >
                  {YEARS.map((year) => (
                    <option key={year} value={year}>
                      Year {year}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Section
                </label>
                <select
                  required
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  style={{ color: 'var(--text-primary)' }}
                  value={formData.section}
                  onChange={(e) => {
                    const { value } = e.target
                    setFormData((prev) => ({ ...prev, section: value }))
                    if (formErrors.section) {
                      setFormErrors((prev) => ({ ...prev, section: undefined }))
                    }
                  }}
                  aria-invalid={Boolean(formErrors.section)}
                >
                  <option value="">Select Section</option>
                  {SECTIONS.map((section) => (
                    <option key={section} value={section}>
                      Section {section}
                    </option>
                  ))}
                </select>
                {formErrors.section && (
                  <p className="mt-1 text-xs" style={{ color: '#f87171' }}>
                    {formErrors.section}
                  </p>
                )}
              </div>
            </div>

            {/* Skills */}
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                <Tag className="inline w-4 h-4 mr-1" />
                Skills & Technologies
              </label>
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  className="flex-1 rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="e.g., React, Python, UI/UX"
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addSkill()
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={addSkill}
                  className="px-6 rounded-xl text-white font-semibold transition hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)' }}
                >
                  Add
                </button>
              </div>

              {/* Quick-add suggestions */}
              <div className="mb-3">
                <p className="mb-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Quick add:</p>
                <div className="flex flex-wrap gap-2">
                  {COMMON_SKILLS.filter((skill) => !formData.skills.includes(skill)).map((skill) => (
                    <button
                      key={skill}
                      type="button"
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          skills: [...prev.skills, skill],
                        }))
                        setFormErrors((prev) => ({ ...prev, skills: undefined }))
                      }}
                      className="rounded-full bg-[var(--color-muted)] px-3 py-1 text-sm transition hover:bg-[var(--accent-hover)]"
                      style={{ color: 'var(--text-primary)' }}
                    >
                      + {skill}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills Tags */}
              {formData.skills.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium"
                      style={{ background: 'var(--accent-hover)', color: 'var(--accent)' }}
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => removeSkill(skill)}
                        className="hover:opacity-70"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <p className="text-xs mt-2" style={{ color: formErrors.skills ? '#f87171' : 'var(--text-secondary)' }}>
                {formErrors.skills || 'Add at least one skill. Press Enter or click Add.'}
              </p>
            </div>

            {/* Social Links */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Linkedin className="w-5 h-5" />
                Social Links (Optional)
              </h3>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  <Github className="inline w-4 h-4 mr-1" />
                  GitHub Profile URL
                </label>
                <input
                  type="url"
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="https://github.com/yourusername"
                  value={formData.github_url}
                  onChange={(e) => setFormData({ ...formData, github_url: e.target.value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  <Linkedin className="inline w-4 h-4 mr-1" />
                  LinkedIn Profile URL
                </label>
                <input
                  type="url"
                  className="w-full rounded-xl border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
                  style={{ color: 'var(--text-primary)' }}
                  placeholder="https://linkedin.com/in/yourusername"
                  value={formData.linkedin_url}
                  onChange={(e) => setFormData({ ...formData, linkedin_url: e.target.value })}
                />
              </div>
            </div>

            {/* Social Visibility */}
            <div>
              <label className="block text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                <Eye className="inline w-4 h-4 mr-1" />
                Social Links Visibility
              </label>
              <div className="space-y-2">
                {VISIBILITY_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={`flex items-start p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      formData.social_visibility === option.value
                        ? 'border-[color:var(--accent)] bg-[var(--accent-hover)]'
                        : 'border-[color:var(--color-border)] hover:border-[color:var(--accent)]/30'
                    }`}
                  >
                    <input
                      type="radio"
                      name="visibility"
                      value={option.value}
                      checked={formData.social_visibility === option.value}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          social_visibility: e.target.value as SocialVisibility,
                        })
                      }
                      className="mt-1"
                    />
                    <div className="ml-3">
                      <div className="font-medium" style={{ color: 'var(--text-primary)' }}>{option.label}</div>
                      <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>{option.description}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full text-lg py-4 rounded-xl text-white font-semibold transition hover:opacity-90 flex items-center justify-center gap-2"
              style={{ background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)' }}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Setting up your profile...
                </>
              ) : (
                <>
                  Complete Setup
                  <CheckCircle2 className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Help Text */}
        <div className="text-center mt-6 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <p>
            You can update your profile anytime from the settings page
          </p>
        </div>
      </div>
    </div>
  )
}

