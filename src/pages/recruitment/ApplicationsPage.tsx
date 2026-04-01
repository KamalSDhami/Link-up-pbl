import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
	Briefcase,
	Users,
	Filter,
	Calendar,
	CheckCircle2,
	XCircle,
	Clock,
	AlertTriangle,
	Eye,
	EyeOff,
} from 'lucide-react'
import type { TableInsert, TableRow, TableUpdate } from '@/types/database'
import { sendNotification } from '@/utils/notifications'
import { ensureTeamChatroom } from '@/utils/chatrooms'

type ApplicantProfile = TableRow<'users'>
type ApplicationRow = TableRow<'applications'>
type ApplicationRecord = ApplicationRow & {
	applicant: ApplicantProfile | null
}
type RecruitmentRow = TableRow<'recruitment_posts'>
type RecruitmentWithApplications = RecruitmentRow & {
	teams: {
		id: string
		name: string
		leader_id: string
		year: number
	} | null
	applications: ApplicationRecord[]
}
type ApplicationUpdate = TableUpdate<'applications'>
type TeamMemberInsert = TableInsert<'team_members'>
type RecruitmentUpdate = TableUpdate<'recruitment_posts'>

interface TeamMemberSummary {
	team_id: string
	user_id: string
	users: {
		id: string
		name: string | null
		section: string | null
		year: number | null
	} | null
}

interface ApplicationConflictInfo {
	hasMemberConflict: boolean
	conflictingMemberName: string | null
	conflictingMemberSection: string | null
	conflictingMemberYear: number | null
	hasPendingSameSection: boolean
}

interface ApplicationView {
	record: ApplicationRecord
	conflict: ApplicationConflictInfo
}

interface RecruitmentRender {
	post: RecruitmentWithApplications
	applications: ApplicationView[]
	conflictApplications: ApplicationView[]
}

export default function ApplicationsPage() {
	const { user } = useAuthStore()
	const [loading, setLoading] = useState(true)
	const [recruitments, setRecruitments] = useState<RecruitmentWithApplications[]>([])
	const [filters, setFilters] = useState({ recruitmentId: 'all', status: 'pending' })
	const [updating, setUpdating] = useState<Record<string, boolean>>({})
	const [teamMembersByTeam, setTeamMembersByTeam] = useState<Record<string, TeamMemberSummary[]>>({})
	const [conflictVisibility, setConflictVisibility] = useState<Record<string, boolean>>({})

	const normalizeSectionValue = (value?: string | null) => (value ? value.trim().toUpperCase() : null)

	useEffect(() => {
		if (user?.id) {
			loadApplications()
		} else {
			setRecruitments([])
			setTeamMembersByTeam({})
			setConflictVisibility({})
			setLoading(false)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user?.id])

	const loadApplications = async () => {
		if (!user) return

		setLoading(true)
		try {
			const { data, error } = await supabase
				.from('recruitment_posts')
				.select(`
					id,
					title,
					status,
					positions_available,
					expires_at,
					created_at,
					team_id,
					teams:team_id (
						id,
						name,
						leader_id,
						year
					),
					applications (
						id,
						applicant_id,
						message,
						status,
						applied_at,
						reviewed_at,
						applicant:users!applications_applicant_id_fkey (
							id,
							name,
							email,
							section,
							year,
							skills,
							profile_picture_url
						)
					)
				`)
				.eq('posted_by', user.id)
				.order('created_at', { ascending: false })

			if (error) throw error

			const normalized = ((data ?? []) as unknown as RecruitmentWithApplications[]).map((post) => ({
				...post,
				applications: (post.applications ?? []) as ApplicationRecord[],
			}))

			const teamIds = Array.from(
				new Set(normalized.map((post) => post.team_id).filter((teamId): teamId is string => Boolean(teamId)))
			)

			if (teamIds.length) {
				const { data: memberData, error: membersError } = await supabase
					.from('team_members')
					.select(
						`
						team_id,
						user_id,
						users:user_id (
							id,
							name,
							section,
							year
						)
					`
					)
					.in('team_id', teamIds)

				if (membersError) {
					console.error('Error loading team members for recruitment view:', membersError)
					setTeamMembersByTeam({})
				} else {
					const roster = (memberData ?? []) as unknown as TeamMemberSummary[]
					const grouped = roster.reduce<Record<string, TeamMemberSummary[]>>((accumulator, member) => {
						const teamId = member.team_id
						if (!accumulator[teamId]) {
							accumulator[teamId] = []
						}
						accumulator[teamId].push(member)
						return accumulator
					}, {})
					setTeamMembersByTeam(grouped)
				}
			} else {
				setTeamMembersByTeam({})
			}

			setConflictVisibility((previous) => {
				const next: Record<string, boolean> = {}
				normalized.forEach((post) => {
					next[post.id] = previous[post.id] ?? false
				})
				return next
			})

			setRecruitments(normalized)
		} catch (error: any) {
			console.error('Error loading applications:', error)
			toast.error('Failed to load applications')
			setRecruitments([])
			setTeamMembersByTeam({})
		} finally {
			setLoading(false)
		}
	}

	const findSectionConflictMember = (
		teamId: string | null,
		section?: string | null,
		year?: number | null
	): TeamMemberSummary | null => {
		if (!teamId) return null
		const normalizedSection = normalizeSectionValue(section)
		if (!normalizedSection) return null
		const normalizedYear = year ?? null
		const roster = teamMembersByTeam[teamId] ?? []

		return (
			roster.find((member) => {
				const memberSection = normalizeSectionValue(member.users?.section)
				const memberYear = member.users?.year ?? null
				return memberSection === normalizedSection && memberYear === normalizedYear
			}) ?? null
		)
	}

	const toggleConflictVisibility = (postId: string) => {
		setConflictVisibility((previous) => ({
			...previous,
			[postId]: !previous[postId],
		}))
	}

	const filteredRecruitments = useMemo<RecruitmentRender[]>(() => {
		return recruitments
			.filter((post) => (filters.recruitmentId === 'all' ? true : post.id === filters.recruitmentId))
			.map((post) => {
				const members = post.team_id ? teamMembersByTeam[post.team_id] ?? [] : []

				const applicationsForStatus = post.applications.filter((application) =>
					filters.status === 'all' ? true : application.status === filters.status
				)

				const enrichedApplications: ApplicationView[] = applicationsForStatus.map((application) => {
					const applicantSection = normalizeSectionValue(application.applicant?.section)
					const applicantYear = application.applicant?.year ?? null

					const conflictingMember = applicantSection
						? members.find((member) => {
								const memberSection = normalizeSectionValue(member.users?.section)
								const memberYear = member.users?.year ?? null
								return memberSection === applicantSection && memberYear === applicantYear
							})
						: undefined

					const hasPendingSameSection = post.applications.some(
						(other) =>
							other.id !== application.id &&
							other.status === 'pending' &&
							normalizeSectionValue(other.applicant?.section) === applicantSection &&
							(other.applicant?.year ?? null) === applicantYear
					)

					const conflict: ApplicationConflictInfo = {
						hasMemberConflict: Boolean(conflictingMember),
						conflictingMemberName: conflictingMember?.users?.name ?? null,
						conflictingMemberSection: conflictingMember?.users?.section ?? null,
						conflictingMemberYear: conflictingMember?.users?.year ?? null,
						hasPendingSameSection,
					}

					return { record: application, conflict }
				})

				const applications = enrichedApplications.filter((application) => !application.conflict.hasMemberConflict)
				const conflictApplications = enrichedApplications.filter((application) => application.conflict.hasMemberConflict)

				return {
					post,
					applications,
					conflictApplications,
				}
			})
			.filter((entry) => entry.applications.length > 0 || entry.conflictApplications.length > 0)
	}, [filters.recruitmentId, filters.status, recruitments, teamMembersByTeam])

	const totalPending = useMemo(
		() =>
			recruitments.reduce(
				(count, post) => count + post.applications.filter((app) => app.status === 'pending').length,
				0
			),
		[recruitments]
	)

	const handleDecision = async (
		post: RecruitmentWithApplications,
		application: ApplicationRecord,
		newStatus: 'accepted' | 'rejected'
	) => {
		setUpdating((prev) => ({ ...prev, [application.id]: true }))
		try {
			let membershipAdded = false

			if (newStatus === 'accepted') {
				if (!post.team_id) {
					toast.error('Team information is missing for this recruitment.')
					return
				}

				const conflictMember = findSectionConflictMember(
					post.team_id,
					application.applicant?.section ?? null,
					application.applicant?.year ?? null
				)

				if (conflictMember) {
					const conflictName = conflictMember.users?.name
					const conflictSection = conflictMember.users?.section ?? 'the same section'
					const conflictYear = conflictMember.users?.year
					const yearLabel = conflictYear ? ` (year ${conflictYear})` : ''
					const nameLabel = conflictName ? `${conflictName} ` : 'Another member '

					toast.error(
						`${nameLabel}from section ${conflictSection}${yearLabel} is already on this team. Remove them before accepting another student from the same section.`
					)
					return
				}

						const roster = teamMembersByTeam[post.team_id] ?? []
						const alreadyMember = roster.some((member) => member.user_id === application.applicant_id)

								if (!alreadyMember) {
									const memberInsert: TeamMemberInsert = {
										team_id: post.team_id,
										user_id: application.applicant_id,
									}

											const { error: memberError, data: memberRows } = await supabase
										.from('team_members')
										.upsert(memberInsert as never, {
											onConflict: 'team_id,user_id',
											ignoreDuplicates: true,
												})
												.select('team_id, user_id')

									if (memberError) {
										throw memberError
									}

											membershipAdded = Boolean(memberRows?.length)

											if (membershipAdded) {
												setTeamMembersByTeam((previous) => {
													const next = { ...previous }
													const updatedRoster = [...(next[post.team_id] ?? [])]
													updatedRoster.push({
														team_id: post.team_id!,
														user_id: application.applicant_id,
														users: {
															id: application.applicant?.id ?? application.applicant_id,
															name: application.applicant?.name ?? null,
															section: application.applicant?.section ?? null,
															year: application.applicant?.year ?? null,
														},
													})
													next[post.team_id] = updatedRoster
													return next
												})

												if (post.teams?.leader_id) {
													try {
														await ensureTeamChatroom({
															teamId: post.team_id,
															teamName: post.teams?.name ?? null,
															leaderId: post.teams.leader_id,
															memberIds: [application.applicant_id],
														})
													} catch (chatError) {
														console.error('Failed to sync team chat after recruitment acceptance:', chatError)
														toast.error('Member added but team chat may need a refresh.')
													}
												}
											}
								}
			}

			const updatePayload: ApplicationUpdate = {
				status: newStatus,
				reviewed_at: new Date().toISOString(),
			}

			const { error } = await supabase
				.from('applications')
				.update(updatePayload as never)
				.eq('id', application.id)

			if (error) throw error

					if (newStatus === 'accepted') {
						if (membershipAdded) {
					const recruitmentPayload: RecruitmentUpdate = {
						status: post.positions_available > 1 ? 'open' : 'closed',
						expires_at: new Date().toISOString(),
					}

					if (post.positions_available > 1) {
						recruitmentPayload.positions_available = Math.max(post.positions_available - 1, 0)
					}

					const { error: recruitmentError } = await supabase
						.from('recruitment_posts')
						.update(recruitmentPayload as never)
						.eq('id', post.id)

					if (recruitmentError && recruitmentError.code !== '23514') {
						throw recruitmentError
					}
						}

				const notificationLink = post.team_id ? `/teams/${post.team_id}` : null

				await sendNotification({
					userId: application.applicant_id,
					type: 'team_invite',
					title: 'Application accepted',
					message: `You have been added to ${post.teams?.name ?? 'a team'} via recruitment.`,
					link: notificationLink,
				})
			}

			toast.success(`Application ${newStatus}`)
			await loadApplications()
		} catch (error: any) {
			console.error('Error updating application:', error)
			toast.error(error.message || 'Failed to update application')
		} finally {
			setUpdating((prev) => {
				const next = { ...prev }
				delete next[application.id]
				return next
			})
		}
	}

	const renderApplicationCard = (
		post: RecruitmentWithApplications,
		view: ApplicationView,
		options: { conflict?: boolean } = {}
	) => {
		const { record: application, conflict } = view
		const isConflict = Boolean(options.conflict && conflict.hasMemberConflict)
		const isProcessing = Boolean(updating[application.id])
		const disableAccept = isConflict || isProcessing
		const acceptLabel = isProcessing ? 'Processing...' : isConflict ? 'Resolve conflict' : 'Accept'
		const acceptButtonTitle = isConflict
			? 'A member from this section and year is already part of the team.'
			: undefined
		const applicantInitial = (application.applicant?.name ?? 'A').charAt(0).toUpperCase()

		return (
			<>
				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-4">
						<div className="h-14 w-14 flex-shrink-0">
							{application.applicant?.profile_picture_url ? (
								<img
									src={application.applicant.profile_picture_url}
									alt={application.applicant?.name ?? 'Applicant avatar'}
									className="h-14 w-14 rounded-full object-cover shadow-sm"
								/>
							) : (
								<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-lg font-semibold text-primary-700">
									{applicantInitial}
								</div>
							)}
						</div>
						<div className="space-y-2">
							<div className="flex flex-wrap items-center gap-2">
								<h3 className="text-lg font-semibold text-slate-900">
									{application.applicant?.name ?? 'Unknown applicant'}
								</h3>
								<span
									className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
										application.status === 'pending'
											? 'bg-amber-100 text-amber-700'
											: application.status === 'accepted'
												? 'bg-green-100 text-green-700'
												: 'bg-red-100 text-red-600'
									}`}
								>
									{application.status}
								</span>
							</div>
							<p className="text-sm text-slate-600">
								{application.applicant?.email}
								{application.applicant?.section && (
									<>
										{' '}
										· Section {application.applicant.section}
									</>
								)}
								{application.applicant?.year && (
									<>
										{' '}
										· Year {application.applicant.year}
									</>
								)}
							</p>
							{application.applicant?.skills?.length ? (
								<div className="flex flex-wrap gap-2">
									{application.applicant.skills.slice(0, 3).map((skill) => (
										<span
											key={skill}
											className="rounded-full bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700"
										>
											{skill}
										</span>
									))}
								</div>
							) : null}
						</div>
					</div>

					<div className="flex flex-col items-start gap-2 text-sm text-slate-500">
						<span className="flex items-center gap-2">
							<Clock className="h-4 w-4" />
							Applied {new Date(application.applied_at).toLocaleDateString()}
						</span>
						{application.reviewed_at && (
							<span>Reviewed {new Date(application.reviewed_at).toLocaleDateString()}</span>
						)}
					</div>
				</div>

				{application.message && (
					<div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-700">
						{application.message}
					</div>
				)}

				{conflict.hasMemberConflict && (
					<div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
						<AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
						<div className="space-y-1">
							<p className="font-medium">Section conflict</p>
							<p>
								A member from section {conflict.conflictingMemberSection ?? '—'}
								{conflict.conflictingMemberYear ? ` (year ${conflict.conflictingMemberYear})` : ''} is already part of this team.
								Remove them or adjust team composition before accepting this applicant.
							</p>
						</div>
					</div>
				)}

				{!conflict.hasMemberConflict && conflict.hasPendingSameSection && (
					<div className="mt-3 flex items-center gap-2 text-sm text-amber-600">
						<AlertTriangle className="h-4 w-4" />
						Another applicant from this section already has a pending application.
					</div>
				)}

				{application.status === 'pending' && (
					<div className="mt-4 flex flex-wrap gap-3">
						<button
							onClick={() => handleDecision(post, application, 'accepted')}
							disabled={disableAccept}
							className="btn-primary flex items-center gap-2"
							title={acceptButtonTitle}
						>
							{acceptLabel}
							{!isProcessing && !isConflict && <CheckCircle2 className="h-4 w-4" />}
						</button>
						<button
							onClick={() => handleDecision(post, application, 'rejected')}
							disabled={isProcessing}
							className="btn-outline flex items-center gap-2 border-red-300 px-4 py-2 text-sm text-red-600 hover:border-red-400 hover:bg-red-50"
						>
							{isProcessing ? 'Processing...' : 'Reject'}
							{!isProcessing && <XCircle className="h-4 w-4" />}
						</button>
					</div>
				)}
			</>
		)
	}

	if (!user) {
		return null
	}

	return (
		<div className="space-y-8">
			<div className="flex flex-col gap-3">
				<h1 className="flex items-center gap-3 text-3xl font-display font-bold text-slate-900">
					<Briefcase className="h-10 w-10 text-primary-600" />
					Recruitment applications
				</h1>
				<p className="text-slate-600">
					Review applicants across all of your open recruitment posts and respond in one place.
				</p>
			</div>

			<div className="card space-y-6">
				<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
					<div>
						<label className="mb-2 block text-sm font-medium text-slate-600">Recruitment</label>
						<select
							className="input-field"
							value={filters.recruitmentId}
							onChange={(event) =>
								setFilters((prev) => ({ ...prev, recruitmentId: event.target.value }))
							}
						>
							<option value="all">All roles</option>
							{recruitments.map((post) => (
								<option key={post.id} value={post.id}>
									{post.title}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-2 block text-sm font-medium text-slate-600">Status</label>
						<select
							className="input-field"
							value={filters.status}
							onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
						>
							<option value="pending">Pending</option>
							<option value="accepted">Accepted</option>
							<option value="rejected">Rejected</option>
							<option value="all">All</option>
						</select>
					</div>
					<div className="flex items-center gap-3 rounded-lg bg-primary-50 px-4 py-3 text-sm text-primary-700">
						<Filter className="h-4 w-4" />
						{totalPending} pending application{totalPending === 1 ? '' : 's'} awaiting review
					</div>
				</div>
			</div>

			{loading ? (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
					{Array.from({ length: 4 }).map((_, index) => (
						<div key={index} className="card animate-pulse space-y-4">
							<div className="h-6 w-2/3 rounded bg-slate-200"></div>
							<div className="h-4 w-1/2 rounded bg-slate-200"></div>
							<div className="h-20 w-full rounded bg-slate-200"></div>
						</div>
					))}
				</div>
			) : filteredRecruitments.length === 0 ? (
				<div className="card text-center">
					<Users className="mx-auto mb-4 h-16 w-16 text-slate-300" />
					<h3 className="mb-2 text-xl font-semibold text-slate-900">No applications found</h3>
					<p className="text-slate-600">
						{filters.status === 'pending'
							? 'You currently have no pending applications to review.'
							: 'Try switching filters or check back once new applications arrive.'}
					</p>
				</div>
			) : (
				<div className="space-y-6">
					{filteredRecruitments.map(({ post, applications, conflictApplications }) => {
						const totalForStatus = applications.length + conflictApplications.length

						return (
							<div key={post.id} className="card space-y-6">
								<div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
									<div>
										<h2 className="text-xl font-semibold text-slate-900">{post.title}</h2>
										<p className="text-sm text-slate-600">
											{post.teams?.name ?? 'Unknown team'} · Year {post.teams?.year ?? '-'}
										</p>
									</div>
									<div className="flex items-center gap-3 text-sm text-slate-600">
										<span className="flex items-center gap-2">
											<Briefcase className="h-4 w-4" />
											{post.positions_available} position(s)
										</span>
										<span className="flex items-center gap-2">
											<Calendar className="h-4 w-4" />
											Posted {new Date(post.created_at).toLocaleDateString()}
										</span>
									</div>
								</div>

								<div className="space-y-4">
									{applications.map((view) => (
										<div key={view.record.id} className="rounded-xl border border-slate-200 p-6">
											{renderApplicationCard(post, view)}
										</div>
									))}

									{conflictApplications.length > 0 && (
										<div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
											<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
												<div className="flex items-center gap-2 text-sm text-amber-700">
													<AlertTriangle className="h-4 w-4" />
													{conflictApplications.length} conflicting application
													{conflictApplications.length === 1 ? '' : 's'} hidden by default
												</div>
												<button
													onClick={() => toggleConflictVisibility(post.id)}
													className="inline-flex items-center gap-2 text-sm font-medium text-amber-700 transition hover:text-amber-800"
												>
													{conflictVisibility[post.id] ? (
														<>
															<EyeOff className="h-4 w-4" /> Hide conflicts
														</>
													) : (
														<>
															<Eye className="h-4 w-4" /> Show conflicts
														</>
													)}
												</button>
											</div>

											{conflictVisibility[post.id] ? (
												<div className="mt-4 space-y-4">
													{conflictApplications.map((view) => (
														<div key={view.record.id} className="rounded-xl border border-amber-200 bg-white p-6 shadow-sm">
															{renderApplicationCard(post, view, { conflict: true })}
														</div>
													))}
												</div>
											) : (
												<p className="mt-3 text-sm text-amber-700">
													Conflicting applicants stay pending so you can adjust your roster before making a decision.
												</p>
											)}
										</div>
									)}
								</div>

								<div className="flex items-center justify-between rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
									<span>
										{totalForStatus} application{totalForStatus === 1 ? '' : 's'}
										{filters.status !== 'all' && ` in ${filters.status} status`}
									</span>
									<Link to={`/recruitment/${post.id}`} className="text-primary-600 hover:text-primary-700">
										View role →
									</Link>
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}
