/**
 * Build Meeting Summary Blob
 *
 * Creates a JSON blob for exporting meeting summaries from the check-in rollup view.
 *
 * TODO [phase6-polish]: also generate a pretty HTML/markdown version for PDF export
 * (We'll eventually want to generate slides / exec pack / board summary)
 */

export interface MeetingSummaryMember {
  userId: string
  name: string
  requestsOverdue: number
  lastSubmittedAt: string | null
  whatMoved: string
  blockers: string
  needHelp: string
  nextActions: string
}

export interface BuildMeetingSummaryBlobParams {
  cycleName: string
  teamName: string
  generatedAt: Date
  members: MeetingSummaryMember[]
}

export function buildMeetingSummaryBlob(
  params: BuildMeetingSummaryBlobParams
): Blob {
  const { cycleName, teamName, generatedAt, members } = params

  const payload = {
    cycle: cycleName,
    team: teamName,
    generatedAt: generatedAt.toISOString(),
    members: members.map((member) => ({
      userId: member.userId,
      name: member.name,
      requestsOverdue: member.requestsOverdue,
      lastSubmittedAt: member.lastSubmittedAt,
      whatMoved: member.whatMoved,
      blockers: member.blockers,
      needHelp: member.needHelp,
      nextActions: member.nextActions,
    })),
  }

  return new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
}
