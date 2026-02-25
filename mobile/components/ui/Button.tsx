import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../../constants/theme';

interface ButtonProps {
  children: React.ReactNode; onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg'; loading?: boolean; disabled?: boolean;
  fullWidth?: boolean; style?: ViewStyle;
}

export function Button({ children, onPress, variant = 'primary', size = 'md', loading, disabled, fullWidth, style }: ButtonProps) {
  const s = styles[variant]; const sz = sizeStyles[size];
  return (
    <TouchableOpacity
      onPress={onPress} disabled={disabled || loading}
      style={[base.btn, s.btn, sz.btn, fullWidth && { width: '100%' }, (disabled || loading) && base.disabled, style]}
      activeOpacity={0.75}
    >
      {loading
        ? <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : '#fff'} size="small" />
        : <Text style={[base.text, s.text, sz.text]}>{children}</Text>
      }
    </TouchableOpacity>
  );
}

const base = StyleSheet.create({
  btn: { borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  text: { fontWeight: TYPOGRAPHY.fontWeightSemiBold },
  disabled: { opacity: 0.5 },
});
const styles = {
  primary: StyleSheet.create({ btn: { backgroundColor: COLORS.primary }, text: { color: '#fff' } }),
  secondary: StyleSheet.create({ btn: { backgroundColor: COLORS.secondary }, text: { color: '#fff' } }),
  outline: StyleSheet.create({ btn: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary }, text: { color: COLORS.primary } }),
  ghost: StyleSheet.create({ btn: { backgroundColor: 'transparent' }, text: { color: COLORS.primary } }),
  danger: StyleSheet.create({ btn: { backgroundColor: COLORS.error }, text: { color: '#fff' } }),
};
const sizeStyles = {
  sm: StyleSheet.create({ btn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, height: 36 }, text: { fontSize: TYPOGRAPHY.fontSizeSM } }),
  md: StyleSheet.create({ btn: { paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, height: 48 }, text: { fontSize: TYPOGRAPHY.fontSizeMD } }),
  lg: StyleSheet.create({ btn: { paddingHorizontal: SPACING.xxl, paddingVertical: SPACING.md, height: 56 }, text: { fontSize: TYPOGRAPHY.fontSizeLG } }),
};
