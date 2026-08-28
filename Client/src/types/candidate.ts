export interface Experience {
  role: string
  company: string
  period: string
  description: string
}

export interface Education {
  qualification: string
  institution: string
  period: string
}

export interface CandidateProfile {
  fullName: string
  headline: string
  summary: string
  skills: string[]
  experience: Experience[]
  education: Education[]
}
