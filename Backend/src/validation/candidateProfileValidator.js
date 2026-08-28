const Ajv = require("ajv");
const {
  candidateProfileSchema,
} = require("../schemas/candidateProfileSchema");

const ajv = new Ajv({ allErrors: true, strict: true });
const validateSchema = ajv.compile(candidateProfileSchema);
const placeholderValues = new Set(["not provided", "unknown", "n/a"]);

function findPlaceholder(value, path = "$") {
  if (typeof value === "string" && placeholderValues.has(value.trim().toLowerCase())) {
    return path;
  }

  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = findPlaceholder(value[index], `${path}[${index}]`);
      if (found) return found;
    }
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      const found = findPlaceholder(child, `${path}.${key}`);
      if (found) return found;
    }
  }

  return null;
}

function validateCandidateProfile(profile) {
  const schemaIsValid = validateSchema(profile);
  const errors = schemaIsValid ? [] : structuredClone(validateSchema.errors || []);
  const placeholderPath = findPlaceholder(profile);

  if (placeholderPath) {
    errors.push({
      instancePath: placeholderPath,
      keyword: "unknownScalarPlaceholder",
      message: "must use null instead of an unknown-value placeholder",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

module.exports = { validateCandidateProfile };
