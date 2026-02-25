import { Router, Response, NextFunction } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth.middleware';
import { AppError } from '../../application/auth.service';
import { query, queryOne } from '../../infrastructure/database/pool';
import { z } from 'zod';

// Maps GPT-4o category slug → DB category name_en
const CATEGORY_MAP: Record<string, string> = {
  phones: 'Mobile Phones',
  laptops: 'Laptops',
  tablets: 'Tablets',
  audio: 'Audio',
  gaming: 'Gaming',
  cameras: 'Cameras',
  drones: 'Cameras',
  furniture: 'Home & Garden',
  cars: 'Vehicles',
  other: 'Other',
};

async function resolveCategoryId(aiCategory: string): Promise<number | null> {
  const mappedName = CATEGORY_MAP[aiCategory?.toLowerCase()] ?? null;
  if (!mappedName) return null;
  const cat = await queryOne<any>(
    `SELECT id FROM categories WHERE name_en = $1 AND is_active = TRUE LIMIT 1`,
    [mappedName]
  );
  return cat?.id ?? null;
}

const router = Router();

// POST /api/v1/ai/analyze-image
router.post('/analyze-image', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { image_base64, category_hint } = z.object({
      image_base64: z.string(),
      category_hint: z.string().optional(),
    }).parse(req.body);

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      const mockCat = category_hint || 'other';
      const mockCategoryId = await resolveCategoryId(mockCat);
      return res.json({
        title: 'Product Listing',
        title_ar: 'إعلان منتج',
        description: 'Good condition item available for sale.',
        description_ar: 'منتج في حالة جيدة للبيع.',
        suggested_price: 500,
        category: mockCat,
        category_id: mockCategoryId,
        condition: 'good',
        confidence: 0.7,
        key_features: [],
        mock: true,
      });
    }

    const prompt = `You are a marketplace listing assistant for Egypt's Kaero platform. Analyze this product image.
${category_hint ? `Category hint: ${category_hint}` : ''}
Return ONLY valid JSON:
{"title":"concise English title max 60 chars","title_ar":"Arabic title","description":"2-3 sentence English description","description_ar":"Arabic description","suggested_price_egp":realistic_EGP_number,"category":"phones|laptops|tablets|audio|gaming|cameras|drones|furniture|cars|other","condition":"new|like_new|good|fair|poor","confidence":0_to_1,"key_features":["feat1","feat2"]}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64}`, detail: 'low' } }
          ]
        }]
      })
    });

    if (!response.ok) throw new AppError('AI service unavailable', 503);
    const data = await response.json() as any;
    const content = data.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, '').trim());

    const categoryId = await resolveCategoryId(parsed.category);

    res.json({
      title: parsed.title,
      title_ar: parsed.title_ar,
      description: parsed.description,
      description_ar: parsed.description_ar,
      suggested_price: parsed.suggested_price_egp,
      category: parsed.category,
      category_id: categoryId,
      condition: parsed.condition,
      confidence: parsed.confidence,
      key_features: parsed.key_features || [],
      mock: false,
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.json({ title: 'Product Listing', description: 'Good condition item.', suggested_price: 500, category: 'other', condition: 'good', confidence: 0.5, mock: true });
    }
    next(err);
  }
});

// POST /api/v1/ai/price-suggest
router.post('/price-suggest', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { category_id, title, condition } = z.object({
      category_id: z.number().optional(),
      title: z.string(),
      condition: z.enum(['new', 'like_new', 'good', 'fair', 'poor']),
    }).parse(req.body);

    const stats = await queryOne(
      `SELECT
        AVG(final_price)::numeric(10,2) as avg_price,
        MIN(final_price) as min_price,
        MAX(final_price) as max_price,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_price)::numeric(10,2) as median_price,
        COUNT(*) as sample_size
       FROM listings
       WHERE status IN ('active','sold')
       AND ($1::int IS NULL OR category_id = $1)
       AND to_tsvector('english', user_edited_title) @@ plainto_tsquery('english', $2)`,
      [category_id ?? null, title]
    );

    const multipliers: Record<string, number> = {
      new: 1.0, like_new: 0.85, good: 0.70, fair: 0.55, poor: 0.40
    };
    const multiplier = multipliers[condition] ?? 0.7;

    if (!stats || parseInt(stats.sample_size) < 3) {
      return res.json({ suggested_price: null, message: 'Not enough market data', sample_size: 0 });
    }

    res.json({
      suggested_price: Math.round(parseFloat(stats.median_price) * multiplier),
      avg_price: Math.round(parseFloat(stats.avg_price)),
      min_price: parseInt(stats.min_price),
      max_price: parseInt(stats.max_price),
      sample_size: parseInt(stats.sample_size),
      condition_factor: multiplier,
    });
  } catch (err) { next(err); }
});


// POST /api/v1/ai/voice-search   (OpenAI Whisper transcription)
router.post('/voice-search', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { audio_base64, mime_type = 'audio/m4a' } = z.object({
      audio_base64: z.string().min(1),
      mime_type: z.string().default('audio/m4a'),
    }).parse(req.body);

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      return res.json({ transcript: '', mock: true, message: 'OPENAI_API_KEY not configured' });
    }

    // Convert base64 to Buffer and POST as multipart using Node FormData (native in Node 18+)
    const audioBuffer = Buffer.from(audio_base64, 'base64');
    const ext = mime_type.split('/')[1]?.replace('mpeg', 'mp3') ?? 'm4a';
    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: mime_type }), `audio.${ext}`);
    formData.append('model', 'whisper-1');
    formData.append('language', 'ar');

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + openaiKey },
      body: formData as any,
    });

    if (!response.ok) throw new AppError('Voice recognition failed', 503);
    const data = await response.json() as any;
    res.json({ transcript: data.text ?? '', mock: false });
  } catch (err) { next(err); }
});

// POST /api/v1/ai/ask  — Kaero conversational AI assistant (GPT-4o-mini)
router.post('/ask', requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { message } = z.object({ message: z.string().min(1).max(1000) }).parse(req.body);
    const userId = req.userId!;

    // Load rolling conversation history from user record
    const user = await queryOne<any>('SELECT ai_conversation FROM users WHERE id = $1', [userId]);
    const history: Array<{ role: string; content: string }> = user?.ai_conversation ?? [];

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      const reply = `أهلاً! أنا مساعد كايرو الذكي. سألتَ: "${message}". يرجى تهيئة OPENAI_API_KEY لتفعيل المساعد.`;
      return res.json({ reply, mock: true });
    }

    const systemPrompt = `You are Kaero's helpful AI marketplace assistant for Egypt. Kaero is a trusted hyperlocal marketplace where users buy and sell second-hand items safely using escrow protection.

Key platform facts:
- Escrow flow: buyer pays → funds held in escrow → seller ships/hands over → buyer confirms receipt → seller gets paid
- Platform fee: 4% per transaction (shared between buyer and seller)
- Offers: buyers make price offers, sellers can accept/counter/decline
- Identity verification: upload ID + selfie → raises trust score
- Wallet: sellers accumulate earnings, withdraw via bank/Vodafone Cash/InstaPay/Fawry (min 100 EGP)
- Listing boost: Basic 15 EGP/1 day, Standard 49 EGP/7 days, Premium 149 EGP/30 days
- Referral program: share code → friend joins → both get 50 EGP credits; friend's first transaction → extra 100 EGP
- Disputes: buyers can open a dispute within 3 days of confirming receipt with photo evidence
- Safety: meet in public, verify item before paying, use escrow never bank transfer outside app

Answer in the same language the user writes in (Arabic or English). Be concise, friendly, and accurate.`;

    const recentHistory = history.slice(-18);
    const messages = [
      { role: 'system', content: systemPrompt },
      ...recentHistory,
      { role: 'user', content: message },
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 600,
        messages,
      }),
    });

    if (!response.ok) throw new AppError('AI service unavailable', 503);
    const data = await response.json() as any;
    const reply: string = data.choices?.[0]?.message?.content ?? 'عذراً، لم أتمكن من معالجة طلبك. حاول مرة أخرى.';

    // Persist rolling history (cap at 20 messages = 10 turns)
    const updatedHistory = [
      ...recentHistory,
      { role: 'user', content: message },
      { role: 'assistant', content: reply },
    ].slice(-20);

    query('UPDATE users SET ai_conversation = $1 WHERE id = $2', [JSON.stringify(updatedHistory), userId])
      .catch(() => {});

    res.json({ reply, mock: false });
  } catch (err) { next(err); }
});

export default router;

