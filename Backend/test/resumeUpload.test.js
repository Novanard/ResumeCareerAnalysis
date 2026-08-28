const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");

const { createApp } = require("../src/app");
const {
  ResumeTextExtractionError,
} = require("../src/services/resumeTextExtractor");

const authenticatedUser = {
  id: "user-123",
  email: "candidate@example.com",
};

function createAuthenticatedApp() {
  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: authenticatedUser },
        error: null,
      }),
    },
  };

  const storedResume = {
    id: "resume-123",
    original_filename: null,
    mime_type: null,
    file_size: null,
  };

  const resumeService = {
    async saveResume({ file, userId }) {
      assert.equal(userId, authenticatedUser.id);
      storedResume.original_filename = file.originalname;
      storedResume.mime_type = file.mimetype;
      storedResume.file_size = file.size;
      return storedResume;
    },
    async saveExtractedText({ resumeId, extractedText }) {
      assert.equal(resumeId, storedResume.id);
      assert.equal(extractedText, "Extracted resume content");
      return { ...storedResume, extracted_text: extractedText };
    },
  };

  const resumeTextExtractor = {
    async extractText() {
      return "Extracted resume content";
    },
  };

  return createApp({
    supabaseClient: supabase,
    resumeService,
    resumeTextExtractor,
  });
}

function authenticatedRequest(app) {
  return request(app)
    .post("/api/resumes")
    .set("Authorization", "Bearer valid-token");
}

test("POST /api/resumes requires authentication", async () => {
  const app = createAuthenticatedApp();

  await request(app)
    .post("/api/resumes")
    .attach("resume", Buffer.from("pdf"), {
      filename: "resume.pdf",
      contentType: "application/pdf",
    })
    .expect(401);
});

test("POST /api/resumes requires a resume file", async () => {
  const response = await authenticatedRequest(createAuthenticatedApp())
    .expect(400);

  assert.deepEqual(response.body, { error: "Resume file is required" });
});

test("POST /api/resumes rejects unsupported file types", async () => {
  const response = await authenticatedRequest(createAuthenticatedApp())
    .attach("resume", Buffer.from("plain text"), {
      filename: "resume.txt",
      contentType: "text/plain",
    })
    .expect(400);

  assert.deepEqual(response.body, {
    error: "Only PDF and DOCX resume files are supported",
  });
});

for (const file of [
  { filename: "resume.pdf", contentType: "application/pdf" },
  {
    filename: "resume.docx",
    contentType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
]) {
  test(`POST /api/resumes validates ${file.filename}`, async () => {
    const response = await authenticatedRequest(createAuthenticatedApp())
      .attach("resume", Buffer.from("resume content"), file)
      .expect(201);

    assert.deepEqual(response.body, {
      resume: {
        id: "resume-123",
        original_filename: file.filename,
        mime_type: file.contentType,
        file_size: 14,
        extracted_text: "Extracted resume content",
      },
    });
  });
}

test("POST /api/resumes rejects files larger than 5 MB", async () => {
  const response = await authenticatedRequest(createAuthenticatedApp())
    .attach("resume", Buffer.alloc(5 * 1024 * 1024 + 1), {
      filename: "large-resume.pdf",
      contentType: "application/pdf",
    })
    .expect(413);

  assert.deepEqual(response.body, {
    error: "Resume file must be 5 MB or smaller",
  });
});

test("POST /api/resumes keeps the upload when text extraction fails", async () => {
  const supabase = {
    auth: {
      getUser: async () => ({
        data: { user: authenticatedUser },
        error: null,
      }),
    },
  };
  const resumeService = {
    async saveResume() {
      return { id: "resume-123" };
    },
  };
  const resumeTextExtractor = {
    async extractText() {
      throw new ResumeTextExtractionError(
        "No readable text was found in the resume",
      );
    },
  };

  const response = await request(createApp({
    supabaseClient: supabase,
    resumeService,
    resumeTextExtractor,
  }))
    .post("/api/resumes")
    .set("Authorization", "Bearer valid-token")
    .attach("resume", Buffer.from("pdf"), {
      filename: "resume.pdf",
      contentType: "application/pdf",
    })
    .expect(422);

  assert.deepEqual(response.body, {
    error: "No readable text was found in the resume",
    resume: { id: "resume-123", status: "extraction_failed" },
  });
});
