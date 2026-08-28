const { PDFParse } = require("pdf-parse");
const mammoth = require("mammoth");

const PDF_MIME_TYPE = "application/pdf";
const DOCX_MIME_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

class ResumeTextExtractionError extends Error {
  constructor(message, statusCode = 422) {
    super(message);
    this.name = "ResumeTextExtractionError";
    this.statusCode = statusCode;
  }
}

function createResumeTextExtractor({
  createPdfParser = (buffer) => new PDFParse({ data: buffer }),
  mammothClient = mammoth,
} = {}) {
  return {
    async extractText(file) {
      let pdfParser;

      try {
        let extractedText;

        if (file.mimetype === PDF_MIME_TYPE) {
          pdfParser = createPdfParser(file.buffer);
          const result = await pdfParser.getText();
          extractedText = result.text;
        } else if (file.mimetype === DOCX_MIME_TYPE) {
          const result = await mammothClient.extractRawText({
            buffer: file.buffer,
          });
          extractedText = result.value;
        } else {
          throw new ResumeTextExtractionError(
            "Unsupported resume type for text extraction",
            400,
          );
        }

        const normalizedText = extractedText?.trim();

        if (!normalizedText) {
          throw new ResumeTextExtractionError(
            "No readable text was found in the resume",
          );
        }

        return normalizedText;
      } catch (error) {
        if (error instanceof ResumeTextExtractionError) {
          throw error;
        }

        throw new ResumeTextExtractionError("Resume text extraction failed");
      } finally {
        await pdfParser?.destroy();
      }
    },
  };
}

module.exports = {
  createResumeTextExtractor,
  ResumeTextExtractionError,
};
