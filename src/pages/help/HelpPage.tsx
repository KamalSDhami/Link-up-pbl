import { useState } from 'react'
import {
  HelpCircle,
  MessageSquare,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Clock3,
  Mail,
  ExternalLink,
} from 'lucide-react'

const faqs = [
  {
    question: 'How do I join a team?',
    answer: 'Browse available teams on the Teams page, find one that interests you, and click "Apply to Join". The team leader will review your application and respond.',
  },
  {
    question: 'How do I create a recruitment post?',
    answer: 'Navigate to the Recruitment page and click "Create Post". Fill in the details about what you\'re looking for and publish it. Other users can then apply to your post.',
  },
  {
    question: 'How do I verify my GEHU email?',
    answer: 'Go to Settings > Account and click "Verify GEHU Email". Enter your @gehu.ac.in email address and we\'ll send you a verification code.',
  },
  {
    question: 'How do I change my password?',
    answer: 'Go to Settings > Security and click "Change Password". You\'ll need to enter your current password and then your new password twice.',
  },
  {
    question: 'How do I report inappropriate content?',
    answer: 'Click the three-dot menu on any message or post and select "Report". Describe the issue and our moderation team will review it.',
  },
  {
    question: 'How do I delete my account?',
    answer: 'Go to Settings > Account and scroll to the bottom. Click "Delete Account" and follow the confirmation steps. This action is irreversible.',
  },
]

export default function HelpPage() {
  const [activeTab, setActiveTab] = useState<'faq' | 'tickets' | 'new'>('faq')
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)
  const comingSoonContent =
    activeTab === 'tickets'
      ? {
          title: 'My Tickets is coming soon',
          description: 'Ticket tracking is being rebuilt for a cleaner experience. You will be able to view status updates and replies here soon.',
        }
      : {
          title: 'New Ticket is coming soon',
          description: 'A faster support request flow is on the way. You will soon be able to submit new tickets directly from this tab.',
        }

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="flex flex-col gap-3">
        <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
          Support
        </p>
        <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>
          Help Center
        </h1>
        <p className="max-w-2xl" style={{ color: 'var(--text-secondary)' }}>
          Find answers to common questions or reach out to our support team for assistance.
        </p>
      </header>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-[color:var(--color-border)] pb-2">
        <button
          onClick={() => setActiveTab('faq')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'faq'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[color:var(--text-secondary)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          <HelpCircle className="h-4 w-4" />
          FAQs
        </button>
        <button
          onClick={() => setActiveTab('tickets')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'tickets'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[color:var(--text-secondary)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          My Tickets
        </button>
        <button
          onClick={() => setActiveTab('new')}
          className={`flex items-center gap-2 px-4 py-2 rounded-t-lg font-medium transition ${
            activeTab === 'new'
              ? 'bg-[var(--accent)] text-white'
              : 'text-[color:var(--text-secondary)] hover:bg-[var(--accent-hover)]'
          }`}
        >
          <FileText className="h-4 w-4" />
          New Ticket
        </button>
      </div>

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] divide-y divide-[color:var(--color-border)]">
            {faqs.map((faq, index) => (
              <div key={index} className="p-4">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === index ? null : index)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                    {faq.question}
                  </span>
                  {expandedFaq === index ? (
                    <ChevronUp className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  ) : (
                    <ChevronDown className="h-5 w-5 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  )}
                </button>
                {expandedFaq === index && (
                  <p className="mt-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {faq.answer}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Still need help?
            </h3>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
              Can't find what you're looking for? Create a support ticket and our team will get back to you.
            </p>
            <button
              onClick={() => setActiveTab('new')}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              <FileText className="h-4 w-4" />
              Create Support Ticket
            </button>
          </div>

          <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-6">
            <h3 className="font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              Contact Us Directly
            </h3>
            <div className="flex flex-col gap-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <a
                href="mailto:support@linkup.gehu.ac.in"
                className="inline-flex items-center gap-2 hover:text-[var(--accent)] transition"
              >
                <Mail className="h-4 w-4" />
                support@linkup.gehu.ac.in
              </a>
              <a
                href="https://github.com/your-repo/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 hover:text-[var(--accent)] transition"
              >
                <ExternalLink className="h-4 w-4" />
                Report a Bug on GitHub
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Coming Soon Tabs */}
      {(activeTab === 'tickets' || activeTab === 'new') && (
        <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-surface)] p-8">
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[var(--color-bg)] p-4">
              <Sparkles className="h-8 w-8" style={{ color: 'var(--accent)' }} />
            </div>
            <h2 className="text-2xl font-display font-semibold" style={{ color: 'var(--text-primary)' }}>
              {comingSoonContent.title}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {comingSoonContent.description}
            </p>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-[color:var(--color-border)] bg-[var(--color-bg)] px-4 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Clock3 className="h-4 w-4" />
              Launching soon
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
