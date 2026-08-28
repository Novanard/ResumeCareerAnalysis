const nullableString = { type: ["string", "null"] };
const nullableBoolean = { type: ["boolean", "null"] };
const nullableDate = {
  anyOf: [
    { type: "string", pattern: "^[0-9]{4}(?:-(?:0[1-9]|1[0-2]))?$" },
    { type: "null" },
  ],
};

function strictObject(properties) {
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

const description = {
  type: "array",
  items: { type: "string" },
};

const candidateProfileSchema = strictObject({
  schemaVersion: { const: 1 },
  fullName: nullableString,
  headline: nullableString,
  summary: nullableString,
  contact: strictObject({
    email: nullableString,
    phone: nullableString,
    location: nullableString,
    linkedin: nullableString,
    github: nullableString,
  }),
  skills: {
    type: "array",
    items: strictObject({
      name: nullableString,
      category: nullableString,
    }),
  },
  experience: {
    type: "array",
    items: strictObject({
      company: nullableString,
      role: nullableString,
      location: nullableString,
      startDate: nullableDate,
      endDate: nullableDate,
      current: nullableBoolean,
      description,
    }),
  },
  education: {
    type: "array",
    items: strictObject({
      institution: nullableString,
      degree: nullableString,
      field: nullableString,
      startDate: nullableDate,
      endDate: nullableDate,
      current: nullableBoolean,
      description,
    }),
  },
  projects: {
    type: "array",
    items: strictObject({
      name: nullableString,
      description: nullableString,
      technologies: {
        type: "array",
        items: { type: "string" },
      },
      url: nullableString,
    }),
  },
  languages: {
    type: "array",
    items: strictObject({
      language: nullableString,
      level: nullableString,
    }),
  },
  certifications: {
    type: "array",
    items: strictObject({
      name: nullableString,
      issuer: nullableString,
      date: nullableDate,
      url: nullableString,
    }),
  },
  additionalSections: {
    type: "array",
    items: strictObject({
      title: nullableString,
      items: {
        type: "array",
        items: strictObject({
          heading: nullableString,
          subheading: nullableString,
          date: nullableDate,
          description,
        }),
      },
    }),
  },
  rawMetadata: strictObject({
    source: { const: "cv" },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
  }),
});

module.exports = { candidateProfileSchema };
