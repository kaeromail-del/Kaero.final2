import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { COLORS, SPACING, TYPOGRAPHY } from '../../constants/theme';
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
          ? <TouchableOpacity onPress={handleBack} style={styles.backBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="chevron-back" size={24} color={transparent ? '#fff' : COLORS.text} />
            </TouchableOpacity>
          : <View style={styles.backBtn} />
        }
        {title && <Text style={[styles.title, transparent && { color: '#fff' }]} numberOfLines={1}>{title}</Text>}
        <View style={styles.right}>{right ?? null}</View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { backgroundColor: '#fff', paddingHorizontal: SPACING.lg, paddingBottom: SPACING.sm, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  transparent: { backgroundColor: 'transparent', borderBottomWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 44 },
  backBtn: { width: 40 },
  title: { flex: 1, textAlign: 'center', fontSize: TYPOGRAPHY.fontSizeLG, fontWeight: TYPOGRAPHY.fontWeightSemiBold, color: COLORS.text },
  right: { width: 40, alignItems: 'flex-end' },
});
