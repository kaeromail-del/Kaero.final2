import { Router, Request, Response, NextFunction } from 'express';
import { query } from '../../infrastructure/database/pool';

const router = Router();

// GET /api/v1/categories
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT * FROM categories WHERE is_active = TRUE ORDER BY display_order ASC, name_en ASC`
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/categories/:id/children
router.get('/:id/children', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await query(
      `SELECT * FROM categories WHERE parent_id = $1 AND is_active = TRUE ORDER BY display_order ASC`,
      [req.params.id]
    );
    res.json({ categories: rows });
  } catch (err) {
    next(err);
  }
});

export default router;
