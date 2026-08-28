const test = require("node:test");
const assert = require("node:assert/strict");

const {
  createResumeTextExtractor,
} = require("../src/services/resumeTextExtractor");

function createTextPdf(text) {
  const stream = `BT /F1 18 Tf 50 100 Td (${text}) Tj ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 150] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf);
}

test("default PDF parser extracts text from a real PDF buffer", async () => {
  const extractor = createResumeTextExtractor();

  const text = await extractor.extractText({
    mimetype: "application/pdf",
    buffer: createTextPdf("Maya Cohen Resume"),
  });

  assert.match(text, /Maya Cohen Resume/);
});

test("extractText reads and normalizes PDF text", async () => {
  let destroyed = false;
  const extractor = createResumeTextExtractor({
    createPdfParser: () => ({
      async getText() {
        return { text: "  Maya Cohen\n\nSoftware Engineer  " };
      },
      async destroy() {
        destroyed = true;
      },
    }),
    mammothClient: {},
  });

  const text = await extractor.extractText({
    mimetype: "application/pdf",
    buffer: Buffer.from("pdf"),
  });

  assert.equal(text, "Maya Cohen\n\nSoftware Engineer");
  assert.equal(destroyed, true);
});

test("extractText reads and normalizes DOCX text", async () => {
  const extractor = createResumeTextExtractor({
    createPdfParser: () => null,
    mammothClient: {
      async extractRawText({ buffer }) {
        assert.equal(buffer.toString(), "docx");
        return { value: "  Education\n\nAfeka College  " };
      },
    },
  });

  const text = await extractor.extractText({
    mimetype:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    buffer: Buffer.from("docx"),
  });

  assert.equal(text, "Education\n\nAfeka College");
});

test("extractText rejects a resume with no readable text", async () => {
  const extractor = createResumeTextExtractor({
    createPdfParser: () => ({
      async getText() {
        return { text: "   \n " };
      },
      async destroy() {},
    }),
    mammothClient: {},
  });

  await assert.rejects(
    extractor.extractText({
      mimetype: "application/pdf",
      buffer: Buffer.from("pdf"),
    }),
    { message: "No readable text was found in the resume", statusCode: 422 },
  );
});

test("extractText reports parser failures without exposing library errors", async () => {
  const extractor = createResumeTextExtractor({
    createPdfParser: () => ({
      async getText() {
        throw new Error("Internal parser details");
      },
      async destroy() {},
    }),
    mammothClient: {},
  });

  await assert.rejects(
    extractor.extractText({
      mimetype: "application/pdf",
      buffer: Buffer.from("broken pdf"),
    }),
    { message: "Resume text extraction failed", statusCode: 422 },
  );
});
