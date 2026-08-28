function toCandidateProfileRow(profile) {
  const {
    fullName,
    headline,
    summary,
    ...profileData
  } = profile;

  return {
    full_name: fullName,
    headline,
    summary,
    profile_data: profileData,
  };
}

function fromCandidateProfileRow(row) {
  return {
    ...row.profile_data,
    fullName: row.full_name ?? null,
    headline: row.headline ?? null,
    summary: row.summary ?? null,
  };
}

module.exports = {
  toCandidateProfileRow,
  fromCandidateProfileRow,
};
