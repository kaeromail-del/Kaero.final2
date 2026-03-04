import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { config } from '../../config';
import { getSupabaseAdmin, STORAGE_BUCKET } from '../../infrastructure/supabase/client';

const router = Router();

// ── Storage strategy ───────────────────────────────────────
// Uses Supabase Storage when SUPABASE_SERVICE_ROLE_KEY is configured.
// Falls back to local disk otherwise (dev / missing key).

const useSupabase = () => !!(config.supabase.url && config.supabase.serviceRoleKey);

// ── Local disk (fallback) ──────────────────────────────────
const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function makeUpload(inMemory: boolean) {
  return multer({
    storage: inMemory ? multer.memoryStorage() : multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
        cb(null, `${uuidv4()}${ext}`);
      },
    }),
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype.startsWith('image/')) cb(null, true);
      else cb(new Error('Only image files allowed'));
    },
  });
}

// ── Supabase upload helper ─────────────────────────────────
async function uploadToSupabase(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(filename, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filename);
  return data.publicUrl;
}

// ── Local URL helper ───────────────────────────────────────
function localUrl(req: AuthRequest, filename: string): string {
  const host = process.env.API_BASE_URL || `${req.protocol}://${req.get('host')}`;
  return `${host}/uploads/${filename}`;
}

// POST /api/v1/uploads/image  — single image (multipart)
router.post('/image', requireAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const sb = useSupabase();
  makeUpload(sb).single('image')(req as any, res as any, async (err) => {
    if (err) return next(err);
    try {
      if (!req.file) return res.status(400).json({ error: 'No file provided' });
      if (sb) {
        const filename = `${uuidv4()}${path.extname(req.file.originalname).toLowerCase() || '.jpg'}`;
        return res.json({ url: await uploadToSupabase(req.file.buffer, filename, req.file.mimetype) });
      }
      res.json({ url: localUrl(req, req.file.filename) });
    } catch (e) { next(e); }
  });
});

// POST /api/v1/uploads/images  — up to 9 images (multipart)
router.post('/images', requireAuth, (req: AuthRequest, res: Response, next: NextFunction) => {
  const sb = useSupabase();
  makeUpload(sb).array('images', 9)(req as any, res as any, async (err) => {
    if (err) return next(err);
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) return res.status(400).json({ error: 'No files provided' });
      if (sb) {
        const urls = await Promise.all(files.map(f => {
          const filename = `${uuidv4()}${path.extname(f.originalname).toLowerCase() || '.jpg'}`;
          return uploadToSupabase(f.buffer, filename, f.mimetype);
        }));
        return res.json({ urls });
      }
      res.json({ urls: files.map(f => localUrl(req, f.filename)) });
    } catch (e) { next(e); }
  });
});

// POST /api/v1/uploads/base64  — single image as base64 JSON body
router.post('/base64', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { image_base64, mime_type = 'image/jpeg' } = req.body as { image_base64: string; mime_type?: string };
    if (!image_base64) return res.status(400).json({ error: 'image_base64 required' });

    const ext = mime_type.split('/')[1]?.replace('jpeg', 'jpg') ?? 'jpg';
    const filename = `${uuidv4()}.${ext}`;
    const buffer = Buffer.from(image_base64, 'base64');
    if (buffer.length > 10 * 1024 * 1024) return res.status(400).json({ error: 'Image too large (max 10 MB)' });

    if (useSupabase()) {
      return res.json({ url: await uploadToSupabase(buffer, filename, mime_type) });
    }

    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buffer);
    res.json({ url: localUrl(req, filename) });
  } catch (err) { next(err); }
});

export default router;
