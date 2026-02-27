import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

interface StarsProps { rating: number; size?: number; showNumber?: boolean; count?: number; }

export function Stars({ rating, size = 14, showNumber = false, count }: StarsProps) {
  const stars = Array.from({ length: 5 }, (_, i) => i < Math.round(rating) ? '★' : '☆');
  return (
    <View style={styles.row}>
      {stars.map((s, i) => (
        <Text key={i} style={{ fontSize: size, color: i < Math.round(rating) ? COLORS.accent : COLORS.borderLight }}>{s}</Text>
      ))}
      {showNumber && <Text style={{ fontSize: size, color: COLORS.textSecondary, marginLeft: 4 }}>{rating.toFixed(1)}{count !== undefined ? ` (${count})` : ''}</Text>}
    </View>
  );
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 1 } });
