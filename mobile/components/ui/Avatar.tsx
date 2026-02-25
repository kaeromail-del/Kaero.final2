import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY } from '../../constants/theme';

interface AvatarProps { name?: string | null; uri?: string | null; size?: number; color?: string; }

export function Avatar({ name, uri, size = 40, color = COLORS.primary }: AvatarProps) {
  const letter = name ? name.charAt(0).toUpperCase() : '?';
  if (uri) return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} />;
  return (
    <View style={[styles.container, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
      <Text style={[styles.text, { fontSize: size * 0.4 }]}>{letter}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: TYPOGRAPHY.fontWeightBold },
});
