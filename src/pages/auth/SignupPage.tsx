import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Mail, Lock, User as UserIcon, Eye, EyeOff, Loader2, CheckCircle2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function SignupPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })

  const validateForm = () => {
    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      toast.error('Passwords do not match')
      return false
    }
    return true
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)

    try {
      // Sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            name: formData.name,
          },
        },
      })

      if (authError) throw authError

      if (authData.user) {
        console.log('User created:', authData.user.id)
        toast.success('Account created! Please set up your profile.')
        
        // Wait a bit for the trigger to create the user profile
        await new Promise(resolve => setTimeout(resolve, 500))
        
        navigate('/profile-setup')
      }
    } catch (error: any) {
      console.error('Signup error:', error)
      toast.error(error.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleSignUp = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/profile-setup`,
        },
      })
      if (error) throw error
    } catch (error: any) {
      toast.error(error.message || 'Failed to sign up with Google')
    }
  }

  return (
    <div className="card animate-in">
      <div className="text-center mb-8">
        <div 
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-accent"
          style={{
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-light) 100%)',
          }}
        >
          <span className="text-primary font-bold text-2xl">L</span>
        </div>
        <h1 className="text-3xl font-display font-bold text-primary mb-2">
          Create Your Account
        </h1>
        <p className="text-secondary">Join GEHU students on Linkup</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary mb-2">
            Full Name
          </label>
          <div className="relative">
            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" style={{ strokeWidth: 1.5 }} />
            <input
              type="text"
              required
              className="input-field pl-10"
              placeholder="John Doe"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" style={{ strokeWidth: 1.5 }} />
            <input
              type="email"
              required
              className="input-field pl-10"
              placeholder="you@example.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>
          <p className="text-xs text-disabled mt-1">
            You can use any email. GEHU email verification comes later.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" style={{ strokeWidth: 1.5 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              className="input-field pl-10 pr-10"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
            >
              {showPassword ? <EyeOff className="w-5 h-5" style={{ strokeWidth: 1.5 }} /> : <Eye className="w-5 h-5" style={{ strokeWidth: 1.5 }} />}
            </button>
          </div>
          <p className="text-xs text-disabled mt-1">Minimum 6 characters</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-primary mb-2">
            Confirm Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-secondary" style={{ strokeWidth: 1.5 }} />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              className="input-field pl-10"
              placeholder="••••••••"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
            />
          </div>
        </div>

        <div className="callout">
          <p className="text-sm font-medium text-primary flex items-center">
            <CheckCircle2 className="w-4 h-4 mr-2" style={{ strokeWidth: 1.5 }} />
            What happens next?
          </p>
          <ul className="text-xs text-accent-light space-y-1 ml-6 mt-2">
            <li>1. Complete your profile setup</li>
            <li>2. Verify your GEHU email to unlock recruitment</li>
            <li>3. Start finding your perfect team!</li>
          </ul>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" style={{ strokeWidth: 1.5 }} />
              Creating account...
            </>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[color:var(--color-border)]"></div>
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="px-2 bg-[var(--color-surface)] text-secondary">Or continue with</span>
        </div>
      </div>

      <button
        onClick={handleGoogleSignUp}
        className="btn-outline w-full flex items-center justify-center"
      >
        <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
          <path
            fill="currentColor"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="currentColor"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="currentColor"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="currentColor"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Sign up with Google
      </button>

      <p className="text-center text-sm text-secondary mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-accent font-semibold hover:text-accent-light transition-colors">
          Sign in
        </Link>
      </p>
    </div>
  )
}
