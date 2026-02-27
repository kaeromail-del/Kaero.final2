import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

interface ChipProps { children: React.ReactNode; active?: boolean; onPress?: () => void; color?: string; small?: boolean; }

export function Chip({ children, active, onPress, color = COLORS.primary, small }: ChipProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, small && styles.small, active && { backgroundColor: color, borderColor: color }]}
      activeOpacity={0.7}
    >
      <Text style={[styles.text, small && styles.smallText, active && { color: '#fff' }]}>{children}</Text>
    </TouchableOpacity>
  );
}
const styles = StyleSheet.create({
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: RADIUS.full, borderWidth: 1, borderColor: COLORS.borderLight, backgroundColor: COLORS.cardBg },
  small: { paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  text: { fontSize: TYPOGRAPHY.fontSizeSM, color: COLORS.iconDefault, fontWeight: TYPOGRAPHY.fontWeightMedium },
  smallText: { fontSize: TYPOGRAPHY.fontSizeXS },
});
