import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY, RADIUS } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';

interface TopBarProps { title?: string; onBack?: () => void; right?: React.ReactNode; transparent?: boolean; showBack?: boolean; }

export function TopBar({ title, onBack, right, transparent, showBack = true }: TopBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const handleBack = onBack ?? (() => router.back());
  return (
    <View style={[styles.container, { paddingTop: insets.top + SPACING.sm }, transparent && styles.transparent]}>
      <View style={styles.row}>
        {showBack
          ? <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityRole="button" accessibilityLabel="Go back">
            <Ionicons name="chevron-back" size={24} color={transparent ? COLORS.textInverse : COLORS.text} />
          </TouchableOpacity>
          : <View style={styles.backBtn} />
        }
        {title && <Text style={[styles.title, transparent && { color: COLORS.textInverse }]} numberOfLines={1} accessibilityRole="header">{title}</Text>}
        <View style={styles.right}>{right ?? null}</View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { backgroundColor: COLORS.surface, paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.separator },
  transparent: { backgroundColor: 'transparent', borderBottomWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 46 },
  backBtn: { width: 36, height: 36, borderRadius: RADIUS.full, backgroundColor: COLORS.surfaceAlt, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text, letterSpacing: TYPOGRAPHY.letterSpacingTight },
  right: { width: 36, alignItems: 'flex-end' },
});
