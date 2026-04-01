import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Users, Briefcase, MessageCircle, Shield, ArrowRight, CheckCircle2 } from 'lucide-react'
import HeroParticleField from '@/components/landing/HeroParticleField'
import { useAuthStore } from '@/store/authStore'
import { Navigate } from 'react-router-dom'

export default function LandingPage() {
  const { user } = useAuthStore()

  if (user) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section
        className="relative min-h-[32rem] overflow-hidden px-4 py-20 sm:py-24 md:py-32"
        style={{ background: 'radial-gradient(circle at 50% -10%, rgba(21,94,199,0.35), transparent 55%), #010310' }}
      >
        <div className="pointer-events-none absolute inset-0 z-0">
          <HeroParticleField />
        </div>
        <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.26),transparent_60%)]"></div>

        <div className="relative z-20 mx-auto flex max-w-7xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="w-full px-2 sm:px-6"
          >
            {/* Logo */}
            <div className="mb-8 flex justify-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl flex items-center justify-center shadow-2xl">
                <span className="text-white font-bold text-4xl">L</span>
              </div>
            </div>

            <h1 className="mx-auto mb-6 max-w-3xl text-4xl font-display font-bold leading-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              <span className="bg-gradient-to-r from-sky-200 via-blue-100 to-white bg-clip-text text-transparent">
                Find Your Perfect
              </span>
              <span className="block text-white">PBL Team at GEHU</span>
            </h1>

            <p className="mx-auto mb-10 max-w-2xl text-base text-slate-200 sm:text-lg md:text-xl">
              Connect with talented teammates, showcase your skills, and build amazing projects together.
              Made exclusively for GEHU students.
            </p>

            <div className="flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
              <Link to="/signup" className="btn-primary inline-flex w-full items-center justify-center space-x-2 px-8 py-3 text-base sm:w-auto sm:text-lg">
                <span>Get Started</span>
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link to="/login" className="btn-secondary w-full px-8 py-3 text-base sm:w-auto sm:text-lg">
                Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">
              Everything You Need
            </h2>
            <p className="text-lg text-slate-600">
              Built with modern features to make team finding effortless
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureCard
              icon={<Users className="w-8 h-8" />}
              title="Team Management"
              description="Create and manage teams of 3-4 members with automatic PBL rule enforcement"
              color="from-blue-500 to-cyan-500"
            />
            <FeatureCard
              icon={<Briefcase className="w-8 h-8" />}
              title="Smart Recruitment"
              description="Post openings, review applications, and find the perfect teammates"
              color="from-purple-500 to-pink-500"
            />
            <FeatureCard
              icon={<MessageCircle className="w-8 h-8" />}
              title="Built-in Messaging"
              description="DM, team chats, and recruitment discussions - all in one place"
              color="from-green-500 to-emerald-500"
            />
            <FeatureCard
              icon={<Shield className="w-8 h-8" />}
              title="Privacy First"
              description="No phone sharing. Your contact info stays private and secure"
              color="from-orange-500 to-red-500"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-display font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-lg text-slate-600">
              Get started in minutes
            </p>
          </div>

          <div className="space-y-8">
            <Step
              number="1"
              title="Sign Up & Verify"
              description="Create an account and verify your GEHU email to unlock all features"
            />
            <Step
              number="2"
              title="Build Your Profile"
              description="Add your skills, year, section, and optional GitHub/LinkedIn profiles"
            />
            <Step
              number="3"
              title="Find Your Team"
              description="Browse recruitment posts, apply to teams, or create your own team"
            />
            <Step
              number="4"
              title="Collaborate & Succeed"
              description="Use built-in messaging to coordinate and build amazing projects together"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-950 via-indigo-900 to-sky-700 px-4 py-20">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mb-6 text-4xl font-display font-bold text-white">
            Ready to Find Your Dream Team?
          </h2>
          <p className="mb-8 text-xl text-slate-100/80">
            Join hundreds of GEHU students already using Linkup
          </p>
          <Link
            to="/signup"
            className="inline-flex items-center space-x-2 rounded-lg bg-white px-8 py-4 text-lg font-semibold text-blue-800 shadow-[0_12px_30px_rgba(15,30,60,0.45)] transition-all duration-200 hover:shadow-[0_16px_40px_rgba(9,15,40,0.6)]"
          >
            <span>Create Free Account</span>
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-7xl mx-auto text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-accent-600 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">L</span>
          </div>
          <p className="mb-4">© 2025 Linkup. Made for GEHU Students.</p>
          <p className="text-sm">Built with ❤️ for better collaboration</p>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description, color }: any) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      className="card text-center"
    >
      <div className={`w-16 h-16 bg-gradient-to-br ${color} rounded-xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg`}>
        {icon}
      </div>
      <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-slate-600">{description}</p>
    </motion.div>
  )
}

function Step({ number, title, description }: any) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-900/70 p-6 text-center shadow-[0_18px_45px_rgba(8,15,40,0.55)] transition hover:border-[rgba(129,140,248,0.45)] sm:flex-row sm:items-start sm:space-x-4 sm:text-left">
      <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-xl font-bold text-white shadow-lg">
        {number}
      </div>
      <div className="flex-1 pt-2">
        <h3 className="mb-2 flex items-center justify-center text-xl font-semibold text-slate-50 sm:justify-start">
          {title}
          <CheckCircle2 className="ml-2 h-5 w-5 text-emerald-400" />
        </h3>
        <p className="text-sm text-slate-300 sm:text-base">{description}</p>
      </div>
    </div>
  )
}
