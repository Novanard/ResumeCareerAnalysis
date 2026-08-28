const validCandidateProfile = {
  schemaVersion: 1,
  fullName: "Maya Cohen",
  headline: null,
  summary: null,
  contact: {
    email: "maya@example.com",
    phone: null,
    location: "Tel Aviv, Israel",
    linkedin: null,
    github: null,
  },
  skills: [{ name: "React", category: "Framework" }],
  experience: [
    {
      company: "Example Company",
      role: "Software Developer",
      location: null,
      startDate: "2024-01",
      endDate: null,
      current: true,
      description: ["Developed React interfaces."],
    },
  ],
  education: [],
  projects: [],
  languages: [],
  certifications: [],
  additionalSections: [],
  rawMetadata: {
    source: "cv",
    warnings: [],
  },
};

module.exports = { validCandidateProfile };
