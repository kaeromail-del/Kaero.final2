import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';

const router = Router();

// ── Storage ────────────────────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  },
});

// ── Helpers ────────────────────────────────────────────────
function fileUrl(req: AuthRequest, filename: string): string {
  const host = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${host}/uploads/${filename}`;
}

// POST /api/v1/uploads/image  — single image (multipart)
router.post('/image', requireAuth, upload.single('image'), (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file provided' });
    res.json({ url: fileUrl(req, req.file.filename) });
  } catch (err) { next(err); }
});

// POST /api/v1/uploads/images  — up to 9 images (multipart)
router.post('/images', requireAuth, upload.array('images', 9), (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' });
    const urls = files.map(f => fileUrl(req, f.filename));
    res.json({ urls });
  } catch (err) { next(err); }
});

// POST /api/v1/uploads/base64  — single image as base64 JSON body
// Used by mobile AI flow: captures base64, uploads to get a real URL
router.post('/base64', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { image_base64, mime_type = 'image/jpeg' } = req.body as { image_base64: string; mime_type?: string };
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

    const ext = mime_type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const filepath = path.join(UPLOAD_DIR, filename);

    const buffer = Buffer.from(image_base64, 'base64');
    if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 10 MB)' });

    fs.writeFileSync(filepath, buffer);
    res.json({ url: fileUrl(req, filename) });
  } catch (err) { next(err); }
});

export default router;
