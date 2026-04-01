import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Eye,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Shield,
  Trash2,
  XCircle,
} from 'lucide-react'

import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/authStore'
import type { TableRow } from '@/types/database'

type MessageReportRow = TableRow<'message_reports'>
type UserRow = TableRow<'users'>
type MessageRow = TableRow<'messages'>
type ChatroomRow = TableRow<'chatrooms'>

interface ReportWithDetails extends MessageReportRow {
  reporter: UserRow | null
  reviewer: UserRow | null
  message: (MessageRow & {
    sender: UserRow | null
    chatroom: ChatroomRow | null
  }) | null
}

const STATUS_OPTIONS: Array<MessageReportRow['status']> = ['pending', 'reviewing', 'resolved']

export default function ModerationPage() {
  const { user } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [reports, setReports] = useState<ReportWithDetails[]>([])
  const [statusFilter, setStatusFilter] = useState<'all' | MessageReportRow['status']>('pending')
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  const [processingReports, setProcessingReports] = useState<Record<string, boolean>>({})

  const isModerator = ['super_admin', 'moderator', 'god'].includes(user?.role ?? '')

  useEffect(() => {
    if (!user || !isModerator) return
    loadReports()
  }, [user, isModerator])

  const loadReports = async () => {
    if (!user || !isModerator) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('message_reports')
        .select(`
          id,
          message_id,
          reporter_id,
          reason,
          created_at,
          status,
          reviewer_id,
          reviewed_at,
          decrypted_preview,
          reporter:users!message_reports_reporter_id_fkey(
            id, name, email, profile_picture_url
          ),
          reviewer:users!message_reports_reviewer_id_fkey(
            id, name, email
          ),
          message:messages(
            id,
            content,
            created_at,
            chatroom_id,
            sender_id,
            sender:users!messages_sender_id_fkey(
              id, name, email, profile_picture_url
            ),
            chatroom:chatrooms(
              id, name, type
            )
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setReports((data as unknown as ReportWithDetails[]) ?? [])
    } catch (error: any) {
      console.error('Failed to load reports:', error)
      toast.error(error?.message || 'Unable to load reports')
      setReports([])
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateStatus = async (reportId: string, newStatus: MessageReportRow['status']) => {
    setProcessingReports((prev) => ({ ...prev, [reportId]: true }))

    try {
      const updates: Partial<MessageReportRow> = {
        status: newStatus,
      }

      if (newStatus === 'reviewing' || newStatus === 'resolved') {
        updates.reviewer_id = user!.id
        updates.reviewed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('message_reports')
        .update(updates as never)
        .eq('id', reportId)

      if (error) throw error

      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? {
                ...report,
                ...updates,
                reviewer: updates.reviewer_id ? report.reviewer : report.reviewer,
              }
            : report
        )
      )

      toast.success(`Report marked as ${newStatus}`)
    } catch (error: any) {
      console.error('Failed to update report:', error)
      toast.error(error?.message || 'Failed to update report')
    } finally {
      setProcessingReports((prev) => {
        const next = { ...prev }
        delete next[reportId]
        return next
      })
    }
  }

  const handleDeleteMessage = async (reportId: string, messageId: string) => {
    if (!confirm('Are you sure you want to delete this message? This action cannot be undone.')) {
      return
    }

    setProcessingReports((prev) => ({ ...prev, [reportId]: true }))

    try {
      // Delete the message
      const { error: deleteError } = await supabase.from('messages').delete().eq('id', messageId)

      if (deleteError) throw deleteError

      // Mark report as resolved
      const { error: updateError } = await supabase
        .from('message_reports')
        .update({
          status: 'resolved',
          reviewer_id: user!.id,
          reviewed_at: new Date().toISOString(),
        } as never)
        .eq('id', reportId)

      if (updateError) throw updateError

      setReports((prev) =>
        prev.map((report) =>
          report.id === reportId
            ? {
                ...report,
                status: 'resolved' as const,
                reviewer_id: user!.id,
                reviewed_at: new Date().toISOString(),
                reviewer: report.reviewer,
              }
            : report
        )
      )

      toast.success('Message deleted and report resolved')
    } catch (error: any) {
      console.error('Failed to delete message:', error)
      toast.error(error?.message || 'Failed to delete message')
    } finally {
      setProcessingReports((prev) => {
        const next = { ...prev }
        delete next[reportId]
        return next
      })
    }
  }

  const filteredReports = useMemo(() => {
    return reports.filter((report) => {
      if (statusFilter === 'all') return true
      return report.status === statusFilter
    })
  }, [reports, statusFilter])

  const reportCounts = useMemo(() => {
    return {
      pending: reports.filter((r) => r.status === 'pending').length,
      reviewing: reports.filter((r) => r.status === 'reviewing').length,
      resolved: reports.filter((r) => r.status === 'resolved').length,
      total: reports.length,
    }
  }, [reports])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadReports()
    setRefreshing(false)
  }

  if (!user) {
    return null
  }

  if (!isModerator) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4 py-10 text-center">
        <h1 className="text-2xl font-semibold text-slate-900">Insufficient permissions</h1>
        <p className="text-slate-600">You need moderator permissions to access content moderation.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide" style={{ color: 'var(--accent)' }}>Administration</p>
          <h1 className="text-3xl font-display font-bold" style={{ color: 'var(--text-primary)' }}>Content moderation</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review and manage reported messages across all chatrooms.</p>
        </div>
        <button
          onClick={handleRefresh}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-secondary)' }}
          disabled={refreshing || loading}
        >
          {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <button onClick={() => setStatusFilter('pending')} className="card text-left transition-all hover:scale-105" style={{ cursor: 'pointer' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Pending</span>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{reportCounts.pending}</p>
        </button>
        <button onClick={() => setStatusFilter('reviewing')} className="card text-left transition-all hover:scale-105" style={{ cursor: 'pointer' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Reviewing</span>
            <Eye className="h-4 w-4 text-blue-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{reportCounts.reviewing}</p>
        </button>
        <button onClick={() => setStatusFilter('resolved')} className="card text-left transition-all hover:scale-105" style={{ cursor: 'pointer' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Resolved</span>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </div>
          <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{reportCounts.resolved}</p>
        </button>
        <button onClick={() => setStatusFilter('all')} className="card text-left transition-all hover:scale-105" style={{ cursor: 'pointer' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-tertiary)' }}>Total</span>
            <Shield className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          </div>
          <p className="mt-2 text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>{reportCounts.total}</p>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5" style={{ color: 'var(--text-tertiary)' }} />
          <div className="flex flex-1 items-center gap-3">
            <label className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Status:</label>
            <div className="relative">
              <select
                className="input-field pr-10"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              >
                <option value="all">All reports</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {loading ? (
        <div className="grid gap-4">
          {Array.from({ length: 3 }).map((_, idx) => (
            <div key={idx} className="card animate-pulse space-y-4">
              <div className="h-6 w-1/3 rounded bg-slate-200"></div>
              <div className="h-4 w-2/3 rounded bg-slate-200"></div>
              <div className="h-20 w-full rounded bg-slate-200"></div>
            </div>
          ))}
        </div>
      ) : filteredReports.length === 0 ? (
        <div className="card text-center">
          <Shield className="mx-auto mb-4 h-16 w-16 text-slate-300" />
          <h3 className="mb-2 text-xl font-semibold text-slate-900">No reports found</h3>
          <p className="text-slate-600">
            {statusFilter === 'pending'
              ? 'No pending reports at this time. Great job keeping things clean!'
              : 'Try adjusting your filters to see more reports.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredReports.map((report) => {
            const isExpanded = expandedReport === report.id
            const isProcessing = processingReports[report.id]

            return (
              <div
                key={report.id}
                className={`card transition-all ${
                  report.status === 'pending'
                    ? 'border-l-4 border-l-amber-500'
                    : report.status === 'reviewing'
                      ? 'border-l-4 border-l-blue-500'
                      : 'border-l-4 border-l-green-500'
                }`}
              >
                {/* Report Header */}
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                          report.status === 'pending'
                            ? 'bg-amber-100 text-amber-700'
                            : report.status === 'reviewing'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {report.status}
                      </span>
                      <span className="text-sm text-slate-500">
                        Reported {new Date(report.created_at).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-700">Reporter:</span>
                        <span className="text-slate-900">{report.reporter?.name ?? 'Unknown'}</span>
                        <span className="text-slate-500">({report.reporter?.email})</span>
                      </div>

                      {report.message?.sender && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-700">Message from:</span>
                          <span className="text-slate-900">{report.message.sender.name ?? 'Unknown'}</span>
                          <span className="text-slate-500">({report.message.sender.email})</span>
                        </div>
                      )}

                      {report.message?.chatroom && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-700">Chatroom:</span>
                          <Link
                            to={`/messages/${report.message.chatroom_id}`}
                            className="text-primary-600 hover:underline"
                          >
                            {report.message.chatroom.name ?? 'Unnamed chatroom'}
                          </Link>
                        </div>
                      )}
                    </div>

                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="text-sm font-medium text-slate-700">Reason for report:</p>
                      <p className="mt-1 text-sm text-slate-900">{report.reason}</p>
                    </div>

                    {isExpanded && report.message && (
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                          <MessageSquare className="h-4 w-4" />
                          Reported message content:
                        </div>
                        <div className="rounded bg-slate-50 p-3 text-sm text-slate-900">
                          {report.decrypted_preview || report.message.content || '[Message content unavailable]'}
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Sent {new Date(report.message.created_at).toLocaleString()}
                        </p>
                      </div>
                    )}

                    {report.reviewer && (
                      <div className="text-sm text-slate-600">
                        <span className="font-medium">Reviewed by:</span> {report.reviewer.name} on{' '}
                        {report.reviewed_at ? new Date(report.reviewed_at).toLocaleDateString() : 'N/A'}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-4 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : report.id)}
                    className="btn-outline flex items-center gap-2"
                  >
                    {isExpanded ? (
                      <>
                        Hide message
                        <ChevronDown className="h-4 w-4 rotate-180" />
                      </>
                    ) : (
                      <>
                        View message
                        <ChevronDown className="h-4 w-4" />
                      </>
                    )}
                  </button>

                  {report.status === 'pending' && (
                    <button
                      onClick={() => handleUpdateStatus(report.id, 'reviewing')}
                      disabled={isProcessing}
                      className="btn-primary flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                      Mark as reviewing
                    </button>
                  )}

                  {report.status === 'reviewing' && (
                    <button
                      onClick={() => handleUpdateStatus(report.id, 'resolved')}
                      disabled={isProcessing}
                      className="btn-primary flex items-center gap-2 bg-green-600 hover:bg-green-700"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      Mark as resolved
                    </button>
                  )}

                  {report.status !== 'resolved' && report.message && (
                    <button
                      onClick={() => handleDeleteMessage(report.id, report.message_id)}
                      disabled={isProcessing}
                      className="btn-outline flex items-center gap-2 border-red-300 text-red-600 hover:border-red-400 hover:bg-red-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Delete message
                    </button>
                  )}

                  {report.status === 'resolved' && (
                    <button
                      onClick={() => handleUpdateStatus(report.id, 'pending')}
                      disabled={isProcessing}
                      className="btn-outline flex items-center gap-2"
                    >
                      {isProcessing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      Reopen
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
