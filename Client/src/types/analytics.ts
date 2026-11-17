type Origin = { id: string; source?: 'profile' | 'resume' | 'candidate_answer' | 'manual' }
type Dates = { startDate: string | null; endDate: string | null; current: boolean | null }
export interface AnalyticsData {
  schemaVersion: 1
  projects: Array<Origin & Dates & { profileProjectIndex: number }>
  skillUsages: Array<Origin & Dates & {
    profileSkillIndex: number; projectIds: string[]; profileExperienceIndex: number | null
    usage: 'hands_on' | 'led' | 'assisted' | null
    intensity: 'occasional' | 'regular' | 'primary' | null
    depth: 'exposure' | 'applied' | 'independent' | 'ownership' | null
    assessmentBasis: string | null
  }>
  outcomes: Array<Origin & { projectId: string; description: string; metric: string; baseline: number | null; result: number | null; unit: string | null; timeframe: string | null; measurementMethod: string | null; preferredDirection: 'increase' | 'decrease' | null }>
  decisions: Array<Origin & { projectId: string; description: string; rationale: string | null; outcomeIds: string[] }>
  artifacts: Array<Origin & { projectId: string; title: string; kind: string; url: string | null }>
  evidence: Array<Origin & { claimType: 'outcome' | 'decision'; claimId: string; artifactId: string; snippet: string }>
  collaborations: Array<Origin & { projectId: string; collaborator: string; relationship: string; description: string | null }>
}
export interface DerivedAnalytics { content: AnalyticsData; generatedAt: string; extractionVersion: number; method: 'model' | 'baseline' }
export interface AnalyticsSnapshot { profileRevision: number; analytics: DerivedAnalytics }
export const emptyAnalytics = (): AnalyticsData => ({ schemaVersion: 1, projects: [], skillUsages: [], outcomes: [], decisions: [], artifacts: [], evidence: [], collaborations: [] })
