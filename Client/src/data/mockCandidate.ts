import type { CandidateProfile } from '../types/candidate'

export const mockCandidate: CandidateProfile = {
  fullName: 'Maya Cohen',
  headline: 'Full-Stack Developer',
  summary:
    'Computer science graduate with experience building accessible web applications and reliable backend services.',
  skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL', 'Git'],
  experience: [
    {
      role: 'Junior Full-Stack Developer',
      company: 'Northstar Labs',
      period: '2024 – Present',
      description:
        'Builds customer-facing React features and supports Node.js APIs used by the product team.',
    },
    {
      role: 'Software Development Intern',
      company: 'Bright Systems',
      period: '2023 – 2024',
      description:
        'Implemented internal tools and collaborated with designers to improve common workflows.',
    },
  ],
  education: [
    {
      qualification: 'B.Sc. in Computer Science',
      institution: 'Afeka College of Engineering',
      period: '2021 – 2025',
    },
  ],
}
