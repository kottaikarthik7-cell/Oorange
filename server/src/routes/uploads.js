// Image uploads for avatars / posts. Stores locally under data/uploads.

import { Router } from "express"
import multer from "multer"
import path from "node:path"
import fs from "node:fs"
import { nanoid } from "nanoid"
import { authRequired } from "../middleware/authRequired.js"

const UPLOAD_DIR = process.env.UPLOAD_DIR || "./data/uploads"
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, nanoid(14) + ext)
  },
})
const upload = multer({
  storage,
  limits: { fileSize: 6 * 1024 * 1024 }, // 6MB
  fileFilter: (_, file, cb) => {
    if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.mimetype)) {
      return cb(new Error("unsupported_type"))
    }
    cb(null, true)
  },
})

const router = Router()

// POST /uploads — multipart form, field name "file"
router.post("/", authRequired, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no_file" })
  const url = `/uploads/${path.basename(req.file.path)}`
  res.json({ url })
})

export default router
