export const COLORS = {
  primary: '#00A651',
  primaryDark: '#007A3D',
  primaryLight: '#E6F7EE',
  secondary: '#FF6B35',
  accent: '#FFD700',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceAlt: '#F8F8F8',
  border: '#E0E0E0',
  borderLight: '#F0F0F0',
  text: '#1A1A1A',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textInverse: '#FFFFFF',
  error: '#E53935',
  warning: '#FB8C00',
  success: '#43A047',
  info: '#1E88E5',
  darkBackground: '#121212',
  darkSurface: '#1E1E1E',
  darkSurfaceAlt: '#2A2A2A',
  darkBorder: '#333333',
  darkText: '#F5F5F5',
  darkTextSecondary: '#AAAAAA',
};

export const TYPOGRAPHY = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 20,
  fontSizeXXL: 24,
  fontSizeDisplay: 32,
  fontWeightLight: '300' as const,
  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,
  lineHeightSM: 18,
  lineHeightMD: 22,
  lineHeightLG: 26,
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
};

export const RADIUS = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOWS = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const CONDITION_COLORS: Record<string, string> = {
  new: '#43A047',
  like_new: '#7CB342',
  good: '#FB8C00',
  fair: '#F4511E',
  poor: '#E53935',
};

export const CONDITION_LABELS: Record<string, { en: string; ar: string }> = {
  new: { en: 'New', ar: 'جديد' },
  like_new: { en: 'Like New', ar: 'كالجديد' },
  good: { en: 'Good', ar: 'جيد' },
  fair: { en: 'Fair', ar: 'مقبول' },
  poor: { en: 'Poor', ar: 'مستعمل' },
};

export const PAYMENT_LABELS: Record<string, { en: string; ar: string; icon: string }> = {
  fawry: { en: 'Fawry', ar: 'فوري', icon: '🏧' },
  instapay: { en: 'InstaPay', ar: 'انستاباي', icon: '📱' },
  vodafone_cash: { en: 'Vodafone Cash', ar: 'فودافون كاش', icon: '📲' },
  wallet: { en: 'Kaero Wallet', ar: 'محفظة كايرو', icon: '💳' },
  cash: { en: 'Cash on Delivery', ar: 'الدفع عند الاستلام', icon: '💵' },
};
