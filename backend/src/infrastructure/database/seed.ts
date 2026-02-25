import { pool, query } from './pool';

async function seed() {
  console.log('🌱 Seeding database...');

  // ─── Categories ──────────────────────────────────────
  const categories = [
    // Parent categories
    { name_en: 'Electronics', name_ar: 'إلكترونيات', keywords: ['phone', 'laptop', 'tablet', 'tv', 'camera'], order: 1 },
    { name_en: 'Vehicles', name_ar: 'سيارات', keywords: ['car', 'motorcycle', 'bike', 'scooter'], order: 2 },
    { name_en: 'Fashion', name_ar: 'أزياء', keywords: ['clothes', 'shoes', 'bags', 'accessories', 'watch'], order: 3 },
    { name_en: 'Home & Garden', name_ar: 'المنزل والحديقة', keywords: ['furniture', 'appliance', 'decor', 'tools'], order: 4 },
    { name_en: 'Sports', name_ar: 'رياضة', keywords: ['gym', 'football', 'tennis', 'running', 'fitness'], order: 5 },
    { name_en: 'Books & Media', name_ar: 'كتب وميديا', keywords: ['book', 'game', 'music', 'dvd'], order: 6 },
    { name_en: 'Baby & Kids', name_ar: 'أطفال', keywords: ['toys', 'stroller', 'clothes', 'baby'], order: 7 },
    { name_en: 'Property', name_ar: 'عقارات', keywords: ['apartment', 'house', 'land', 'office'], order: 8 },
    { name_en: 'Services', name_ar: 'خدمات', keywords: ['repair', 'cleaning', 'tutoring', 'delivery'], order: 9 },
    { name_en: 'Other', name_ar: 'أخرى', keywords: ['misc'], order: 10 },
  ];

  for (const cat of categories) {
    await query(
      `INSERT INTO categories (name_en, name_ar, ai_keywords, display_order)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [cat.name_en, cat.name_ar, JSON.stringify(cat.keywords), cat.order]
    );
  }

  // ─── Sub-categories for Electronics ──────────────────
  const electronicsParent = await query<any>(`SELECT id FROM categories WHERE name_en = 'Electronics' LIMIT 1`);
  if (electronicsParent.length > 0) {
    const parentId = electronicsParent[0].id;
    const subcats = [
      { name_en: 'Mobile Phones', name_ar: 'هواتف محمولة', keywords: ['iphone', 'samsung', 'huawei', 'oppo', 'xiaomi'] },
      { name_en: 'Laptops', name_ar: 'لابتوب', keywords: ['macbook', 'dell', 'hp', 'lenovo', 'asus'] },
      { name_en: 'Tablets', name_ar: 'تابلت', keywords: ['ipad', 'samsung tab', 'tablet'] },
      { name_en: 'TVs & Monitors', name_ar: 'تلفزيونات وشاشات', keywords: ['smart tv', 'led', 'monitor', 'screen'] },
      { name_en: 'Gaming', name_ar: 'ألعاب', keywords: ['ps5', 'xbox', 'nintendo', 'controller', 'gaming pc'] },
      { name_en: 'Cameras', name_ar: 'كاميرات', keywords: ['dslr', 'mirrorless', 'gopro', 'drone'] },
      { name_en: 'Audio', name_ar: 'صوتيات', keywords: ['airpods', 'headphones', 'speaker', 'earbuds'] },
      { name_en: 'Accessories', name_ar: 'إكسسوارات', keywords: ['case', 'charger', 'cable', 'power bank'] },
    ];

    let order = 1;
    for (const sub of subcats) {
      await query(
        `INSERT INTO categories (parent_id, name_en, name_ar, ai_keywords, display_order)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [parentId, sub.name_en, sub.name_ar, JSON.stringify(sub.keywords), order++]
      );
    }
  }

  console.log('✓ Categories seeded.');
  console.log('✓ Seed complete.');
  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
