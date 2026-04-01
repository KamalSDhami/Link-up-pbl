import { useState } from 'react'
import { X, Briefcase, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface CreateRecruitmentModalProps {
  teamId: string
  onClose: () => void
  onSuccess: () => void
}

const COMMON_SKILLS = [
  'React', 'TypeScript', 'Node.js', 'Python', 'Java', 'C++',
  'UI/UX Design', 'Figma', 'Photoshop', 'Video Editing',
  'Content Writing', 'Marketing', 'Project Management',
  'Data Analysis', 'Machine Learning', 'DevOps'
]

export default function CreateRecruitmentModal({
  teamId,
  onClose,
  onSuccess,
}: CreateRecruitmentModalProps) {
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    required_skills: [] as string[],
    positions_available: 1,
    preferred_gender: 'any' as 'male' | 'female' | 'any',
  })
  const [customSkill, setCustomSkill] = useState('')
  const [expirationOption, setExpirationOption] = useState<'48h' | '1w'>('48h')

  const handleAddSkill = (skill: string) => {
    if (!formData.required_skills.includes(skill)) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, skill],
      })
    }
  }

  const handleRemoveSkill = (skill: string) => {
    setFormData({
      ...formData,
      required_skills: formData.required_skills.filter((s) => s !== skill),
    })
  }

  const handleAddCustomSkill = () => {
    const skill = customSkill.trim()
    if (skill && !formData.required_skills.includes(skill)) {
      setFormData({
        ...formData,
        required_skills: [...formData.required_skills, skill],
      })
      setCustomSkill('')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }

    if (!formData.description.trim()) {
      toast.error('Description is required')
      return
    }

    if (formData.positions_available < 1) {
      toast.error('At least 1 position must be available')
      return
    }

    setLoading(true)
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const expiresAt = new Date(
        Date.now() + (expirationOption === '48h' ? 48 : 168) * 60 * 60 * 1000
      ).toISOString()

      const { error } = await supabase
        .from('recruitment_posts')
        // @ts-expect-error - Supabase type definition needs regeneration
        .insert({
          team_id: teamId,
          posted_by: user.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          required_skills: formData.required_skills,
          positions_available: formData.positions_available,
          preferred_gender: formData.preferred_gender,
          status: 'open',
          expires_at: expiresAt,
        })

      if (error) throw error

      toast.success('🎉 Recruitment post created successfully!')
      onSuccess()
      onClose()
    } catch (error: any) {
      console.error('Error creating recruitment:', error)
      toast.error(error.message || 'Failed to create recruitment post')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/70 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-5 backdrop-blur dark:border-slate-700 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <Briefcase className="h-6 w-6 text-primary-600 dark:text-primary-300" />
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
              Create Recruitment Post
            </h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-white px-6 py-6 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
          {/* Title */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Position Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="e.g., Frontend Developer, UI Designer, Content Writer"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              disabled={loading}
              maxLength={100}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formData.title.length}/100 characters
            </p>
          </div>

          {/* Description */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Job Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Describe the role, responsibilities, and what you're looking for..."
              rows={6}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              disabled={loading}
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {formData.description.length}/1000 characters
            </p>
          </div>

          {/* Required Skills */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Required Skills
            </label>
            
            {/* Selected Skills */}
            {formData.required_skills.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {formData.required_skills.map((skill) => (
                  <span
                    key={skill}
                    className="flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400"
                  >
                    {skill}
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      className="transition hover:text-indigo-900 dark:hover:text-indigo-200"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {/* Skill Suggestions */}
            <div className="mb-3">
              <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
                Quick add:
              </p>
              <div className="flex flex-wrap gap-2">
                {COMMON_SKILLS.filter(
                  (skill) => !formData.required_skills.includes(skill)
                ).map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => handleAddSkill(skill)}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-200 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10"
                  >
                    + {skill}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Skill Input */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customSkill}
                onChange={(e) => setCustomSkill(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddCustomSkill()
                  }
                }}
                placeholder="Add custom skill..."
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-900 placeholder-slate-400 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
                disabled={loading}
              />
              <button
                type="button"
                onClick={handleAddCustomSkill}
                disabled={!customSkill.trim() || loading}
                className="flex items-center gap-2 rounded-xl bg-primary-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
          </div>

          {/* Positions Available */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Positions Available <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.positions_available}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  positions_available: parseInt(e.target.value) || 1,
                })
              }
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-500/40 dark:border-slate-700 dark:bg-slate-900/60 dark:text-white"
              disabled={loading}
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              How many people are you looking to recruit?
            </p>
          </div>

          {/* Gender Preference */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Preferred Applicant Gender
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { value: 'any', label: 'Open to everyone' },
                { value: 'male', label: 'Male candidates only' },
                { value: 'female', label: 'Female candidates only' },
              ].map((option) => (
                <label
                  key={option.value}
                  className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-all ${
                    formData.preferred_gender === option.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-100'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-primary-400/60 dark:border-white/10 dark:bg-slate-900/60 dark:text-slate-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="preferred-gender"
                    value={option.value}
                    checked={formData.preferred_gender === option.value}
                    onChange={(event) =>
                      setFormData({
                        ...formData,
                        preferred_gender: event.target.value as 'male' | 'female' | 'any',
                      })
                    }
                    className="h-4 w-4 text-primary-500"
                    disabled={loading}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Expiration */}
          <div>
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
              Recruitment duration
            </label>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  expirationOption === '48h'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-100'
                    : 'border-slate-200 text-slate-600 hover:border-primary-400/60 dark:border-white/10 dark:text-slate-300'
                }`}>
                <input
                  type="radio"
                  name="recruitment-duration"
                  value="48h"
                  checked={expirationOption === '48h'}
                  onChange={() => setExpirationOption('48h')}
                  className="h-4 w-4 text-primary-500"
                  disabled={loading}
                />
                <span>48 hours (default)</span>
              </label>
              <label className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                  expirationOption === '1w'
                    ? 'border-primary-500 bg-primary-50 text-primary-700 dark:border-primary-400 dark:bg-primary-500/20 dark:text-primary-100'
                    : 'border-slate-200 text-slate-600 hover:border-primary-400/60 dark:border-white/10 dark:text-slate-300'
                }`}>
                <input
                  type="radio"
                  name="recruitment-duration"
                  value="1w"
                  checked={expirationOption === '1w'}
                  onChange={() => setExpirationOption('1w')}
                  className="h-4 w-4 text-primary-500"
                  disabled={loading}
                />
                <span>1 week</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Recruitments auto-archive when the selected duration passes.
            </p>
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-white px-6 py-3 font-medium text-slate-600 transition hover:bg-slate-100 dark:border-white/10 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:bg-slate-800"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim() || !formData.description.trim()}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-6 py-3 font-medium text-white transition hover:bg-primary-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Briefcase className="w-5 h-5" />
                  Create Post
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
