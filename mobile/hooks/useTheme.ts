import { useSettingsStore } from '../store/settingsStore';
import { COLORS, SHADOWS } from '../constants/theme';

/** Returns color tokens and a helper that picks light vs dark value */
export function useTheme() {
  const { isDark } = useSettingsStore();

  const C = {
    // Backgrounds
    background:    isDark ? COLORS.darkBackground  : COLORS.background,
    surface:       isDark ? COLORS.darkSurface      : COLORS.surface,
    surfaceAlt:    isDark ? COLORS.darkSurfaceAlt   : COLORS.surfaceAlt,
    // Borders
    border:        isDark ? COLORS.darkBorder       : COLORS.border,
    borderLight:   isDark ? COLORS.darkBorder       : COLORS.borderLight,
    // Text
    text:          isDark ? COLORS.darkText         : COLORS.text,
    textSecondary: isDark ? COLORS.darkTextSecondary: COLORS.textSecondary,
    textTertiary:  isDark ? '#666666'               : COLORS.textTertiary,
    textInverse:   COLORS.textInverse,
    // Brand (unchanged)
    primary:       COLORS.primary,
    primaryDark:   COLORS.primaryDark,
    primaryLight:  isDark ? '#0A2E1A' : COLORS.primaryLight,
    secondary:     COLORS.secondary,
    // Status
    error:         COLORS.error,
    warning:       COLORS.warning,
    success:       COLORS.success,
    info:          COLORS.info,
  };

  // Shadows are subtle in dark mode
  const S = isDark
    ? {
        sm: { shadowOpacity: 0, elevation: 0 },
        md: { shadowOpacity: 0, elevation: 0 },
        lg: { shadowOpacity: 0, elevation: 0 },
      }
    : SHADOWS;

  return { C, S, isDark };
}
