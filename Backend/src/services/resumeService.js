const path = require("node:path");
const { randomUUID } = require("node:crypto");

class ResumeServiceError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.name = "ResumeServiceError";
    this.statusCode = statusCode;
  }
}

function createResumeService(supabaseClient) {
  return {
    async saveResume({ file, userId }) {
      const { data: profile, error: profileError } = await supabaseClient
        .from("candidate_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError) {
        throw new ResumeServiceError("Unable to find candidate profile", 500);
      }

      if (!profile) {
        throw new ResumeServiceError("Candidate profile not found", 404);
      }

      const extension = path.extname(file.originalname).toLowerCase();
      const storagePath = `${userId}/${randomUUID()}${extension}`;
      const bucket = supabaseClient.storage.from("resumes");
      const { error: uploadError } = await bucket.upload(
        storagePath,
        file.buffer,
        {
          contentType: file.mimetype,
          upsert: false,
        },
      );

      if (uploadError) {
        throw new ResumeServiceError("Unable to store resume file", 502);
      }

      const record = {
        candidate_profile_id: profile.id,
        storage_path: storagePath,
        original_filename: file.originalname,
        mime_type: file.mimetype,
        file_size: file.size,
      };

      const { data: resume, error: insertError } = await supabaseClient
        .from("resumes")
        .insert(record)
        .select()
        .single();

      if (insertError) {
        await bucket.remove([storagePath]);
        throw new ResumeServiceError("Unable to create resume record", 500);
      }

      return resume;
    },

    async saveExtractedText({ resumeId, extractedText }) {
      const { data: resume, error } = await supabaseClient
        .from("resumes")
        .update({
          extracted_text: extractedText,
          processing_status: "text_extracted",
          processing_error: null,
        })
        .eq("id", resumeId)
        .select()
        .single();

      if (error) {
        throw new ResumeServiceError(
          "Unable to save extracted resume text",
          500,
        );
      }

      return resume;
    },

    async getOwnedResume({ resumeId, userId }) {
      const { data: profile, error: profileError } = await supabaseClient
        .from("candidate_profiles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw new ResumeServiceError("Unable to find candidate profile", 500);
      if (!profile) throw new ResumeServiceError("Resume not found", 404);

      const { data, error } = await supabaseClient
        .from("resumes")
        .select("*")
        .eq("id", resumeId)
        .eq("candidate_profile_id", profile.id)
        .maybeSingle();
      if (error) throw new ResumeServiceError("Unable to load resume", 500);
      if (!data) throw new ResumeServiceError("Resume not found", 404);
      return data;
    },

    async updateProcessingState({ resumeId, status, error, parsedAt }) {
      const changes = { processing_status: status, processing_error: error };
      if (parsedAt !== undefined) changes.parsed_at = parsedAt;
      const { data, error: updateError } = await supabaseClient
        .from("resumes")
        .update(changes)
        .eq("id", resumeId)
        .select()
        .single();
      if (updateError) throw new ResumeServiceError("Unable to update resume processing state", 500);
      return data;
    },
  };
}

module.exports = { createResumeService, ResumeServiceError };
