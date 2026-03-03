// ─── Kaero Design System — 70/30 Rule ───────────────────────
// 70% neutral (white, light gray, dark text)
// 30% brand (#00A651 green) — CTAs, active states, prices only

export const COLORS = {
  // Brand
  primary:        '#00A651',
  primaryDark:    '#007A3D',
  primaryLight:   '#E8F7EF',
  primaryMid:     '#CCF0DE',
  secondary:      '#FF6B35',
  accent:         '#FFD700',

  // Backgrounds (70%)
  background:     '#F7F8FA',
  surface:        '#FFFFFF',
  surfaceAlt:     '#F2F4F7',
  surfaceRaised:  '#FFFFFF',

  // Borders
  border:         '#E8EAED',
  borderLight:    '#F0F2F5',
  separator:      '#EEEFF1',

  // Text hierarchy
  text:           '#0F1117',
  textSecondary:  '#5C6370',
  textTertiary:   '#9EA5B0',
  textInverse:    '#FFFFFF',
  textPlaceholder:'#B0B7C3',

  // Status
  error:          '#E53935',
  warning:        '#F59E0B',
  success:        '#10B981',
  info:           '#3B82F6',

  // Dark mode
  darkBackground: '#0F1117',
  darkSurface:    '#1A1D23',
  darkSurfaceAlt: '#22262E',
  darkBorder:     '#2E3340',
  darkText:       '#F1F3F5',
  darkTextSecondary: '#8B93A1',

  // Icon tokens — ALL icons use iconDefault unless active
  iconDefault:    '#9EA5B0',   // 70%: neutral gray for ALL icons
  iconActive:     '#00A651',   // 30%: green only when active/selected
  iconSubtle:     '#C4CAD4',   // very muted, for decorative icons

  // UI helpers
  searchBg:       '#F0F2F6',
  cardBg:         '#FFFFFF',
  overlay:        'rgba(0,0,0,0.45)',
  shimmer:        '#F0F2F5',
};

export const TYPOGRAPHY = {
  // Sizes
  fontSizeXS:      11,
  fontSizeSM:      13,
  fontSizeMD:      15,
  fontSizeLG:      17,
  fontSizeXL:      20,
  fontSizeXXL:     24,
  fontSizeDisplay: 30,

  // Weights
  fontWeightLight:    '300' as const,
  fontWeightRegular:  '400' as const,
  fontWeightMedium:   '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold:     '700' as const,
  fontWeightBlack:    '800' as const,

  // Line heights
  lineHeightXS:    16,
  lineHeightSM:    18,
  lineHeightMD:    22,
  lineHeightLG:    26,
  lineHeightXL:    30,

  // Letter spacing (Stripe-style tight headings)
  letterSpacingTight:  -0.5,
  letterSpacingSnug:   -0.3,
  letterSpacingNormal:  0,
  letterSpacingWide:    0.3,
  letterSpacingWidest:  0.8,
};

export const SPACING = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
  xxxl: 32,
  huge: 48,
};

export const RADIUS = {
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   24,
  xxl:  32,
  full: 999,
};

export const SHADOWS = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
};

export const CONDITION_COLORS: Record<string, string> = {
  new:      '#10B981',
  like_new: '#34D399',
  good:     '#F59E0B',
  fair:     '#F97316',
  poor:     '#EF4444',
};

export const CONDITION_LABELS: Record<string, { en: string; ar: string }> = {
  new:      { en: 'New',      ar: 'جديد'    },
  like_new: { en: 'Like New', ar: 'كالجديد' },
  good:     { en: 'Good',     ar: 'جيد'     },
  fair:     { en: 'Fair',     ar: 'مقبول'   },
  poor:     { en: 'Poor',     ar: 'مستعمل'  },
};

export const PAYMENT_LABELS: Record<string, { en: string; ar: string; icon: string }> = {
  fawry:         { en: 'Fawry',            ar: 'فوري',               icon: '🏧' },
  instapay:      { en: 'InstaPay',         ar: 'انستاباي',           icon: '📱' },
  vodafone_cash: { en: 'Vodafone Cash',    ar: 'فودافون كاش',        icon: '📲' },
  wallet:        { en: 'Kaero Wallet',     ar: 'محفظة كايرو',        icon: '💳' },
  cash:          { en: 'Cash on Delivery', ar: 'الدفع عند الاستلام', icon: '💵' },
};
