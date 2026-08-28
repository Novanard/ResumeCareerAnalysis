const test = require("node:test");
const assert = require("node:assert/strict");

const { createResumeService } = require("../src/services/resumeService");

function createSupabaseMock({ profile, profileError, uploadError, insertError } = {}) {
  const calls = { uploads: [], inserts: [], removals: [], updates: [] };

  const client = {
    from(table) {
      if (table === "candidate_profiles") {
        return {
          select() {
            return {
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: profile === undefined ? { id: "profile-123" } : profile,
                      error: profileError || null,
                    };
                  },
                };
              },
            };
          },
        };
      }

      if (table === "resumes") {
        return {
          insert(payload) {
            calls.inserts.push(payload);
            return {
              select() {
                return {
                  async single() {
                    return {
                      data: insertError ? null : { id: "resume-123", ...payload },
                      error: insertError || null,
                    };
                  },
                };
              },
            };
          },
          update(payload) {
            calls.updates.push(payload);
            return {
              eq(_column, resumeId) {
                return {
                  select() {
                    return {
                      async single() {
                        return {
                          data: insertError
                            ? null
                            : { id: resumeId, ...payload },
                          error: insertError || null,
                        };
                      },
                    };
                  },
                };
              },
            };
          },
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
    storage: {
      from(bucket) {
        assert.equal(bucket, "resumes");
        return {
          async upload(storagePath, buffer, options) {
            calls.uploads.push({ storagePath, buffer, options });
            return { error: uploadError || null };
          },
          async remove(paths) {
            calls.removals.push(paths);
            return { error: null };
          },
        };
      },
    },
  };

  return { client, calls };
}

const file = {
  originalname: "Maya Resume.pdf",
  mimetype: "application/pdf",
  size: 11,
  buffer: Buffer.from("resume pdf"),
};

test("saveResume stores the file and creates its database record", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createResumeService(client);

  const resume = await service.saveResume({ file, userId: "user-123" });

  assert.equal(resume.id, "resume-123");
  assert.equal(calls.uploads.length, 1);
  assert.match(calls.uploads[0].storagePath, /^user-123\/[0-9a-f-]+\.pdf$/);
  assert.equal(calls.uploads[0].buffer, file.buffer);
  assert.deepEqual(calls.uploads[0].options, {
    contentType: "application/pdf",
    upsert: false,
  });
  assert.deepEqual(calls.inserts[0], {
    candidate_profile_id: "profile-123",
    storage_path: calls.uploads[0].storagePath,
    original_filename: "Maya Resume.pdf",
    mime_type: "application/pdf",
    file_size: 11,
  });
});

test("saveResume rejects a user without a candidate profile", async () => {
  const { client, calls } = createSupabaseMock({ profile: null });
  const service = createResumeService(client);

  await assert.rejects(
    service.saveResume({ file, userId: "user-123" }),
    { statusCode: 404, message: "Candidate profile not found" },
  );
  assert.equal(calls.uploads.length, 0);
});

test("saveResume does not create a record when Storage fails", async () => {
  const { client, calls } = createSupabaseMock({
    uploadError: new Error("Storage unavailable"),
  });
  const service = createResumeService(client);

  await assert.rejects(service.saveResume({ file, userId: "user-123" }));
  assert.equal(calls.inserts.length, 0);
});

test("saveResume removes the stored file when record creation fails", async () => {
  const { client, calls } = createSupabaseMock({
    insertError: new Error("Database unavailable"),
  });
  const service = createResumeService(client);

  await assert.rejects(service.saveResume({ file, userId: "user-123" }));
  assert.deepEqual(calls.removals, [[calls.uploads[0].storagePath]]);
});

test("saveExtractedText updates the stored resume record", async () => {
  const { client, calls } = createSupabaseMock();
  const service = createResumeService(client);

  const resume = await service.saveExtractedText({
    resumeId: "resume-123",
    extractedText: "Maya Cohen\nSoftware Engineer",
  });

  assert.deepEqual(calls.updates, [
    {
      extracted_text: "Maya Cohen\nSoftware Engineer",
      processing_status: "text_extracted",
      processing_error: null,
    },
  ]);
  assert.deepEqual(resume, {
    id: "resume-123",
    extracted_text: "Maya Cohen\nSoftware Engineer",
    processing_status: "text_extracted",
    processing_error: null,
  });
});
