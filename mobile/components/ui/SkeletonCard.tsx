import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withTiming, Easing,
} from 'react-native-reanimated';
import { RADIUS } from '../../constants/theme';

// Single shimmer block
function Bone({ style }: { style: object }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return <Animated.View style={[styles.bone, style, animStyle]} />;
}

// Skeleton that mirrors a ListingCard (grid / full-width)
export function SkeletonCard({ compact }: { compact?: boolean }) {
  if (compact) {
    return (
      <View style={styles.compactCard}>
        <Bone style={styles.compactImage} />
        <View style={styles.compactInfo}>
          <Bone style={styles.titleLine} />
          <Bone style={styles.titleLineShort} />
          <Bone style={styles.priceLine} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Bone style={styles.image} />
      <View style={styles.info}>
        <Bone style={styles.titleLine} />
        <Bone style={styles.titleLineShort} />
        <Bone style={styles.priceLine} />
      </View>
    </View>
  );
}

// Row of two skeleton cards for grid layout
export function SkeletonRow() {
  return (
    <View style={styles.row}>
      <SkeletonCard />
      <SkeletonCard />
    </View>
  );
}

const styles = StyleSheet.create({
  bone: { backgroundColor: '#E8E8E8', borderRadius: RADIUS.sm },
  // Grid card
  card: { width: '48%', backgroundColor: '#fff', borderRadius: RADIUS.lg, overflow: 'hidden' },
  image: { width: '100%', height: 160, borderRadius: 0 },
  info: { padding: 10, gap: 8 },
  titleLine: { height: 13, width: '90%' },
  titleLineShort: { height: 13, width: '60%' },
  priceLine: { height: 16, width: '40%', backgroundColor: '#DDE8FF', borderRadius: RADIUS.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  // Compact (list) card
  compactCard: { backgroundColor: '#fff', borderRadius: RADIUS.lg, flexDirection: 'row', height: 100, overflow: 'hidden' },
  compactImage: { width: 100, height: 100, borderRadius: 0 },
  compactInfo: { flex: 1, padding: 10, gap: 8, justifyContent: 'center' },
});
