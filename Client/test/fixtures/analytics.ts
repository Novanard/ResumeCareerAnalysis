import type { AnalyticsData } from '../../src/types/analytics'
import type { CandidateProfile } from '../../src/types/candidate'

export const profile: CandidateProfile = {
  schemaVersion: 1, fullName: 'Analytics Candidate', headline: 'Developer', summary: null,
  contact: { email: null, phone: null, location: null, linkedin: null, github: null },
  skills: [{ name: 'React', category: null }], experience: [], education: [],
  projects: [{ name: 'Dashboard', description: 'Built a dashboard.', technologies: ['React'], url: null }],
  certifications: [], languages: [], additionalSections: [], rawMetadata: { source: 'cv', warnings: [] },
}
export const analytics: AnalyticsData = {
  schemaVersion: 1,
  projects: [{ id: 'p1', profileProjectIndex: 0, startDate: '2024-01', endDate: '2024-06', current: false, source: 'manual' }],
  skillUsages: [{ id: 's1', profileSkillIndex: 0, projectIds: ['p1'], profileExperienceIndex: null, startDate: '2024-01', endDate: '2024-06', current: false, usage: 'led', intensity: 'primary', depth: 'ownership', assessmentBasis: 'Owned the frontend implementation.', source: 'manual' }],
  outcomes: [{ id: 'o1', projectId: 'p1', description: 'Reduced latency', metric: 'Latency', baseline: 100, result: 50, unit: 'ms', timeframe: '2024', measurementMethod: 'Load test', preferredDirection: 'decrease', source: 'manual' }],
  decisions: [{ id: 'd1', projectId: 'p1', description: 'Added caching', rationale: 'Reduce duplicate requests', outcomeIds: ['o1'], source: 'manual' }],
  artifacts: [{ id: 'a1', projectId: 'p1', title: 'Load test report', kind: 'report', url: 'https://example.com/report', source: 'manual' }],
  evidence: [{ id: 'e1', claimType: 'outcome', claimId: 'o1', artifactId: 'a1', snippet: 'Latency fell from 100ms to 50ms.', source: 'manual' }],
  collaborations: [{ id: 'c1', projectId: 'p1', collaborator: 'Platform team', relationship: 'cross_functional', description: 'Reviewed cache design', source: 'manual' }],
}
