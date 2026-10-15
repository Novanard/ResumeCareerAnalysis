export interface CandidateProfile {
  schemaVersion: 1
  fullName: string | null
  headline: string | null
  summary: string | null
  contact: Record<string, string | null>
  skills: Array<{ name: string | null; category: string | null }>
  experience: Array<{
    company: string | null
    role: string | null
    location: string | null
    startDate: string | null
    endDate: string | null
    current: boolean | null
    description: string[]
  }>
  education: Array<{
    institution: string | null
    degree: string | null
    field: string | null
    startDate: string | null
    endDate: string | null
    current: boolean | null
    description: string[]
  }>
  projects: Array<Record<string, unknown>>
  languages: Array<Record<string, unknown>>
  certifications: Array<Record<string, unknown>>
  additionalSections: Array<Record<string, unknown>>
  rawMetadata: { source: 'cv'; warnings: string[] }
}
