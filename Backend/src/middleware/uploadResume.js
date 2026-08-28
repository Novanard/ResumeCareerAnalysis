const path = require("node:path");
const multer = require("multer");

const MAX_RESUME_SIZE_BYTES = 5 * 1024 * 1024;

const allowedTypes = new Map([
  [".pdf", "application/pdf"],
  [
    ".docx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_SIZE_BYTES,
    files: 1,
  },
}).single("resume");

function handleResumeUpload(req, res, next) {
  upload(req, res, (error) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res
        .status(413)
        .json({ error: "Resume file must be 5 MB or smaller" });
    }

    if (error) {
      return res.status(400).json({ error: "Unable to read resume file" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "Resume file is required" });
    }

    const extension = path.extname(req.file.originalname).toLowerCase();
    const expectedMimeType = allowedTypes.get(extension);

    if (!expectedMimeType || req.file.mimetype !== expectedMimeType) {
      return res.status(400).json({
        error: "Only PDF and DOCX resume files are supported",
      });
    }

    return next();
  });
}

module.exports = { handleResumeUpload, MAX_RESUME_SIZE_BYTES };
